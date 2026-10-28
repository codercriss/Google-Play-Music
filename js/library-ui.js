/* ==========================================================================
   Library screens

   Everything you see that comes from your own songs: the Songs / Artists /
   Albums / Genres tabs, album, artist and genre pages, search, the Trash,
   and the Add music screen with import progress and storage numbers.
   It also connects the library to the player (what plays, play counts,
   removing trashed songs from the queue).

   Data comes from js/library.js; playback goes through js/player.js.
   ========================================================================== */
(function () {
    'use strict';
    var L = window.Library, P = window.Player, UI = window.AppUI;
    var main = document.querySelector('.main-content');
    if (!L || !P || !UI || !main) return;

    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var icon = UI.icon;
    function toast(t) { if (window.showToast) window.showToast(t); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmt(sec) {
        if (!isFinite(sec) || sec <= 0) return '\u2013:\u2013';
        sec = Math.floor(sec);
        var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (s < 10 ? '0' : '') + s;
    }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function longDur(sec) {
        var m = Math.round(sec / 60);
        return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60) + ' min' : Math.max(1, m) + ' min';
    }
    function bytes(n) {
        if (n == null) return '?';
        if (n < 1048576) return Math.max(1, Math.round(n / 1024)) + ' KB';
        if (n < 1073741824) return (n / 1048576).toFixed(n < 104857600 ? 1 : 0) + ' MB';
        return (n / 1073741824).toFixed(2) + ' GB';
    }
    function setTitle(t) { var h = document.getElementById('header-title'); if (h) h.textContent = t; }


    /* ------------------------------------------------------------ cover pictures */

    function paintCover(el, url) {
        el.style.backgroundImage = 'url("' + url + '")';
        el.classList.add('has-cover');
    }
    /* Any element with data-cover="key" gets its picture as soon as it has loaded. */
    function hydrateCovers(root) {
        $$('[data-cover]', root || main).forEach(function (el) {
            var k = el.getAttribute('data-cover');
            if (!k || el.classList.contains('has-cover')) return;
            var u = L.coverUrl(k);
            if (u) paintCover(el, u);
            else L.loadCover(k).then(function (url) { if (url && el.isConnected) paintCover(el, url); });
        });
    }
    window.hydrateCovers = hydrateCovers;


    /* ------------------------------------------------------------ playing from a list */

    var ctxMap = {}, ctxSeq = 0;
    function makeCtx(tracks) { var id = ++ctxSeq; ctxMap[id] = tracks; return id; }

    function playFrom(tracks, index) {
        var cur = P.getState().current, t = tracks[index];
        if (cur && t && cur.trackId === t.id) { P.toggle(); return; }       // tapping the playing song pauses / resumes it
        P.setQueue(tracks, index);
    }


    /* ------------------------------------------------------------ rows and cards */

    function listHeader() {
        return '<div class="song-list-header"><div class="song-col-title">SONG</div><div class="song-col-time">' + icon('schedule') +
            '</div><div class="song-col-plays">' + icon('music_note') + '</div></div>';
    }

    function songRow(t, o) {
        o = o || {};
        var lead = o.num ? '<div class="song-row-num">' + (t.track || o.num) + '</div>'
            : '<div class="song-row-art" data-cover="' + esc(t.coverKey) + '" style="background:' + L.placeholder(L.seedOf(t)) + '">' + icon('music_note', 'color:#fff;font-size:20px') + '</div>';
        var sub = o.num ? esc(t.artist) : esc(t.artist) + (t.album ? ' \u2013 ' + esc(t.album) : '');
        var right;
        if (o.trash) {
            var left = Math.max(0, Math.ceil((t.deletedAt + L.TRASH_DAYS * 86400000 - Date.now()) / 86400000));
            sub += ' \u00b7 deleted forever in ' + plural(left, 'day');
            right = '<div class="trash-btns"><button class="btn-ghost" data-act="restore">Restore</button><button class="btn-ghost" data-act="purge">Delete</button></div>';
        } else {
            right = '<div class="song-row-plays">' + (t.playCount || 0) + '</div><div class="kebab">' + icon('more_vert') + '</div>';
        }
        return '<div class="song-row' + (o.trash ? ' trash-row' : '') + '" data-track="' + t.id + '">' + lead +
            '<div class="song-row-info"><div class="song-row-title">' + esc(t.title) + '</div><div class="song-row-artist">' + sub + '</div></div>' +
            '<div class="song-row-time">' + fmt(t.duration) + '</div>' + right + '</div>';
    }

    function albumCard(a) {
        return '<div class="card" data-album="' + esc(a.key) + '"><div class="card-image" data-cover="' + esc(a.coverKey) + '" style="background:' + L.placeholder(a.key) + ';display:flex;align-items:center;justify-content:center">' +
            icon('album', 'font-size:52px;color:rgba(255,255,255,.85)') + '</div><div class="card-info"><div class="card-title">' + esc(a.album) +
            '</div><div class="card-subtitle">' + esc(a.artist) + (a.year ? ' \u00b7 ' + a.year : '') + '</div></div></div>';
    }
    function artistCard(a) {
        return '<div class="card artist" data-artist="' + esc(a.key) + '"><div class="card-image" data-cover="' + esc(a.coverKey) + '" style="background:' + L.placeholder('a|' + a.key) + ';display:flex;align-items:center;justify-content:center">' +
            icon('person', 'font-size:52px;color:rgba(255,255,255,.85)') + '</div><div class="card-info"><div class="card-title">' + esc(a.name) +
            '</div><div class="card-subtitle">' + plural(a.songs.length, 'song') + '</div></div></div>';
    }
    function genreCard(g) {
        return '<div class="card" data-genre="' + esc(g.key) + '"><div class="card-image" data-cover="' + esc(g.coverKey) + '" style="background:' + L.placeholder('g|' + g.key) + ';display:flex;align-items:center;justify-content:center">' +
            icon('graphic_eq', 'font-size:52px;color:rgba(255,255,255,.85)') + '</div><div class="card-info"><div class="card-title">' + esc(g.name) +
            '</div><div class="card-subtitle">' + plural(g.songs.length, 'song') + '</div></div></div>';
    }

    /* Long lists are drawn in chunks as you scroll, so thousands of songs stay quick. */
    var lazy = null, CHUNK = 120;
    function lazyList(tracks, o) {
        var cid = makeCtx(tracks);
        lazy = { tracks: tracks, from: 0, o: o || {}, cid: cid, box: null };
        return '<div class="song-list" data-ctx="' + cid + '"></div>';
    }
    function lazyStart(box) {
        if (!lazy || !box) return;
        lazy.box = box; lazy.from = 0; box.innerHTML = '';
        lazyMore(true);
    }
    function lazyMore(first) {
        if (!lazy || !lazy.box || lazy.from >= lazy.tracks.length) return;
        var end = Math.min(lazy.tracks.length, lazy.from + CHUNK), html = '';
        for (var i = lazy.from; i < end; i++) {
            var o = lazy.o, ro = {};
            if (o.numbered) ro.num = i + 1;
            if (o.trash) ro.trash = true;
            html += songRow(lazy.tracks[i], ro);
        }
        lazy.box.insertAdjacentHTML('beforeend', html);
        lazy.from = end;
        hydrateCovers(lazy.box);
        markPlaying();
    }
    main.addEventListener('scroll', function () {
        if (lazy && main.scrollTop + main.clientHeight > main.scrollHeight - 800) lazyMore();
    });

    function markPlaying() {
        var cur = P.getState().current, id = cur ? cur.trackId : -1;
        $$('.song-row[data-track]', main).forEach(function (r) { r.classList.toggle('playing', +r.dataset.track === id && !r.classList.contains('trash-row')); });
    }


    /* ------------------------------------------------------------ My Library */

    var libView = $('#view-library');
    var tab = 'Songs', sorts = { Songs: 'added', Albums: 'az', Artists: 'az' };
    var SORT_LABELS = {
        Songs: [['Recently added', 'added'], ['A to Z', 'az'], ['Artist', 'artist'], ['Most played', 'plays'], ['Duration', 'duration']],
        Albums: [['A to Z', 'az'], ['Artist', 'artist'], ['Recently added', 'added']],
        Artists: [['A to Z', 'az'], ['Recently added', 'added']]
    };
    function labelFor(t) { var k = sorts[t]; var l = SORT_LABELS[t].filter(function (x) { return x[1] === k; })[0]; return l ? l[0] : ''; }

    libView.innerHTML = '<div class="lib-bar"><div class="tabs">' +
        ['Playlists', 'Artists', 'Albums', 'Songs', 'Genres'].map(function (t) { return '<div class="tab" data-tab="' + t + '">' + t + '</div>'; }).join('') +
        '</div><div class="sort-btn" id="sort-btn"><span></span>' + icon('arrow_drop_down') + '</div></div><div id="lib-body"></div>';

    function emptyState() {
        var bad = L.isUnavailable();
        return '<div class="empty-state">' + icon(bad ? 'error_outline' : 'library_music') +
            '<h3>' + (bad ? 'Songs can\u2019t be saved here' : 'Your library is empty') + '</h3>' +
            '<p>' + (bad ? 'This browser isn\u2019t allowing storage (private browsing can do this). Open the app normally to add songs.'
                         : 'Add songs from your phone or computer. They are saved on this device and play with no internet.') + '</p>' +
            (bad ? '' : '<button class="btn-solid" data-act="go-add">Add music</button>') + '</div>';
    }

    function renderLibrary() {
        lazy = null;
        ctxMap = {};
        $$('.tab', libView).forEach(function (t) { t.classList.toggle('active', t.dataset.tab === tab); });
        var sortBtn = $('#sort-btn'), hasSort = !!SORT_LABELS[tab] && L.count() > 0;
        sortBtn.style.visibility = hasSort ? '' : 'hidden';
        if (hasSort) $('span', sortBtn).textContent = labelFor(tab);
        var body = $('#lib-body');

        if (tab === 'Playlists') {
            body.innerHTML = '<div class="empty-state">' + icon('queue_music') + '<h3>Playlists are coming next</h3><p>You\u2019ll be able to make playlists from your own songs in the next update. For now, use the queue (the list icon in the player).</p></div>';
            return;
        }
        if (!L.count()) { body.innerHTML = emptyState(); return; }

        if (tab === 'Songs') {
            var songs = L.songs(sorts.Songs), cid = makeCtx(songs);
            body.innerHTML = '<div class="lib-actions"><button class="btn-solid" data-act="shuffle-all" data-ctx="' + cid + '">' + icon('shuffle', 'font-size:18px') + 'Shuffle all</button>' +
                '<span class="count">' + plural(songs.length, 'song') + ' \u00b7 ' + longDur(songs.reduce(function (s, t) { return s + (t.duration || 0); }, 0)) + '</span></div>' +
                listHeader() + lazyList(songs);
            lazyStart($('.song-list', body));
        } else if (tab === 'Albums') {
            body.innerHTML = '<div class="cards-grid">' + L.albums(sorts.Albums).map(albumCard).join('') + '</div>';
        } else if (tab === 'Artists') {
            body.innerHTML = '<div class="cards-grid">' + L.artists(sorts.Artists).map(artistCard).join('') + '</div>';
        } else {
            body.innerHTML = '<div class="cards-grid">' + L.genres().map(genreCard).join('') + '</div>';
        }
        hydrateCovers(body);
        markPlaying();
    }

    libView.addEventListener('click', function (e) {
        var t = e.target.closest('.tab');
        if (t) { tab = t.dataset.tab; main.scrollTop = 0; renderLibrary(); return; }
        var sb = e.target.closest('#sort-btn');
        if (sb && SORT_LABELS[tab]) {
            var cur = sorts[tab];
            UI.openPop(sb, '<div data-single="1">' + SORT_LABELS[tab].map(function (x) { return UI.opt(x[0], x[1] === cur); }).join('') + '</div>', {
                pick: function (it) {
                    var label = it.textContent.replace('check', '').trim();
                    var m = SORT_LABELS[tab].filter(function (x) { return x[0] === label; })[0];
                    if (m) { sorts[tab] = m[1]; main.scrollTop = 0; renderLibrary(); }
                }
            });
        }
    });


    /* ------------------------------------------------------------ album / artist / genre pages */

    var detailRef = null;
    function heroArt(coverKey, seed, ic) {
        return '<div class="pl-art" data-cover="' + esc(coverKey) + '" style="background:' + L.placeholder(seed) + '">' + icon(ic) + '</div>';
    }

    function renderDetail() {
        lazy = null; ctxMap = {};
        var box = $('#view-detail');
        if (!detailRef) { box.innerHTML = ''; return; }
        var d, songs, title, sub, art, extra = '';
        if (detailRef.kind === 'album') {
            d = L.findAlbum(detailRef.key); if (!d) { goBack(); return; }
            songs = d.songs; title = d.album;
            sub = esc(d.artist) + (d.year ? ' \u00b7 ' + d.year : '') + ' \u00b7 ' + plural(songs.length, 'song') + ' \u00b7 ' + longDur(songs.reduce(function (s, t) { return s + (t.duration || 0); }, 0));
            art = heroArt(d.coverKey, d.key, 'album');
            extra = '<div class="detail-link" data-artist-link="' + esc(L.artistKeyOf(songs[0])) + '">' + icon('person', 'font-size:16px') + 'More from ' + esc(d.artist) + '</div>';
        } else if (detailRef.kind === 'artist') {
            d = L.findArtist(detailRef.key); if (!d) { goBack(); return; }
            songs = d.songs; title = d.name;
            var albums = L.albumsOf(d);
            sub = plural(albums.length, 'album') + ' \u00b7 ' + plural(songs.length, 'song');
            art = heroArt(d.coverKey, 'a|' + d.key, 'person');
            extra = '<h3 class="sec-title">Albums</h3><div class="cards-grid">' + albums.map(albumCard).join('') + '</div><h3 class="sec-title">Songs</h3>';
        } else {
            d = L.findGenre(detailRef.key); if (!d) { goBack(); return; }
            songs = d.songs; title = d.name;
            sub = plural(songs.length, 'song');
            art = heroArt(d.coverKey, 'g|' + d.key, 'graphic_eq');
        }
        var cid = makeCtx(songs);
        box.innerHTML = '<div class="back-link" data-act="back">' + icon('arrow_back', 'font-size:18px') + 'My Library</div>' +
            '<div class="pl-hero">' + art + '<div><h1>' + esc(title) + '</h1><p>' + sub + '</p><div class="pl-actions">' +
            '<button class="btn-solid" data-act="play-all" data-ctx="' + cid + '">' + icon('play_arrow', 'font-size:18px') + 'Play</button>' +
            '<button class="btn-ghost" data-act="shuffle-all" data-ctx="' + cid + '">Shuffle</button></div></div></div>' +
            (detailRef.kind === 'album' ? extra : '') + (detailRef.kind === 'artist' ? extra : '') +
            listHeader() + lazyList(songs, { numbered: detailRef.kind === 'album' });
        lazyStart($('.song-list', box));
        hydrateCovers(box);
        setTitle(title);
    }

    function openDetail(kind, key) {
        detailRef = { kind: kind, key: key };
        showView('detail');
    }
    function goBack() { detailRef = null; showView('library'); }


    /* ------------------------------------------------------------ search */

    var searchBox = $('.search-bar input'), searchTimer = null, viewBeforeSearch = 'library';
    var currentView = 'listen-now';

    function renderSearch() {
        lazy = null; ctxMap = {};
        var q = searchBox.value.trim(), box = $('#view-search');
        if (!q) { box.innerHTML = ''; return; }
        if (L.isUnavailable() || !L.count()) {
            box.innerHTML = '<div class="empty-state">' + icon('search') + '<h3>Nothing to search yet</h3><p>Add songs and you can search them by title, artist, album or genre.</p><button class="btn-solid" data-act="go-add">Add music</button></div>';
            return;
        }
        var r = L.search(q);
        if (!r.songs.length && !r.artists.length && !r.albums.length) {
            box.innerHTML = '<div class="empty-state">' + icon('search_off') + '<h3>No results for \u201c' + esc(q) + '\u201d</h3><p>Check the spelling, or try a shorter search.</p></div>';
            return;
        }
        var html = '';
        if (r.artists.length) html += '<h3 class="sec-title">Artists</h3><div class="cards-grid small">' + r.artists.map(artistCard).join('') + '</div>';
        if (r.albums.length) html += '<h3 class="sec-title">Albums</h3><div class="cards-grid small">' + r.albums.map(albumCard).join('') + '</div>';
        if (r.songs.length) html += '<h3 class="sec-title">Songs</h3>' + listHeader() + lazyList(r.songs);
        box.innerHTML = html;
        lazyStart($('.song-list', box));
        hydrateCovers(box);
    }

    function runSearch() {
        var q = searchBox.value.trim();
        if (!q) { if (currentView === 'search') showView(viewBeforeSearch || 'library'); return; }
        if (currentView !== 'search') viewBeforeSearch = currentView === 'detail' ? 'library' : currentView;
        if (currentView !== 'search') showView('search'); else renderSearch();
    }
    searchBox.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 120); });
    searchBox.addEventListener('keydown', function (e) { if (e.key === 'Enter') searchBox.blur(); });   // hides the phone keyboard
    // Escape leaves the search from anywhere on the results screen, not only while the box has focus
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || (currentView !== 'search' && document.activeElement !== searchBox)) return;
        searchBox.value = ''; searchBox.blur(); runSearch();
    });


    /* ------------------------------------------------------------ Trash */

    function renderTrash() {
        lazy = null; ctxMap = {};
        var box = $('#view-trash'), list = L.trash().slice().sort(function (a, b) { return b.deletedAt - a.deletedAt; });
        var html = '<div class="section-header"><div class="section-title"><h2>Trash</h2><p>Songs are deleted forever after ' + L.TRASH_DAYS + ' days</p></div></div>';
        if (!list.length) { box.innerHTML = html + '<div class="empty-state">' + icon('delete_outline') + '<h3>Trash is empty</h3><p>Songs you remove from your library wait here for ' + L.TRASH_DAYS + ' days before they are deleted for good.</p></div>'; return; }
        html += '<div class="lib-actions"><button class="btn-ghost" data-act="empty-trash">Empty trash</button><span class="count">' + plural(list.length, 'song') + '</span></div>' +
            '<div class="song-list-header"><div class="song-col-title">SONG</div><div class="song-col-time">' + icon('schedule') + '</div></div>' + lazyList(list, { trash: true });
        box.innerHTML = html;
        lazyStart($('.song-list', box));
    }


    /* ------------------------------------------------------------ Add music */

    var addView = $('#view-add');
    var importing = false, cancelled = false, progress = null, lastImport = null;
    addView.innerHTML =
        '<div class="drop" id="add-drop">' + icon('library_add') + '<h3>Add songs</h3>' +
        '<p>MP3, M4A, AAC, WAV, FLAC and more. On a computer you can also drag files into this window.</p>' +
        '<button class="btn-solid" id="add-pick">Choose songs</button>' +
        '<input type="file" id="add-input" accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus" multiple hidden>' +
        '<p class="note">Songs are saved on this device and play with no internet. Keep the app open while they are being added.</p></div>' +
        '<div id="imp-box"></div>' +
        '<div class="panel" id="stats-panel"><h3>Your library</h3><div id="lib-stats"></div></div>';

    function renderImport() {
        var box = $('#imp-box');
        if (importing && progress) {
            var pct = progress.total ? Math.round(progress.index / progress.total * 100) : 0;
            box.innerHTML = '<div class="panel"><h3>Adding songs</h3><div class="imp-body"><div class="imp-line"><span>' + Math.min(progress.index + 1, progress.total) + ' of ' + progress.total +
                '</span><span class="imp-name">' + esc(progress.name || '') + '</span></div><div class="progress-line"><div style="width:' + pct + '%"></div></div>' +
                '<button class="btn-ghost" data-act="cancel-import">Stop</button></div></div>';
            return;
        }
        if (!lastImport) { box.innerHTML = ''; return; }
        var r = lastImport, rows = [];
        if (r.added.length) rows.push(['check_circle', 'ok', 'Added ' + plural(r.added.length, 'song') + ' (' + bytes(r.bytes) + ')']);
        if (r.restored) rows.push(['restore', 'ok', plural(r.restored, 'song') + ' brought back from the Trash']);
        if (r.duplicates) rows.push(['content_copy', 'info', plural(r.duplicates, 'song') + ' already in your library']);
        if (r.skipped.length) rows.push(['block', 'info', plural(r.skipped.length, 'file') + ' skipped (not audio)']);
        r.failed.forEach(function (f) { rows.push(['error', 'bad', esc(f.name) + ': ' + esc(f.reason)]); });
        if (r.cancelled) rows.push(['stop', 'info', 'Stopped early']);
        if (!rows.length) rows.push(['info', 'info', 'Nothing was added']);
        box.innerHTML = '<div class="panel"><h3>' + (r.added.length || r.restored ? 'Done' : 'Result') + '</h3><div class="imp-body"><ul class="imp-list">' +
            rows.map(function (x) { return '<li class="' + x[1] + '">' + icon(x[0]) + '<span>' + x[2] + '</span></li>'; }).join('') + '</ul></div></div>';
    }

    function renderStats() {
        var el = $('#lib-stats');
        if (!el) return;
        L.info().then(function (i) {
            if (i.unavailable) { el.innerHTML = '<div class="set-row"><div>Songs can\u2019t be saved in this browser<small>' + esc(i.unavailable) + '</small></div></div>'; return; }
            var free = (i.quota != null && i.usage != null) ? i.quota - i.usage : null;
            var rows = '<div class="set-row"><div>' + plural(i.count, 'song') + '<small>' + bytes(i.bytes) + ' on this device' + (i.trashCount ? ' \u00b7 ' + plural(i.trashCount, 'song') + ' in the Trash' : '') + '</small></div></div>';
            if (free != null) rows += '<div class="set-row"><div>Space available<small>' + bytes(free) + ' free for this app</small></div></div>';
            if (i.persisted === true) rows += '<div class="set-row"><div>Protected<small>The browser has promised not to clear your songs when space runs low</small></div>' + icon('verified_user', 'color:#43a047') + '</div>';
            else if (i.persisted === false) rows += '<div class="set-row"><div>Not protected yet<small>If the phone runs very low on space, the browser may clear saved songs. Using the app from your Home Screen helps.</small></div><button class="btn-ghost" data-act="protect">Protect</button></div>';
            el.innerHTML = rows;
        });
    }

    function startImport(files) {
        files = Array.prototype.slice.call(files || []);
        if (!files.length) return;
        if (importing) { toast('Already adding songs'); return; }
        importing = true; cancelled = false; progress = { index: 0, total: files.length, name: files[0].name }; lastImport = null;
        showView('add');
        renderImport();
        L.importFiles(files, {
            onProgress: function (p) { progress = p; if (currentView === 'add') renderImport(); },
            isCancelled: function () { return cancelled; }
        }).then(function (res) {
            importing = false; lastImport = res;
            if (currentView === 'add') { renderImport(); renderStats(); }
            if (res.quotaExceeded) toast('Not enough storage space left');
            else if (res.added.length) toast('Added ' + plural(res.added.length, 'song'));
            else if (res.duplicates) toast('Those songs are already in your library');
            else if (res.failed.length) toast('Some files couldn\u2019t be added');
            else toast('No songs added');
        });
    }

    var addInput = $('#add-input');
    $('#add-pick').addEventListener('click', function () { addInput.click(); });
    addInput.addEventListener('change', function () { var f = Array.prototype.slice.call(addInput.files); addInput.value = ''; startImport(f); });

    // Dropping files anywhere in the window adds them (computer only)
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') !== -1; }
    window.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); $('#add-drop').classList.add('over'); } });
    window.addEventListener('dragleave', function (e) { if (!e.relatedTarget) $('#add-drop').classList.remove('over'); });
    window.addEventListener('drop', function (e) {
        if (!hasFiles(e)) return;
        e.preventDefault();
        $('#add-drop').classList.remove('over');
        startImport(e.dataTransfer.files);
    });


    /* ------------------------------------------------------------ song menu */

    function openRowMenu(anchor, id) {
        var t = L.get(id);
        if (!t) return;
        UI.openPop(anchor,
            UI.item('play_arrow', 'Play next', '', ' data-act="next"') + UI.item('queue_music', 'Add to queue', '', ' data-act="queue"') +
            UI.item('playlist_add', 'Add to playlist', 'Playlists are coming in the next update') + '<div class="pop-sep"></div>' +
            UI.item('person', 'Go to artist', '', ' data-act="artist"') + UI.item('album', 'Go to album', '', ' data-act="album"') + '<div class="pop-sep"></div>' +
            UI.item('delete', 'Remove from library', '', ' data-act="remove"'),
            {
                pick: function (it) {
                    var act = it.dataset.act;
                    if (act === 'next') { P.addTracks([t], { next: true }); toast('Playing next'); }
                    else if (act === 'queue') { P.addTracks([t]); toast('Added to queue'); }
                    else if (act === 'artist') openDetail('artist', L.artistKeyOf(t));
                    else if (act === 'album') openDetail('album', L.albumKeyOf(t));
                    else if (act === 'remove') L.moveToTrash([t.id]).then(function () { toast('Moved to Trash'); });
                }
            });
    }


    /* ------------------------------------------------------------ clicks on everything above */

    main.addEventListener('click', function (e) {
        var kebab = e.target.closest('.kebab');
        if (kebab) {
            var kr = kebab.closest('.song-row[data-track]');
            if (kr) { e.stopPropagation(); openRowMenu(kebab, +kr.dataset.track); }
            return;
        }
        var b = e.target.closest('[data-act]');
        if (b && main.contains(b)) {
            var act = b.dataset.act, row = b.closest('.song-row[data-track]'), tracks = b.dataset.ctx ? ctxMap[b.dataset.ctx] : null;
            if (act === 'play-all' && tracks) P.setQueue(tracks, 0);
            else if (act === 'shuffle-all' && tracks) P.setQueue(tracks, null, { shuffle: true });
            else if (act === 'go-add') showView('add');
            else if (act === 'back') goBack();
            else if (act === 'restore' && row) L.restore([+row.dataset.track]).then(function () { toast('Song restored'); });
            else if (act === 'purge' && row) {
                if (window.confirm('Delete this song forever? This can\u2019t be undone.')) L.purge([+row.dataset.track]).then(function () { toast('Deleted forever'); });
            } else if (act === 'empty-trash') {
                var n = L.trash().length;
                if (n && window.confirm('Delete ' + plural(n, 'song') + ' forever? This can\u2019t be undone.')) L.emptyTrash().then(function () { toast('Trash emptied'); });
            } else if (act === 'cancel-import') cancelled = true;
            else if (act === 'protect') window.Store.persist().then(function (ok) { toast(ok ? 'Your library is now protected' : 'The browser didn\u2019t agree to protect it'); renderStats(); });
            return;
        }
        var link = e.target.closest('[data-artist-link]');
        if (link) { openDetail('artist', link.dataset.artistLink); return; }
        var card = e.target.closest('.card[data-album], .card[data-artist], .card[data-genre]');
        if (card) {
            if (card.dataset.album != null) openDetail('album', card.dataset.album);
            else if (card.dataset.artist != null) openDetail('artist', card.dataset.artist);
            else openDetail('genre', card.dataset.genre);
            return;
        }
        var sr = e.target.closest('.song-row[data-track]');
        if (sr && !sr.classList.contains('trash-row')) {
            var box = sr.closest('[data-ctx]'), list = box && ctxMap[box.dataset.ctx];
            if (list) {
                var id = +sr.dataset.track;
                for (var i = 0; i < list.length; i++) if (list[i].id === id) { playFrom(list, i); break; }
            }
        }
    });


    /* ------------------------------------------------------------ views + wiring to the player and library */

    var wrapped = showView;
    showView = function (v) {
        if (v !== 'search' && searchBox.value && currentView === 'search') searchBox.value = '';
        wrapped(v);
        currentView = v;
        if (v === 'library') { setTitle('My Library'); renderLibrary(); }
        else if (v === 'detail') renderDetail();
        else if (v === 'search') renderSearch();
        else if (v === 'trash') renderTrash();
        else if (v === 'add') { renderImport(); renderStats(); }
    };

    function refresh() {
        var st = main.scrollTop;
        if (currentView === 'library') renderLibrary();
        else if (currentView === 'detail') renderDetail();
        else if (currentView === 'search') renderSearch();
        else if (currentView === 'trash') renderTrash();
        else if (currentView === 'add') renderStats();
        main.scrollTop = st;
    }

    P.configure({ resolveUrl: L.getUrl, cachedUrl: L.cachedUrl, releaseUrl: L.releaseUrl, coverUrl: L.loadCover });
    P.on('played', function (it) { L.recordPlay(it.trackId); });
    P.on('track', markPlaying);
    L.on('plays', function (e) {
        var row = $('.song-row[data-track="' + e.id + '"] .song-row-plays', main), t = L.get(e.id);
        if (row && t) row.textContent = t.playCount;
    });
    L.on('change', function (e) {
        if ((e.type === 'trash' || e.type === 'purge') && e.ids) P.removeTrackIds(e.ids);
        refresh();
    });

    L.init().then(function () { if (currentView === 'library') renderLibrary(); });
    renderLibrary();
})();
