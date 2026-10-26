/* ==========================================================================
   Library

   Your songs as the rest of the app sees them. It imports files (reading tags,
   checking the song really plays, skipping duplicates, shrinking cover art),
   keeps every song's information in memory for fast browsing, and handles
   trash, play counts and storage numbers. The audio itself stays in the
   database (store.js) until a song is played.

   Events (Library.on): 'change' whenever songs are added, trashed, restored
   or deleted.  Nothing here touches the page.
   ========================================================================== */
(function (global) {
    'use strict';

    var TRASH_DAYS = 30;
    var TRASH_MS = TRASH_DAYS * 24 * 3600 * 1000;
    var AUDIO_EXT = /\.(mp3|m4a|m4b|aac|wav|flac|ogg|oga|opus|caf|aif|aiff)$/i;
    var MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', m4b: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', caf: 'audio/x-caf', aif: 'audio/aiff', aiff: 'audio/aiff' };
    var collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

    var live = [];                 // songs in your library
    var trashed = [];              // songs in the trash
    var byId = new Map();
    var coverKeys = new Set();     // covers known to exist in the database
    var urls = new Map(), urlLoads = new Map();                // song id -> object URL (for playback)
    var coverUrls = new Map(), coverLoads = new Map();         // cover key -> object URL
    var hay = new Map();           // song id -> lower-case text used by search
    var handlers = {};
    var readyPromise = null, unavailable = null, seq = 0, derived = null;
    var dirty = new Set(), flushTimer = null;


    /* ------------------------------------------------------------ helpers */

    function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
    function emit(type, arg) {
        (handlers[type] || []).slice().forEach(function (fn) { try { fn(arg); } catch (e) { console.error('Library handler error:', e); } });
    }
    var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    var fold = function (s) { return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    var sortKey = function (s) { return norm(s).replace(/^(the|a|an) /, ''); };
    var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

    function isAudioFile(f) { return (f.type && f.type.indexOf('audio') === 0) || AUDIO_EXT.test(f.name || ''); }
    function mimeFor(file) {
        if (file.type && file.type.indexOf('audio') === 0) return file.type;
        var m = /\.([a-z0-9]+)$/i.exec(file.name || '');
        return (m && MIME[m[1].toLowerCase()]) || 'audio/mpeg';
    }
    function coverKeyFor(albumArtist, artist, album, id) {
        return album ? 'c:' + norm(albumArtist || artist) + '|' + norm(album) : 't:' + id;
    }
    function invalidate() { derived = null; }


    /* ------------------------------------------------------------ start up */

    function init() {
        if (readyPromise) return readyPromise;
        readyPromise = Store.open().then(function () { return Store.getAllTracks(); }).then(function (all) {
            var cutoff = Date.now() - TRASH_MS, expired = [];
            all.forEach(function (t) {
                if (t.deletedAt && t.deletedAt < cutoff) { expired.push(t); return; }
                (t.deletedAt ? trashed : live).push(t);
                byId.set(t.id, t);
                if (t.coverKey) coverKeys.add(t.coverKey);
            });
            if (expired.length) return purgeRecords(expired);
        }).catch(function (e) {
            unavailable = e || new Error('The song database is not available');
            console.warn('Library unavailable:', unavailable);
        }).then(function () { emit('change', { type: 'ready' }); });
        return readyPromise;
    }


    /* ------------------------------------------------------------ importing */

    function probeDuration(blob) {
        return new Promise(function (resolve) {
            var a = new Audio(), url = URL.createObjectURL(blob), done = false, timer;
            function finish(r) {
                if (done) return;
                done = true; clearTimeout(timer);
                a.removeAttribute('src'); a.load(); URL.revokeObjectURL(url);
                resolve(r);
            }
            a.preload = 'metadata';
            a.addEventListener('loadedmetadata', function () { finish({ duration: a.duration }); });
            a.addEventListener('error', function () {
                var c = a.error && a.error.code;                          // 3 = could not decode, 4 = format not supported here
                finish({ duration: NaN, unsupported: c === 3 || c === 4 });
            });
            timer = setTimeout(function () { finish({ duration: NaN }); }, 8000);   // slow device: accept the song, length unknown
            a.src = url;
        });
    }

    /* Shrink cover art to at most 512 pixels so a big library stays light on memory. */
    function makeCoverBlob(blob) {
        return new Promise(function (resolve) {
            var url = URL.createObjectURL(blob), img = new Image();
            img.onload = function () {
                try {
                    var w = img.naturalWidth, h = img.naturalHeight;
                    if (!w || !h) throw new Error('no size');
                    var s = Math.min(1, 512 / Math.max(w, h));
                    if (s === 1 && blob.type === 'image/jpeg') { URL.revokeObjectURL(url); resolve(blob); return; }
                    var c = document.createElement('canvas');
                    c.width = Math.round(w * s); c.height = Math.round(h * s);
                    var ctx = c.getContext('2d');
                    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);   // transparent PNGs would turn black as JPEG
                    ctx.drawImage(img, 0, 0, c.width, c.height);
                    c.toBlob(function (b) {
                        URL.revokeObjectURL(url);
                        resolve(b && b.size ? b : (blob.size < 1500000 ? blob : null));
                    }, 'image/jpeg', 0.85);
                } catch (e) { URL.revokeObjectURL(url); resolve(blob.size < 1500000 ? blob : null); }
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    }

    async function importOne(file, sigs) {
        var tags = await Tags.read(file);
        var fn = Tags.fromFilename(file.name);
        var title = tags.title || fn.title || file.name;
        var artist = tags.artist || tags.albumArtist || fn.artist || 'Unknown artist';
        var album = tags.album || '', albumArtist = tags.albumArtist || '';

        var type = mimeFor(file);
        var audio = file.slice(0, file.size, type);
        var probe = await probeDuration(audio);
        if (probe.unsupported) { var e = new Error('unsupported'); e.userMessage = 'this device can\u2019t play this kind of file'; throw e; }
        var duration = isFinite(probe.duration) && probe.duration > 0 ? probe.duration : (tags.duration || 0);

        var sig = [norm(title), norm(artist), norm(album), file.size].join('|');
        var dup = sigs.get(sig);
        if (dup) {
            if (dup.deletedAt) { await restore([dup.id]); return { status: 'restored', track: dup }; }
            return { status: 'duplicate', track: dup };
        }

        var id = Date.now() * 1000 + (seq++ % 1000);
        var key = coverKeyFor(albumArtist, artist, album, id);
        var coverEntry = null;
        if (tags.cover && !coverKeys.has(key)) {
            var cb = await makeCoverBlob(tags.cover);
            if (cb) coverEntry = { key: key, blob: cb };
        }
        var meta = {
            id: id, title: title, artist: artist, album: album, albumArtist: albumArtist, genre: tags.genre || '',
            year: tags.year || null, track: tags.track || null, disc: tags.disc || null, duration: duration,
            size: file.size, type: type, fileName: file.name, addedAt: Date.now(), lastPlayedAt: 0, playCount: 0, deletedAt: 0,
            coverKey: (coverEntry || coverKeys.has(key)) ? key : '', sig: sig
        };

        try { await Store.addTrack(meta, audio, coverEntry); }
        catch (err) {
            if (err && err.name === 'QuotaExceededError') throw err;
            // Some Safari versions refuse a blob that still points at the picked file: store a real copy of the bytes
            var copy = new Blob([await file.arrayBuffer()], { type: type });
            await Store.addTrack(meta, copy, coverEntry);
        }
        live.push(meta); byId.set(id, meta); sigs.set(sig, meta);
        if (coverEntry) coverKeys.add(key);
        return { status: 'added', track: meta };
    }

    /* opts: onProgress({index,total,name,done}), isCancelled() */
    async function importFiles(fileList, opts) {
        opts = opts || {};
        await init();
        var files = Array.prototype.slice.call(fileList || []);
        var res = { added: [], duplicates: 0, restored: 0, skipped: [], failed: [], bytes: 0, cancelled: false, quotaExceeded: false };
        if (!files.length) return res;
        if (unavailable) {
            files.forEach(function (f) { res.failed.push({ name: f.name, reason: 'this browser can\u2019t save songs here' }); });
            return res;
        }
        Store.persist();     // ask the browser not to clear the library when space is short (best effort)
        var sigs = new Map();
        live.concat(trashed).forEach(function (t) { sigs.set(t.sig, t); });

        for (var i = 0; i < files.length; i++) {
            if (opts.isCancelled && opts.isCancelled()) { res.cancelled = true; break; }
            var f = files[i];
            if (opts.onProgress) opts.onProgress({ index: i, total: files.length, name: f.name });
            await tick();                                            // let the screen repaint between songs
            if (!isAudioFile(f)) { res.skipped.push(f.name); continue; }
            try {
                var r = await importOne(f, sigs);
                if (r.status === 'added') { res.added.push(r.track); res.bytes += r.track.size; }
                else if (r.status === 'restored') res.restored++;
                else res.duplicates++;
            } catch (e) {
                if (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))) {
                    res.quotaExceeded = true; res.failed.push({ name: f.name, reason: 'not enough space left' }); break;
                }
                res.failed.push({ name: f.name, reason: (e && e.userMessage) || 'could not be read' });
            }
        }
        if (opts.onProgress) opts.onProgress({ index: files.length, total: files.length, done: true });
        if (res.added.length || res.restored) { invalidate(); emit('change', { type: 'import' }); }
        return res;
    }


    /* ------------------------------------------------------------ playback + covers */

    function getUrl(id) {
        if (urls.has(id)) return Promise.resolve(urls.get(id));
        if (urlLoads.has(id)) return urlLoads.get(id);
        var p = Store.getBlob(id).then(function (blob) {
            urlLoads.delete(id);
            if (!blob) throw new Error('This song\u2019s audio is missing from the library');
            var u = URL.createObjectURL(blob);
            urls.set(id, u);
            return u;
        }, function (e) { urlLoads.delete(id); throw e; });
        urlLoads.set(id, p);
        return p;
    }
    function cachedUrl(id) { return urls.get(id) || null; }
    function releaseUrl(id) { var u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); } }

    function loadCover(key) {
        if (!key) return Promise.resolve(null);
        if (coverUrls.has(key)) return Promise.resolve(coverUrls.get(key));
        if (coverLoads.has(key)) return coverLoads.get(key);
        var p = Store.getCover(key).then(function (blob) {
            coverLoads.delete(key);
            var u = blob ? URL.createObjectURL(blob) : null;
            coverUrls.set(key, u);
            return u;
        }, function () { coverLoads.delete(key); return null; });
        coverLoads.set(key, p);
        return p;
    }
    function coverUrl(key) { return coverUrls.get(key) || null; }


    /* ------------------------------------------------------------ browsing */

    function sortSongs(list, how) {
        var a = list.slice();
        var byTitle = function (x, y) { return collator.compare(sortKey(x.title), sortKey(y.title)); };
        switch (how) {
            case 'az': a.sort(byTitle); break;
            case 'artist': a.sort(function (x, y) { return collator.compare(sortKey(x.artist), sortKey(y.artist)) || collator.compare(x.album, y.album) || (x.disc || 0) - (y.disc || 0) || (x.track || 0) - (y.track || 0) || byTitle(x, y); }); break;
            case 'plays': a.sort(function (x, y) { return (y.playCount - x.playCount) || byTitle(x, y); }); break;
            case 'duration': a.sort(function (x, y) { return (y.duration - x.duration) || byTitle(x, y); }); break;
            default: a.sort(function (x, y) { return (y.addedAt - x.addedAt) || (y.id - x.id); });   // recently added
        }
        return a;
    }
    function trackOrder(x, y) {
        return (x.disc || 0) - (y.disc || 0) || (x.track || 0) - (y.track || 0) || collator.compare(sortKey(x.title), sortKey(y.title));
    }

    function derive() {
        if (derived) return derived;
        var albums = new Map(), artists = new Map(), genres = new Map();
        live.forEach(function (t) {
            var who = t.albumArtist || t.artist;
            var ak = norm(who) + '|' + norm(t.album);
            var al = albums.get(ak);
            if (!al) albums.set(ak, al = { key: ak, album: t.album || 'Unknown album', artist: who, year: null, coverKey: '', songs: [], addedAt: 0 });
            al.songs.push(t);
            if (t.coverKey && !al.coverKey) al.coverKey = t.coverKey;
            if (t.year && (!al.year || t.year < al.year)) al.year = t.year;
            al.addedAt = Math.max(al.addedAt, t.addedAt);

            var rk = norm(who);
            var ar = artists.get(rk);
            if (!ar) artists.set(rk, ar = { key: rk, name: who, songs: [], albumKeys: new Set(), coverKey: '', addedAt: 0 });
            ar.songs.push(t); ar.albumKeys.add(ak);
            ar.addedAt = Math.max(ar.addedAt, t.addedAt);

            var gn = t.genre || 'Unknown genre', gk = norm(gn);
            var g = genres.get(gk);
            if (!g) genres.set(gk, g = { key: gk, name: gn, songs: [], coverKey: '' });
            g.songs.push(t);
            if (t.coverKey && !g.coverKey) g.coverKey = t.coverKey;
        });
        albums.forEach(function (al) { al.songs.sort(trackOrder); });
        artists.forEach(function (ar) {
            ar.songs.sort(function (x, y) { return collator.compare(x.album, y.album) || trackOrder(x, y); });
            var best = null;                                         // the artist's picture: the cover of their biggest album
            ar.albumKeys.forEach(function (k) { var al = albums.get(k); if (al.coverKey && (!best || al.songs.length > best.songs.length)) best = al; });
            ar.coverKey = best ? best.coverKey : '';
        });
        derived = { albums: Array.from(albums.values()), artists: Array.from(artists.values()), genres: Array.from(genres.values()) };
        return derived;
    }

    function albumList(how) {
        var a = derive().albums.slice();
        if (how === 'added') a.sort(function (x, y) { return y.addedAt - x.addedAt; });
        else if (how === 'artist') a.sort(function (x, y) { return collator.compare(sortKey(x.artist), sortKey(y.artist)) || collator.compare(x.album, y.album); });
        else a.sort(function (x, y) { return collator.compare(sortKey(x.album), sortKey(y.album)); });
        return a;
    }
    function artistList(how) {
        var a = derive().artists.slice();
        if (how === 'added') a.sort(function (x, y) { return y.addedAt - x.addedAt; });
        else a.sort(function (x, y) { return collator.compare(sortKey(x.name), sortKey(y.name)); });
        return a;
    }
    function genreList() { return derive().genres.slice().sort(function (x, y) { return collator.compare(x.name, y.name); }); }
    function findAlbum(key) { return derive().albums.filter(function (a) { return a.key === key; })[0] || null; }
    function findArtist(key) { return derive().artists.filter(function (a) { return a.key === key; })[0] || null; }
    function findGenre(key) { return derive().genres.filter(function (a) { return a.key === key; })[0] || null; }
    function albumsOf(artist) { return derive().albums.filter(function (a) { return artist.albumKeys.has(a.key); }).sort(function (x, y) { return (x.year || 9999) - (y.year || 9999) || collator.compare(x.album, y.album); }); }
    function albumKeyOf(t) { return norm(t.albumArtist || t.artist) + '|' + norm(t.album); }
    function artistKeyOf(t) { return norm(t.albumArtist || t.artist); }

    function text(t) {
        var h = hay.get(t.id);
        if (!h) hay.set(t.id, h = fold([t.title, t.artist, t.albumArtist, t.album, t.genre].join(' ')));
        return h;
    }
    function search(q) {
        var tokens = fold(q).split(' ').filter(Boolean);
        if (!tokens.length) return { songs: [], artists: [], albums: [] };
        var all = function (h) { return tokens.every(function (k) { return h.indexOf(k) > -1; }); };
        var first = tokens[0];
        var songs = live.filter(function (t) { return all(text(t)); });
        songs.sort(function (x, y) {
            var sx = fold(x.title).indexOf(first) === 0 ? 0 : 1, sy = fold(y.title).indexOf(first) === 0 ? 0 : 1;
            return (sx - sy) || collator.compare(sortKey(x.title), sortKey(y.title));
        });
        var d = derive();
        return {
            songs: songs.slice(0, 200),
            artists: d.artists.filter(function (a) { return all(fold(a.name)); }).sort(function (x, y) { return y.songs.length - x.songs.length; }).slice(0, 12),
            albums: d.albums.filter(function (a) { return all(fold(a.album + ' ' + a.artist)); }).slice(0, 24)
        };
    }


    /* ------------------------------------------------------------ plays, trash, storage */

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(flush, 1500);
    }
    function flush() {
        flushTimer = null;
        var metas = [];
        dirty.forEach(function (id) { var t = byId.get(id); if (t) metas.push(t); });
        dirty.clear();
        return Store.updateTracks(metas).catch(function (e) { console.warn('Could not save play counts:', e); });
    }
    function recordPlay(id) {
        var t = byId.get(id);
        if (!t || t.deletedAt) return;
        t.playCount = (t.playCount || 0) + 1;
        t.lastPlayedAt = Date.now();
        dirty.add(id);
        scheduleFlush();
        emit('plays', { id: id });
    }
    global.addEventListener('pagehide', function () { if (dirty.size) flush(); });
    global.addEventListener('visibilitychange', function () { if (document.hidden && dirty.size) flush(); });

    function moveToTrash(ids) {
        var now = Date.now(), moved = [];
        ids.forEach(function (id) {
            var t = byId.get(id);
            if (!t || t.deletedAt) return;
            t.deletedAt = now; live.splice(live.indexOf(t), 1); trashed.push(t); moved.push(t);
        });
        if (!moved.length) return Promise.resolve([]);
        invalidate();
        return Store.updateTracks(moved).then(function () { emit('change', { type: 'trash', ids: moved.map(function (t) { return t.id; }) }); return moved; });
    }
    function restore(ids) {
        var moved = [];
        ids.forEach(function (id) {
            var t = byId.get(id);
            if (!t || !t.deletedAt) return;
            t.deletedAt = 0; trashed.splice(trashed.indexOf(t), 1); live.push(t); moved.push(t);
        });
        if (!moved.length) return Promise.resolve([]);
        invalidate();
        return Store.updateTracks(moved).then(function () { emit('change', { type: 'restore', ids: moved.map(function (t) { return t.id; }) }); return moved; });
    }
    function purgeRecords(records) {
        var gone = {};
        records.forEach(function (t) {
            gone[t.id] = 1; byId.delete(t.id); hay.delete(t.id); releaseUrl(t.id);
            var i = trashed.indexOf(t); if (i > -1) trashed.splice(i, 1);
        });
        var still = new Set();
        byId.forEach(function (t) { if (t.coverKey) still.add(t.coverKey); });
        var orphans = [];
        records.forEach(function (t) { if (t.coverKey && !still.has(t.coverKey) && orphans.indexOf(t.coverKey) === -1) orphans.push(t.coverKey); });
        orphans.forEach(function (k) { coverKeys.delete(k); var u = coverUrls.get(k); if (u) URL.revokeObjectURL(u); coverUrls.delete(k); });
        return Store.deleteTracks(records.map(function (t) { return t.id; })).then(function () { return Store.deleteCovers(orphans); });
    }
    function purge(ids) {
        var recs = ids.map(function (id) { return byId.get(id); }).filter(function (t) { return t && t.deletedAt; });
        if (!recs.length) return Promise.resolve();
        invalidate();
        return purgeRecords(recs).then(function () { emit('change', { type: 'purge', ids: recs.map(function (t) { return t.id; }) }); });
    }
    function emptyTrash() { return purge(trashed.map(function (t) { return t.id; })); }

    function clearEverything() {
        urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls.clear();
        coverUrls.forEach(function (u) { if (u) URL.revokeObjectURL(u); }); coverUrls.clear();
        live = []; trashed = []; byId.clear(); coverKeys.clear(); hay.clear(); invalidate();
        return Store.clearAll().then(function () { emit('change', { type: 'purge' }); });
    }

    async function info() {
        var bytes = 0;
        byId.forEach(function (t) { bytes += t.size || 0; });
        var est = await Store.estimate();
        var persisted = await Store.persisted();
        return { count: live.length, trashCount: trashed.length, bytes: bytes, usage: est.usage, quota: est.quota, persisted: persisted, unavailable: unavailable ? String(unavailable.message || unavailable) : null };
    }


    /* ------------------------------------------------------------ public API */

    global.Library = {
        init: init, on: on, TRASH_DAYS: TRASH_DAYS,
        importFiles: importFiles,
        all: function () { return live; }, trash: function () { return trashed; }, get: function (id) { return byId.get(id) || null; },
        count: function () { return live.length; }, isUnavailable: function () { return unavailable; },
        songs: function (how) { return sortSongs(live, how); }, sortSongs: sortSongs,
        albums: albumList, artists: artistList, genres: genreList,
        findAlbum: findAlbum, findArtist: findArtist, findGenre: findGenre, albumsOf: albumsOf,
        albumKeyOf: albumKeyOf, artistKeyOf: artistKeyOf,
        search: search,
        getUrl: getUrl, cachedUrl: cachedUrl, releaseUrl: releaseUrl, loadCover: loadCover, coverUrl: coverUrl,
        recordPlay: recordPlay, flush: flush,
        moveToTrash: moveToTrash, restore: restore, purge: purge, emptyTrash: emptyTrash, clearEverything: clearEverything,
        info: info
    };
})(window);
