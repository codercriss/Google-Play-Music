/* ==========================================================================
   Player engine

   Owns the ONE audio element for the whole app, the queue, shuffle/repeat,
   and the lock-screen controls (Media Session). It never touches the page:
   js/player-ui.js listens to the events below and draws everything.

   Why one audio element: iOS only lets audio start from a tap, and it
   remembers that permission per element. Re-using one element is what lets
   the next song start by itself, and keep playing with the screen locked.

   Events (Player.on(name, fn)):
     'track'    the current song changed (or there is none)
     'state'    playing / paused / loading changed
     'time'     position or duration changed
     'queue'    the queue list changed
     'mode'     shuffle or repeat changed
     'volume'   volume or mute changed
     'message'  text to show the person (fn receives the string)
     'needmusic' play was pressed with nothing to play
   ========================================================================== */
(function (global) {
    'use strict';

    var audio = new Audio();
    audio.preload = 'auto';

    var state = { queue: [], index: -1, shuffle: false, repeat: 'off', volume: 1, muted: false };
    var originalOrder = null;    // ids in the order they were added; non-null exactly when shuffle is on
    var nextId = 1;
    var handlers = {};
    var failStreak = 0;          // songs in a row that couldn't be played
    var pendingSeek = null;      // a seek requested before the file's length is known
    var unloading = false;       // true while we deliberately empty the audio element
    var lastPosUpdate = 0;
    var PREF_KEY = 'gpm.player.v1';
    var AUDIO_EXT = /\.(mp3|m4a|m4b|aac|wav|flac|ogg|oga|opus|caf|aif|aiff)$/i;


    /* ------------------------------------------------------------ helpers */

    function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
    function emit(type, arg) {
        (handlers[type] || []).slice().forEach(function (fn) {
            try { fn(arg); } catch (e) { console.error('Player handler error:', e); }
        });
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function current() { return state.queue[state.index] || null; }

    function shuffleArray(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function isAudioFile(f) {
        return (f.type && f.type.indexOf('audio') === 0) || AUDIO_EXT.test(f.name || '');
    }

    /* "Artist - Title.mp3" -> artist and title. Real tags come in a later phase. */
    function parseName(filename) {
        var base = String(filename || '').replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
        base = base.replace(/^\d{1,3}\s*[-._)]\s*/, '');          // "01 - ", "1. ", "03) "
        var m = base.match(/^(.+?)\s+[-\u2013\u2014]\s+(.+)$/);
        if (m) return { artist: m[1].trim(), title: m[2].trim() };
        return { artist: 'Unknown artist', title: base || filename };
    }

    function makeTrack(file) {
        var n = parseName(file.name);
        return {
            id: nextId++, name: file.name, title: n.title, artist: n.artist, album: '',
            url: URL.createObjectURL(file), duration: NaN, failed: false
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


    /* ------------------------------------------------------------ loading */

    function loadIndex(i, autoplay) {
        var t = state.queue[i];
        if (!t) return;
        state.index = i;
        pendingSeek = null;
        audio.src = t.url;                    // starts loading
        updateMediaSession();
        emit('track');
        emit('time');
        if (autoplay) play(); else emit('state');
    }

    function unload() {
        unloading = true;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        unloading = false;
    }

    /* Find each song's length by loading just its header, one at a time. */
    function probeDurations(tracks) {
        var list = tracks.slice();
        (function step() {
            var t = list.shift();
            if (!t) return;
            if (isFinite(t.duration)) { step(); return; }
            var a = new Audio(), done = false, timer;
            function finish() {
                if (done) return;
                done = true; clearTimeout(timer);
                a.removeAttribute('src'); a.load();
                step();
            }
            a.preload = 'metadata';
            a.addEventListener('loadedmetadata', function () {
                if (isFinite(a.duration) && a.duration > 0) { t.duration = a.duration; emit('queue'); }
                finish();
            });
            a.addEventListener('error', finish);
            timer = setTimeout(finish, 4000);
            a.src = t.url;
        })();
    }


    /* ------------------------------------------------------------ playback */

    function play() {
        if (!current()) {
            if (state.queue.length) loadIndex(0, true);
            else emit('needmusic');
            return;
        }
        var p = audio.play();
        if (p && p.catch) {
            p.catch(function (err) {
                // iOS can refuse to start audio that wasn't triggered by a tap
                if (err && err.name === 'NotAllowedError') emit('message', 'Tap play to start');
                // AbortError (a newer song replaced this one) and NotSupportedError (handled by the 'error' event) are ignored
            });
        }
    }
    function pause() { audio.pause(); }
    function toggle() {
        if (!current()) { play(); return; }
        if (audio.paused) play(); else audio.pause();
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
        if (state.repeat === 'one') { try { audio.currentTime = 0; } catch (e) { /* ignore */ } play(); }
        else advance(true);
    }

    function onError() {
        if (unloading) return;
        var t = current();
        if (!t || !audio.getAttribute('src')) return;
        t.failed = true;
        emit('message', 'Can\u2019t play \u201c' + t.title + '\u201d on this device');
        emit('queue');
        emit('state');
        failStreak++;
        if (failStreak >= state.queue.length) { failStreak = 0; return; }   // everything failed: stop trying
        if (state.index + 1 < state.queue.length || state.repeat === 'all') {
            setTimeout(function () { if (current() === t) advance(false); }, 600);
        }
    }


    /* ------------------------------------------------------------ queue */

    function addFiles(fileList, opts) {
        opts = opts || {};
        var files = Array.prototype.slice.call(fileList || []);
        var tracks = [], skipped = 0;
        files.forEach(function (f) { if (isAudioFile(f)) tracks.push(makeTrack(f)); else skipped++; });
        if (!tracks.length) return { added: 0, skipped: skipped };

        var wasEmpty = state.queue.length === 0;
        if (originalOrder) tracks.forEach(function (t) { originalOrder.push(t.id); });

        var toInsert = tracks.slice();
        if (state.shuffle && wasEmpty) shuffleArray(toInsert);     // shuffle is on: first batch plays in random order

        var at = opts.next && state.index > -1 ? state.index + 1 : state.queue.length;
        Array.prototype.splice.apply(state.queue, [at, 0].concat(toInsert));
        if (state.index > -1 && at <= state.index) state.index += toInsert.length;

        emit('queue');
        if (wasEmpty || opts.play) loadIndex(at, true);
        probeDurations(tracks);
        return { added: tracks.length, skipped: skipped };
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
        URL.revokeObjectURL(t.url);
        emit('queue');
    }

    function move(from, to) {
        var n = state.queue.length;
        if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
        var cur = current();
        var t = state.queue.splice(from, 1)[0];
        state.queue.splice(to, 0, t);
        if (cur) state.index = state.queue.indexOf(cur);
        emit('queue');
    }

    function clear() {
        unload();
        state.queue.forEach(function (t) { URL.revokeObjectURL(t.url); });
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
    function artUrl() {
        if (!ART_URL) { try { ART_URL = new URL('assets/icons/icon-512.png', document.baseURI).href; } catch (e) { ART_URL = ''; } }
        return ART_URL;
    }

    function setHandler(action, fn) {
        try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) { /* action not supported here */ }
    }

    function updateMediaSession() {
        if (!('mediaSession' in navigator)) return;
        var ms = navigator.mediaSession, t = current();
        if (!t) { ms.metadata = null; ms.playbackState = 'none'; return; }
        if (typeof MediaMetadata !== 'undefined') {
            ms.metadata = new MediaMetadata({
                title: t.title, artist: t.artist, album: t.album || 'Play Music',
                artwork: artUrl() ? [{ src: artUrl(), sizes: '512x512', type: 'image/png' }] : []
            });
        }
        // Greys out the lock-screen "next" button on the last song (unless repeating)
        var hasNext = state.index < state.queue.length - 1 || state.repeat === 'all';
        setHandler('nexttrack', hasNext ? function () { advance(false); } : null);
    }

    function updatePosition() {
        if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
        var d = audio.duration;
        if (!isFinite(d) || d <= 0) return;
        try {
            navigator.mediaSession.setPositionState({
                duration: d, playbackRate: audio.playbackRate || 1, position: clamp(audio.currentTime || 0, 0, d)
            });
        } catch (e) { /* invalid values: skip */ }
    }

    function setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        setHandler('play', function () { play(); });
        setHandler('pause', function () { audio.pause(); });
        setHandler('stop', function () { audio.pause(); seek(0); });
        setHandler('previoustrack', function () { prev(); });
        setHandler('nexttrack', function () { advance(false); });
        setHandler('seekto', function (d) { if (d && typeof d.seekTime === 'number') seek(d.seekTime); });
    }


    /* ------------------------------------------------------------ audio events */

    function stateChanged() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = current() ? (audio.paused ? 'paused' : 'playing') : 'none';
        }
        updatePosition();
        emit('state');
    }

    audio.addEventListener('play', stateChanged);
    audio.addEventListener('pause', stateChanged);
    audio.addEventListener('waiting', function () { emit('state'); });
    audio.addEventListener('canplay', function () { emit('state'); });
    audio.addEventListener('playing', function () { failStreak = 0; stateChanged(); });
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('seeked', function () { updatePosition(); emit('time'); });
    audio.addEventListener('loadedmetadata', function () {
        if (pendingSeek !== null) { try { audio.currentTime = pendingSeek; } catch (e) { /* ignore */ } pendingSeek = null; }
    });
    audio.addEventListener('durationchange', function () {
        var t = current();
        if (t && isFinite(audio.duration) && audio.duration > 0 && t.duration !== audio.duration) {
            t.duration = audio.duration;
            emit('queue');
        }
        updatePosition();
        emit('time');
    });
    audio.addEventListener('timeupdate', function () {
        emit('time');
        var now = Date.now();
        if (now - lastPosUpdate > 5000) { lastPosUpdate = now; updatePosition(); }
    });


    /* ------------------------------------------------------------ public API */

    function snapshot() {
        var cur = current(), d = audio.duration;
        return {
            queue: state.queue, index: state.index, current: cur,
            playing: !!cur && !audio.paused && !audio.ended,
            shuffle: state.shuffle, repeat: state.repeat, volume: state.volume, muted: state.muted,
            time: cur ? (audio.currentTime || 0) : 0,
            duration: (isFinite(d) && d > 0) ? d : (cur && isFinite(cur.duration) ? cur.duration : NaN)
        };
    }

    loadPrefs();
    setupMediaSession();

    global.Player = {
        on: on, getState: snapshot, hasTrack: function () { return !!current(); },
        addFiles: addFiles, playIndex: playIndex, removeAt: removeAt, move: move, clear: clear,
        play: play, pause: pause, toggle: toggle, next: next, prev: prev, seek: seek, seekBy: seekBy,
        setShuffle: setShuffle, toggleShuffle: toggleShuffle, cycleRepeat: cycleRepeat,
        setVolume: setVolume, toggleMute: toggleMute,
        _audio: audio   // for tests only
    };
})(window);
