/* ==========================================================================
   Player engine

   Owns the ONE audio element for the whole app, the queue, shuffle/repeat,
   and the lock-screen controls (Media Session). It never touches the page:
   js/player-ui.js listens to the events below and draws everything.

   Songs come from the library. Player.configure() tells the engine how to
   get a song's audio address, so the engine itself knows nothing about the
   database.

   Why one audio element: iOS only lets audio start from a tap, and it
   remembers that permission per element. Re-using one element is what lets
   the next song start by itself, and keep playing with the screen locked.

   Reading a song out of the database takes a moment, and iOS can refuse audio
   that starts after such a pause. So (1) the element is "unlocked" with a
   silent blip inside the tap itself, and (2) the next song's address is
   fetched ahead of time, so moving on is instant.

   Events (Player.on(name, fn)):
     'track'    the current song changed (or there is none)
     'state'    playing / paused / loading changed
     'time'     position or duration changed
     'queue'    the queue list changed
     'mode'     shuffle or repeat changed
     'volume'   volume or mute changed
     'played'   a song has been listened to enough to count as a play
     'message'  text to show the person (fn receives the string)
     'needmusic' play was pressed with nothing to play
   ========================================================================== */
(function (global) {
    'use strict';

    var audio = new Audio();
    audio.preload = 'auto';

    var state = { queue: [], index: -1, shuffle: false, repeat: 'off', volume: 1, muted: false };
    var originalOrder = null;    // item ids in the order they were queued; non-null exactly when shuffle is on
    var nextUid = 1;
    var handlers = {};
    var failStreak = 0;          // songs in a row that couldn't be played
    var pendingSeek = null;      // a seek requested before the file's length is known
    var unloading = false;       // true while we deliberately empty the audio element
    var lastPosUpdate = 0;
    var loadToken = 0;           // lets a slow database read notice it has been overtaken
    var wantPlay = false;        // play was requested while the song was still being fetched
    var held = {};               // trackId -> true: audio addresses this engine currently holds
    var unlocked = false, silentUrl = null;
    var listened = 0, lastT = 0, counted = false;
    var cfg = {
        resolveUrl: function () { return Promise.reject(new Error('No song source configured')); },
        cachedUrl: function () { return null; },
        releaseUrl: function () {},
        coverUrl: function () { return Promise.resolve(null); }
    };
    var PREF_KEY = 'gpm.player.v1';


    /* ------------------------------------------------------------ helpers */

    function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
    function emit(type, arg) {
        (handlers[type] || []).slice().forEach(function (fn) {
            try { fn(arg); } catch (e) { console.error('Player handler error:', e); }
        });
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function current() { return state.queue[state.index] || null; }
    function configure(c) { Object.keys(c).forEach(function (k) { cfg[k] = c[k]; }); }

    function shuffleArray(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function toItem(t) {
        return {
            id: nextUid++, trackId: t.id, title: t.title, artist: t.artist, albumArtist: t.albumArtist || '', album: t.album || '',
            coverKey: t.coverKey || '', duration: t.duration > 0 ? t.duration : NaN, failed: false
        };
    }

    function loadPrefs() {
        try {
            var p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
            if (typeof p.volume === 'number') state.volume = clamp(p.volume, 0, 1);
            if (['off', 'all', 'one'].indexOf(p.repeat) !== -1) state.repeat = p.repeat;
        } catch (e) { /* storage unavailable: use defaults */ }
        try { audio.volume = state.volume; } catch (e) { /* iOS ignores volume */ }
    }
    function savePrefs() {
        try { localStorage.setItem(PREF_KEY, JSON.stringify({ volume: state.volume, repeat: state.repeat })); } catch (e) { /* ignore */ }
    }


    /* ------------------------------------------------------------ iOS unlock */

    /* A 10 ms silent clip, built in code. */
    function makeSilentUrl() {
        var n = 80, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
        function s(o, str) { for (var i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); }
        s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
        s(36, 'data'); v.setUint32(40, n, true);
        for (var i = 0; i < n; i++) b[44 + i] = 128;                      // 8-bit silence
        return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    }
    function isSilent() { return !!silentUrl && audio.getAttribute('src') === silentUrl; }

    /* Must run synchronously inside a tap: playing anything there lifts iOS's
       "needs a tap" rule for this element, so later async starts are allowed. */
    function unlockAudio() {
        if (unlocked) return;
        unlocked = true;
        if (audio.getAttribute('src')) return;                          // something is loaded: a normal play() does the job
        try {
            if (!silentUrl) silentUrl = makeSilentUrl();
            audio.src = silentUrl;
            var p = audio.play();
            if (p && p.catch) p.catch(function () { /* the real song replaces it */ });
        } catch (e) { /* ignore */ }
    }


    /* ------------------------------------------------------------ loading */

    /* Keep only the current and next songs' audio addresses; give the rest back. */
    function pruneUrls() {
        var keep = {}, cur = current(), nxt = state.queue[state.index + 1];
        if (cur) keep[cur.trackId] = true;
        if (nxt) keep[nxt.trackId] = true;
        Object.keys(held).forEach(function (id) {
            if (!keep[id]) { cfg.releaseUrl(+id); delete held[id]; }
        });
    }
    function prefetchNext() {
        var n = state.queue[state.index + 1] || (state.repeat === 'all' ? state.queue[0] : null);
        if (!n || n === current() || cfg.cachedUrl(n.trackId)) { if (n && cfg.cachedUrl(n.trackId)) held[n.trackId] = true; return; }
        cfg.resolveUrl(n.trackId).then(function () { held[n.trackId] = true; }, function () { /* reported when it is actually played */ });
    }

    function startLoaded(it, url, autoplay) {
        audio.src = url;
        held[it.trackId] = true;
        if (autoplay || wantPlay) { wantPlay = false; play(); } else emit('state');
        pruneUrls();
        prefetchNext();
    }

    function songFailed(it, message) {
        it.failed = true;
        emit('message', message);
        emit('queue');
        emit('state');
        failStreak++;
        if (failStreak >= state.queue.length) { failStreak = 0; return; }   // everything failed: stop trying
        if (state.index + 1 < state.queue.length || state.repeat === 'all') {
            setTimeout(function () { if (current() === it) advance(false); }, 600);
        }
    }

    function loadIndex(i, autoplay) {
        var it = state.queue[i];
        if (!it) return;
        state.index = i;
        pendingSeek = null; listened = 0; lastT = 0; counted = false;
        var token = ++loadToken;
        wantPlay = !!autoplay;
        if (autoplay) unlockAudio();
        updateMediaSession();
        emit('track');
        emit('time');

        var url = cfg.cachedUrl(it.trackId);
        if (url) { startLoaded(it, url, autoplay); return; }       // already fetched: start in this same tick
        emit('state');
        cfg.resolveUrl(it.trackId).then(function (u) {
            if (token !== loadToken) return;                        // the person has moved on
            startLoaded(it, u, autoplay);
        }, function () {
            if (token !== loadToken) return;
            songFailed(it, 'Can\u2019t find \u201c' + it.title + '\u201d in your library');
        });
    }

    function unload() {
        loadToken++; wantPlay = false;
        unloading = true;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        unloading = false;
    }


    /* ------------------------------------------------------------ playback */

    function play() {
        unlockAudio();
        if (!current()) {
            if (state.queue.length) loadIndex(0, true);
            else emit('needmusic');
            return;
        }
        if (!audio.getAttribute('src') || isSilent()) { wantPlay = true; return; }   // still being fetched
        var p = audio.play();
        if (p && p.catch) {
            p.catch(function (err) {
                // iOS can refuse to start audio that wasn't triggered by a tap
                if (err && err.name === 'NotAllowedError') emit('message', 'Tap play to start');
                // AbortError (a newer song replaced this one) and NotSupportedError (handled by the 'error' event) are ignored
            });
        }
    }
    function pause() { wantPlay = false; audio.pause(); }
    function toggle() {
        if (!current()) { play(); return; }
        var active = !audio.paused && !isSilent();
        if (active || wantPlay) pause(); else play();     // pausing also cancels a start that is still being fetched
    }

    function stopAtEnd() {
        audio.pause();
        try { audio.currentTime = 0; } catch (e) { /* not seekable yet */ }
        emit('state');
        emit('time');
    }

    /* auto = the song ended by itself (stop at the end); otherwise a person pressed next */
    function advance(auto) {
        var n = state.queue.length;
        if (!n) return;
        var i = state.index + 1;
        if (i >= n) {
            if (state.repeat === 'all') i = 0;
            else { if (auto) stopAtEnd(); return; }
        }
        loadIndex(i, true);
    }
    function next() { advance(false); }

    function prev() {
        if (!current()) return;
        if (audio.currentTime > 3) { seek(0); return; }          // like most players: first press restarts
        if (state.index > 0) loadIndex(state.index - 1, true);
        else if (state.repeat === 'all' && state.queue.length > 1) loadIndex(state.queue.length - 1, true);
        else seek(0);
    }

    function seek(sec) {
        if (!current() || !isFinite(sec)) return;
        var d = audio.duration;
        sec = Math.max(0, sec);
        if (isFinite(d) && d > 0) sec = Math.min(sec, Math.max(0, d - 0.1));
        if (audio.readyState >= 1) audio.currentTime = sec; else pendingSeek = sec;
        emit('time');
        updatePosition();
    }
    function seekBy(delta) { if (current()) seek((audio.currentTime || 0) + delta); }

    function onEnded() {
        if (isSilent()) return;
        if (state.repeat === 'one') {
            listened = 0; lastT = 0; counted = false;
            try { audio.currentTime = 0; } catch (e) { /* ignore */ }
            play();
        } else advance(true);
    }

    function onError() {
        if (unloading || isSilent()) return;
        var t = current();
        if (!t || !audio.getAttribute('src')) return;
        songFailed(t, 'Can\u2019t play \u201c' + t.title + '\u201d on this device');
    }


    /* ------------------------------------------------------------ queue */

    function releaseAll() {
        Object.keys(held).forEach(function (id) { cfg.releaseUrl(+id); });
        held = {};
    }

    /* Replace the queue with these library songs and start playing at startIndex.
       Call it straight from a tap. opts.shuffle: shuffle them (and turn shuffle on). */
    function setQueue(tracks, startIndex, opts) {
        opts = opts || {};
        unlockAudio();
        if (!tracks || !tracks.length) return;
        var wasShuffle = state.shuffle;
        state.shuffle = false; originalOrder = null;
        loadToken++;
        releaseAll();
        state.queue = tracks.map(toItem);
        failStreak = 0;
        var idx = opts.shuffle && startIndex == null ? Math.floor(Math.random() * state.queue.length) : clamp(startIndex | 0, 0, state.queue.length - 1);
        state.index = idx;
        if (wasShuffle || opts.shuffle) setShuffle(true); else emit('mode');
        emit('queue');
        loadIndex(state.index, true);
    }

    /* Add songs to the end of the queue (or right after the current one). */
    function addTracks(tracks, opts) {
        opts = opts || {};
        if (!tracks || !tracks.length) return 0;
        if (!state.queue.length) { setQueue(tracks, 0); return tracks.length; }
        var items = tracks.map(toItem);
        if (originalOrder) items.forEach(function (it) { originalOrder.push(it.id); });
        var at = opts.next && state.index > -1 ? state.index + 1 : state.queue.length;
        Array.prototype.splice.apply(state.queue, [at, 0].concat(items));
        if (state.index > -1 && at <= state.index) state.index += items.length;
        updateMediaSession();
        emit('queue');
        pruneUrls(); prefetchNext();
        return items.length;
    }

    function playIndex(i) { if (state.queue[i]) loadIndex(i, true); }

    function removeAt(i) {
        var t = state.queue[i];
        if (!t) return;
        var wasCurrent = i === state.index;
        var wasPlaying = wasCurrent && !audio.paused;
        state.queue.splice(i, 1);
        if (originalOrder) {
            var k = originalOrder.indexOf(t.id);
            if (k > -1) originalOrder.splice(k, 1);
        }
        if (i < state.index) state.index--;
        if (wasCurrent) {
            if (!state.queue.length) {
                unload(); state.index = -1; updateMediaSession(); emit('track'); emit('state'); emit('time');
            } else {
                var ni = Math.min(i, state.queue.length - 1);
                loadIndex(ni, wasPlaying && i < state.queue.length);   // don't wrap round to an earlier song
            }
        }
        pruneUrls(); prefetchNext();
        emit('queue');
    }

    /* The library trashed songs: drop them from the queue too. */
    function removeTrackIds(ids) {
        var set = {};
        ids.forEach(function (id) { set[id] = true; });
        for (var i = state.queue.length - 1; i >= 0; i--) if (set[state.queue[i].trackId]) removeAt(i);
    }

    function move(from, to) {
        var n = state.queue.length;
        if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
        var cur = current();
        var t = state.queue.splice(from, 1)[0];
        state.queue.splice(to, 0, t);
        if (cur) state.index = state.queue.indexOf(cur);
        updateMediaSession();
        emit('queue');
        pruneUrls(); prefetchNext();
    }

    function clear() {
        unload();
        releaseAll();
        state.queue = [];
        state.index = -1;
        originalOrder = state.shuffle ? [] : null;
        failStreak = 0;
        updateMediaSession();
        emit('queue'); emit('track'); emit('state'); emit('time');
    }


    /* ------------------------------------------------------------ modes */

    /* Shuffle really reorders the queue (like the original Google Play Music),
       so the queue panel always shows what will actually play. The song that is
       playing stays first. Turning it off restores the order songs were added. */
    function setShuffle(on) {
        on = !!on;
        if (on === state.shuffle) return;
        state.shuffle = on;
        var cur = current();
        if (on) {
            originalOrder = state.queue.map(function (t) { return t.id; });
            var rest = state.queue.filter(function (t) { return t !== cur; });
            shuffleArray(rest);
            state.queue = cur ? [cur].concat(rest) : rest;
            state.index = cur ? 0 : -1;
        } else {
            var byId = {};
            state.queue.forEach(function (t) { byId[t.id] = t; });
            var seen = {}, ordered = [];
            originalOrder.forEach(function (id) { if (byId[id]) { ordered.push(byId[id]); seen[id] = 1; } });
            state.queue.forEach(function (t) { if (!seen[t.id]) ordered.push(t); });
            state.queue = ordered;
            originalOrder = null;
            state.index = cur ? ordered.indexOf(cur) : -1;
        }
        updateMediaSession();
        emit('mode'); emit('queue');
        if (cur) { pruneUrls(); prefetchNext(); }
    }
    function toggleShuffle() { setShuffle(!state.shuffle); }

    function cycleRepeat() {
        state.repeat = state.repeat === 'off' ? 'all' : (state.repeat === 'all' ? 'one' : 'off');
        savePrefs();
        updateMediaSession();
        emit('mode');
    }

    function setVolume(v) {
        state.volume = clamp(Number(v) || 0, 0, 1);
        if (state.volume > 0 && state.muted) { state.muted = false; audio.muted = false; }
        try { audio.volume = state.volume; } catch (e) { /* iOS ignores volume */ }
        savePrefs();
        emit('volume');
    }
    function toggleMute() {
        state.muted = !state.muted;
        audio.muted = state.muted;
        emit('volume');
    }


    /* ------------------------------------------------------------ lock screen */

    var ART_URL = null;
    function iconUrl() {
        if (!ART_URL) { try { ART_URL = new URL('assets/icons/icon-512.png', document.baseURI).href; } catch (e) { ART_URL = ''; } }
        return ART_URL;
    }
    function setHandler(action, fn) {
        try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) { /* action not supported here */ }
    }

    function setMetadata(it, artSrc) {
        if (typeof MediaMetadata === 'undefined') return;
        var art = artSrc ? [{ src: artSrc, sizes: '512x512' }] : (iconUrl() ? [{ src: iconUrl(), sizes: '512x512', type: 'image/png' }] : []);
        navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: it.artist, album: it.album || 'Play Music', artwork: art });
    }

    function updateMediaSession() {
        if (!('mediaSession' in navigator)) return;
        var ms = navigator.mediaSession, it = current();
        if (!it) { ms.metadata = null; ms.playbackState = 'none'; return; }
        setMetadata(it, null);                                     // the app icon first, the album cover as soon as it is ready
        if (it.coverKey) {
            cfg.coverUrl(it.coverKey).then(function (u) { if (u && current() === it) setMetadata(it, u); }, function () { /* keep the icon */ });
        }
        // Greys out the lock-screen "next" button on the last song (unless repeating)
        var hasNext = state.index < state.queue.length - 1 || state.repeat === 'all';
        setHandler('nexttrack', hasNext ? function () { advance(false); } : null);
    }

    function updatePosition() {
        if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
        var d = audio.duration;
        if (!isFinite(d) || d <= 0 || isSilent()) return;
        try {
            navigator.mediaSession.setPositionState({
                duration: d, playbackRate: audio.playbackRate || 1, position: clamp(audio.currentTime || 0, 0, d)
            });
        } catch (e) { /* invalid values: skip */ }
    }

    function setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        setHandler('play', function () { play(); });
        setHandler('pause', function () { pause(); });
        setHandler('stop', function () { pause(); seek(0); });
        setHandler('previoustrack', function () { prev(); });
        setHandler('nexttrack', function () { advance(false); });
        setHandler('seekto', function (d) { if (d && typeof d.seekTime === 'number') seek(d.seekTime); });
    }


    /* ------------------------------------------------------------ audio events */

    function stateChanged() {
        if (isSilent()) return;
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = current() ? (audio.paused ? 'paused' : 'playing') : 'none';
        }
        updatePosition();
        emit('state');
    }

    audio.addEventListener('play', stateChanged);
    audio.addEventListener('pause', stateChanged);
    audio.addEventListener('waiting', function () { if (!isSilent()) emit('state'); });
    audio.addEventListener('canplay', function () { if (!isSilent()) emit('state'); });
    audio.addEventListener('playing', function () { if (isSilent()) return; failStreak = 0; stateChanged(); });
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('seeked', function () { if (isSilent()) return; lastT = audio.currentTime; updatePosition(); emit('time'); });
    audio.addEventListener('loadedmetadata', function () {
        if (isSilent()) return;
        if (pendingSeek !== null) { try { audio.currentTime = pendingSeek; } catch (e) { /* ignore */ } pendingSeek = null; }
    });
    audio.addEventListener('durationchange', function () {
        if (isSilent()) return;
        var t = current();
        if (t && isFinite(audio.duration) && audio.duration > 0 && t.duration !== audio.duration) {
            t.duration = audio.duration;
            emit('queue');
        }
        updatePosition();
        emit('time');
    });
    audio.addEventListener('timeupdate', function () {
        if (isSilent()) return;
        emit('time');
        // count a "play" once a song has really been listened to (not just skipped through)
        var t = audio.currentTime, dt = t - lastT;
        if (!audio.paused && dt > 0 && dt < 1.5) listened += dt;
        lastT = t;
        var it = current();
        if (it && !counted) {
            var d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 60;
            if (listened >= Math.min(30, d * 0.5)) { counted = true; emit('played', it); }
        }
        var now = Date.now();
        if (now - lastPosUpdate > 5000) { lastPosUpdate = now; updatePosition(); }
    });


    /* ------------------------------------------------------------ public API */

    function snapshot() {
        var cur = current(), d = audio.duration, silent = isSilent();
        return {
            queue: state.queue, index: state.index, current: cur,
            playing: !!cur && !audio.paused && !audio.ended && !silent || (!!cur && wantPlay),
            shuffle: state.shuffle, repeat: state.repeat, volume: state.volume, muted: state.muted,
            time: cur && !silent ? (audio.currentTime || 0) : 0,
            duration: (!silent && isFinite(d) && d > 0) ? d : (cur && isFinite(cur.duration) ? cur.duration : NaN)
        };
    }

    loadPrefs();
    setupMediaSession();

    global.Player = {
        on: on, configure: configure, getState: snapshot, hasTrack: function () { return !!current(); },
        setQueue: setQueue, addTracks: addTracks, playIndex: playIndex, removeAt: removeAt, removeTrackIds: removeTrackIds,
        move: move, clear: clear,
        play: play, pause: pause, toggle: toggle, next: next, prev: prev, seek: seek, seekBy: seekBy,
        setShuffle: setShuffle, toggleShuffle: toggleShuffle, cycleRepeat: cycleRepeat,
        setVolume: setVolume, toggleMute: toggleMute,
        _audio: audio   // for tests only
    };
})(window);
