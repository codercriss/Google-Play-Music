/* ==========================================================================
   Player UI

   Connects the engine (js/player.js) to the page: the desktop player bar, the
   phone mini player, the full-screen player, the queue panel, the Add music
   screen and the keyboard shortcuts.

   Everything on screen is drawn FROM the engine's events, never from which
   button was tapped, so a lock-screen pause or a phone call shows up correctly.
   ========================================================================== */
(function () {
    'use strict';
    var P = window.Player;
    var mini = document.getElementById('mini-player');
    var qEl = document.getElementById('queue');
    if (!P || !mini || !qEl) return;

    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

    function toast(t) { if (window.showToast) window.showToast(t); }
    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmt(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        sec = Math.floor(sec);
        var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (s < 10 ? '0' : '') + s;
    }
    function fmtDur(sec) { return isFinite(sec) ? fmt(sec) : '\u2013:\u2013'; }

    /* The colour for a song with no cover is chosen by the library (one rule for the whole app). */
    function placeholderFor(t) {
        if (!window.Library) return '#bbb';
        return Library.placeholder(Library.seedOf({ title: t.title, artist: t.artist, albumArtist: t.albumArtist, album: t.album }));
    }

    function goAdd() {
        qEl.classList.remove('open');
        if (typeof closeFullscreenPlayer === 'function') closeFullscreenPlayer();
        if (typeof showView === 'function') showView('add');
    }


    /* ------------------------------------------------------------ elements */

    var el = {
        miniTitle: $('.track-title', mini), miniArtist: $('.track-artist', mini), miniTime: $('.track-time', mini),
        miniArt: $('.now-playing-img', mini), miniBar: $('#mini-progress'), miniFill: $('.progress-current', mini),
        headTitle: $('.fs-header .track-title'), headArtist: $('.fs-header .track-artist'), headArt: $('.fs-header .now-playing-img'),
        fsArt: $('.fs-artwork-img'), fsTitle: $('.fs-overlay-title'), fsArtist: $('.fs-overlay-artist'),
        fsBar: $('#fs-progress'), fsFill: $('.fs-overlay-progress-current'),
        fsCur: $('#fs-time-cur'), fsDur: $('#fs-time-dur')
    };
    function setText(node, text) { if (node && node.textContent !== text) node.textContent = text; }


    /* ------------------------------------------------------------ now playing */

    var lastArtKey = -1;
    function paintArt(track) {
        var cover = track && track.coverKey && window.Library ? Library.coverUrl(track.coverKey) : null;
        [[el.miniArt, 36], [el.headArt, 36], [el.fsArt, 120]].forEach(function (p) {
            var node = p[0];
            if (!node) return;
            if (cover) { node.style.background = 'url("' + cover + '") center / cover no-repeat'; node.innerHTML = ''; return; }
            node.style.background = track ? placeholderFor(track) : '#111';
            node.innerHTML = '<i class="material-icons" style="font-size:' + p[1] + 'px;color:rgba(255,255,255,' + (track ? '.9' : '.3') + ')">music_note</i>';
        });
    }
    function renderArt(track) {
        paintArt(track);
        // the colour cover shows at once; the real artwork swaps in as soon as it has loaded
        if (track && track.coverKey && window.Library && !Library.coverUrl(track.coverKey)) {
            Library.loadCover(track.coverKey).then(function (u) { if (u && P.getState().current === track) paintArt(track); });
        }
    }

    function renderTrack() {
        var s = P.getState(), t = s.current;
        var title = t ? t.title : 'Nothing playing';
        var artist = t ? t.artist : 'Add music to get started';
        setText(el.miniTitle, title);   setText(el.miniArtist, artist);
        setText(el.headTitle, title);   setText(el.headArtist, artist);
        setText(el.fsTitle, title);     setText(el.fsArtist, artist);
        var key = t ? t.id : 0;
        if (key !== lastArtKey) { lastArtKey = key; renderArt(t); }
        renderTime();
    }

    function renderState() {
        var s = P.getState();
        var icon = s.playing ? 'pause' : 'play_arrow';
        $$('[data-player="play"] .material-icons').forEach(function (i) { setText(i, icon); });
    }

    function renderMode() {
        var s = P.getState();
        $$('[data-player="shuffle"]').forEach(function (n) { n.classList.toggle('on', s.shuffle); });
        $$('[data-player="repeat"]').forEach(function (n) {
            n.classList.toggle('on', s.repeat !== 'off');
            setText(n, s.repeat === 'one' ? 'repeat_one' : 'repeat');
        });
    }

    function renderVolume() {
        var s = P.getState();
        var v = s.muted ? 0 : s.volume;
        setText($('[data-player="volume"]'), v === 0 ? 'volume_off' : (v < 0.4 ? 'volume_down' : 'volume_up'));
        var r = $('.vol-pop input[type=range]');
        if (r && document.activeElement !== r) r.value = Math.round(v * 100);
    }


    /* ------------------------------------------------------------ progress + seeking */

    var seeking = false, seekFrac = 0, lastPct = '';

    function renderTime() {
        var s = P.getState();
        var hasDur = isFinite(s.duration) && s.duration > 0;
        var frac = hasDur ? clamp(s.time / s.duration, 0, 1) : 0;
        if (seeking) frac = seekFrac;
        var time = seeking && hasDur ? seekFrac * s.duration : s.time;
        var pct = (frac * 100).toFixed(2) + '%';
        if (pct !== lastPct) {
            lastPct = pct;
            if (el.miniFill) el.miniFill.style.width = pct;
            if (el.fsFill) el.fsFill.style.width = pct;
        }
        var cur = fmt(time), dur = hasDur ? fmt(s.duration) : '0:00';
        setText(el.fsCur, cur);
        setText(el.fsDur, dur);
        setText(el.miniTime, s.current ? cur + ' / ' + dur : '');
    }

    function makeSeekable(bar, enabled) {
        if (!bar) return;
        var active = false;
        function fracAt(e) { var r = bar.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); }
        // The full-screen player closes on a downward swipe; dragging the bar must not count as one
        bar.addEventListener('touchstart', function (e) { if (enabled()) e.stopPropagation(); }, { passive: true });
        bar.addEventListener('pointerdown', function (e) {
            var s = P.getState();
            if (!enabled() || !s.current || !isFinite(s.duration) || s.duration <= 0) return;
            active = true; seeking = true; seekFrac = fracAt(e);
            try { bar.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
            e.preventDefault();
            renderTime();
        });
        bar.addEventListener('pointermove', function (e) { if (active) { seekFrac = fracAt(e); renderTime(); } });
        function finish(commit) {
            if (!active) return;
            active = false;
            if (commit) P.seek(seekFrac * P.getState().duration);
            seeking = false;
            renderTime();
        }
        bar.addEventListener('pointerup', function () { finish(true); });
        bar.addEventListener('pointercancel', function () { finish(false); });
    }
    var isPhoneLayout = function () { return typeof isMobile === 'function' && isMobile(); };
    makeSeekable(el.miniBar, function () { return !isPhoneLayout(); });   // on a phone the thin mini bar just opens the full player
    makeSeekable(el.fsBar, function () { return true; });

    // Smooth progress while playing (timeupdate alone only ticks about 4 times a second)
    var raf = 0;
    function loop() {
        raf = 0;
        renderTime();
        if (P.getState().playing && !document.hidden) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { renderTime(); kick(); } });


    /* ------------------------------------------------------------ queue panel
       Desktop: a panel above the player bar. Phone: a bottom sheet with a dimmed backdrop
       (drag its top down to close; drag a song's handle to reorder; swipe a song left to remove). */

    var qList = $('.list', qEl), qSub = $('.q-head-sub', qEl), qNow = $('#q-now', qEl);
    var dragging = false, renderPending = false, swipedAt = 0;
    var HINT_KEY = 'gpm.qhint';

    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    function totalLabel(items) {
        var sec = items.reduce(function (n, t) { return n + (isFinite(t.duration) ? t.duration : 0); }, 0);
        if (!sec) return '';
        var m = Math.round(sec / 60);
        return ' \u00b7 ' + (m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60) + ' min' : Math.max(1, m) + ' min');
    }

    /* The rows are only built while the panel is open. Building thousands of them on every tap on a
       song would delay the music for nothing, because nobody can see a closed panel. */
    var qDirty = true;
    function renderQueue() {
        var s = P.getState(), n = s.queue.length;
        setText(qSub, n ? plural(n, 'song') + totalLabel(s.queue) : '');
        if (dragging) { renderPending = true; return; }
        if (n && !qEl.classList.contains('open')) { qDirty = true; return; }       // built when it is opened
        buildQueue(s);
    }
    function buildQueue(s) {
        var n = s.queue.length;
        qDirty = false;
        markedIndex = -2;                                    // new rows: mark them all
        if (!n) {
            qList.innerHTML = '<div class="q-empty">Your queue is empty.<br><button class="btn-solid" data-act="add-music">Add music</button></div>';
        } else {
            qList.innerHTML = s.queue.map(function (t, i) {
                return '<div class="q-row' + (t.failed ? ' failed' : '') + '" data-i="' + i + '"><div class="q-in">' +
                    '<span class="q-art" data-cover="' + esc(t.coverKey) + '" style="background:' + placeholderFor(t) + '">' +
                        '<i class="material-icons">music_note</i><span class="q-eq"><i></i><i></i><i></i></span></span>' +
                    '<div class="q-main"><div class="q-title">' + esc(t.title) + '</div><small>' + esc(t.artist) + '</small></div>' +
                    '<span class="q-time">' + (t.failed ? 'can\u2019t play' : fmtDur(t.duration)) + '</span>' +
                    '<span class="q-x" data-act="remove" title="Remove"><i class="material-icons">close</i></span>' +
                    '<span class="q-handle" title="Drag to reorder"><i class="material-icons">drag_handle</i></span></div></div>';
            }).join('');
            if (window.hydrateCovers) window.hydrateCovers(qList);
        }
        markNow();
    }

    /* Cheap update for "the song changed": only the rows between the old and the new position are
       touched (two rows for a normal "next"), however long the queue is. */
    var markedIndex = -2;                                        // -2: the rows are new, so mark every one
    function markNow() {
        var s = P.getState(), rows = qList.children, n = rows.length, idx = s.index;
        if (n && rows[0].classList.contains('q-row')) {
            var lo = 0, hi = n - 1;
            if (markedIndex !== -2) {
                if (idx === markedIndex) { lo = 1; hi = 0; }     // nothing moved
                else { lo = Math.max(0, Math.min(idx, markedIndex)); hi = Math.min(n - 1, Math.max(idx, markedIndex)); }
            }
            for (var i = lo; i <= hi; i++) {
                rows[i].classList.toggle('now', i === idx);
                rows[i].classList.toggle('past', i < idx);
            }
            markedIndex = idx;
        }
        qEl.classList.toggle('playing', s.playing);
        updatePill();
    }

    function scrollToNow(smooth) {
        if (!qEl.classList.contains('open')) return;
        var n = $('.q-row.now', qList);
        if (n && n.scrollIntoView) n.scrollIntoView({ block: isPhoneLayout() ? 'center' : 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    }

    /* "Now playing" pill: only when the playing song is out of view */
    var pillFrame = 0;
    function updatePill() {
        if (!qNow) return;
        cancelAnimationFrame(pillFrame);
        pillFrame = requestAnimationFrame(function () {
            var row = $('.q-row.now', qList);
            if (!row || !qEl.classList.contains('open')) { qNow.classList.remove('show'); return; }
            var a = row.getBoundingClientRect(), b = qList.getBoundingClientRect();
            var above = a.bottom < b.top + 8, below = a.top > b.bottom - 8;
            qNow.classList.toggle('show', above || below);
            setText($('.material-icons', qNow), above ? 'arrow_upward' : 'arrow_downward');
        });
    }
    qList.addEventListener('scroll', updatePill, { passive: true });
    if (qNow) qNow.addEventListener('click', function () { scrollToNow(true); });

    function hintSeen() {
        try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* ignore */ }
        qEl.classList.add('no-hint');
    }
    try { if (localStorage.getItem(HINT_KEY) === '1') qEl.classList.add('no-hint'); } catch (e) { /* ignore */ }

    /* Backdrop (phone) + what happens whenever the panel opens or closes, however it was toggled */
    var backdrop = document.createElement('div');
    backdrop.className = 'q-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function () { qEl.classList.remove('open'); });
    var wasOpen = false;
    new MutationObserver(function () {
        var open = qEl.classList.contains('open');
        backdrop.classList.toggle('show', open);
        if (open && !wasOpen) setTimeout(function () {
            if (qDirty) buildQueue(P.getState());
            scrollToNow(false); updatePill();
        }, 0);
        wasOpen = open;
        updatePill();
    }).observe(qEl, { attributes: true, attributeFilter: ['class'] });

    qList.addEventListener('click', function (e) {
        if (Date.now() - swipedAt < 400) return;                         // a swipe also ends in a click: ignore it
        if (e.target.closest('[data-act="add-music"]')) { goAdd(); return; }
        var row = e.target.closest('.q-row');
        if (!row) return;
        var i = +row.dataset.i;
        if (e.target.closest('.q-x')) { P.removeAt(i); return; }
        if (e.target.closest('.q-handle')) return;
        if (i === P.getState().index) P.toggle(); else P.playIndex(i);
    });

    var clearLink = $('#q-clear');
    if (clearLink) clearLink.addEventListener('click', function () {
        if (P.getState().queue.length) { P.clear(); toast('Queue cleared'); }
    });

    /* Drag a song by its handle to reorder (mouse and touch). */
    qList.addEventListener('pointerdown', function (e) {
        var handle = e.target.closest('.q-handle');
        var row = handle && handle.closest('.q-row');
        if (!row) return;
        var rows = $$('.q-row', qList);
        if (rows.length < 2) return;
        e.preventDefault();

        var from = rows.indexOf(row), to = from, startY = e.clientY;
        var rects = rows.map(function (r) { var b = r.getBoundingClientRect(); return { mid: b.top + b.height / 2, h: b.height }; });
        var h = rects[from].h;
        dragging = true;
        row.classList.add('dragging');
        rows.forEach(function (r) { if (r !== row) r.classList.add('shifting'); });
        try { handle.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }

        function onMove(ev) {
            var dy = ev.clientY - startY;
            row.style.transform = 'translateY(' + dy + 'px)';
            var centre = rects[from].mid + dy, t = 0;
            rects.forEach(function (r, j) { if (j !== from && r.mid < centre) t++; });
            to = t;
            rows.forEach(function (r, j) {
                if (j === from) return;
                var shift = 0;
                if (from < to && j > from && j <= to) shift = -h;
                else if (to < from && j >= to && j < from) shift = h;
                r.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
            });
        }
        function end(commit) {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onCancel);
            try { handle.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
            rows.forEach(function (r) { r.style.transform = ''; r.classList.remove('shifting', 'dragging'); });
            dragging = false;
            var stale = renderPending;
            renderPending = false;
            if (commit && to !== from) { hintSeen(); P.move(from, to); }   // emits 'queue', which redraws
            else if (stale) renderQueue();
        }
        function onUp() { end(true); }
        function onCancel() { end(false); }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onCancel);
    });

    /* Phone: swipe a song to the left to remove it. */
    var swipe = null;
    qList.addEventListener('pointerdown', function (e) {
        if (!isPhoneLayout() || e.pointerType === 'mouse' || e.target.closest('.q-handle')) return;
        var row = e.target.closest('.q-row');
        if (!row) return;
        swipe = { row: row, inner: row.firstElementChild, x: e.clientX, y: e.clientY, id: e.pointerId, mode: '', dx: 0 };
    });
    qList.addEventListener('pointermove', function (e) {
        var sw = swipe;
        if (!sw || e.pointerId !== sw.id) return;
        var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        if (!sw.mode) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            sw.mode = (dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.5) ? 'swipe' : 'scroll';      // decide once: sideways swipe, or let it scroll
            if (sw.mode === 'swipe') {
                sw.row.classList.add('swiping'); sw.inner.style.transition = 'none';
                try { qList.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
            }
        }
        if (sw.mode === 'swipe') { sw.dx = Math.min(0, dx); sw.inner.style.transform = 'translateX(' + sw.dx + 'px)'; }
    });
    function endSwipe(commit) {
        var sw = swipe;
        swipe = null;
        if (!sw || sw.mode !== 'swipe') return;
        swipedAt = Date.now();
        var go = commit && sw.dx < -Math.max(90, sw.row.offsetWidth * 0.3);
        sw.inner.style.transition = 'transform .18s ease';
        sw.inner.style.transform = go ? 'translateX(-105%)' : '';
        setTimeout(function () {
            if (go) { hintSeen(); P.removeAt(+sw.row.dataset.i); }
            else { sw.row.classList.remove('swiping'); sw.inner.style.transition = ''; }
        }, go ? 170 : 200);
    }
    qList.addEventListener('pointerup', function () { endSwipe(true); });
    qList.addEventListener('pointercancel', function () { endSwipe(false); });

    /* Phone: drag the sheet's top edge down to close it. */
    var sheet = null;
    qEl.addEventListener('pointerdown', function (e) {
        if (!isPhoneLayout() || !e.target.closest('.q-grab, .pop-head') || e.target.closest('a')) return;
        sheet = { y: e.clientY, id: e.pointerId, dy: 0, t: Date.now() };
        qEl.style.transition = 'none';
        try { qEl.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    });
    qEl.addEventListener('pointermove', function (e) {
        if (!sheet || e.pointerId !== sheet.id) return;
        sheet.dy = Math.max(0, e.clientY - sheet.y);
        qEl.style.transform = 'translateY(' + sheet.dy + 'px)';
    });
    function endSheet(commit) {
        if (!sheet) return;
        var d = sheet;
        sheet = null;
        qEl.style.transition = '';
        qEl.style.transform = '';
        if (commit && (d.dy > 90 || (d.dy > 30 && Date.now() - d.t < 250))) qEl.classList.remove('open');
    }
    qEl.addEventListener('pointerup', function () { endSheet(true); });
    qEl.addEventListener('pointercancel', function () { endSheet(false); });

    function toggleQueue() { qEl.classList.toggle('open'); }


    /* ------------------------------------------------------------ buttons + keys */

    document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-player]');
        if (b) {
            switch (b.dataset.player) {
                case 'play': P.toggle(); break;
                case 'next': P.next(); break;
                case 'prev': P.prev(); break;
                case 'shuffle': P.toggleShuffle(); break;
                case 'repeat': P.cycleRepeat(); break;
                case 'queue': toggleQueue(); break;
            }
            return;
        }
        // The sample songs on the Library and playlist screens have no audio
        var row = e.target.closest('.song-row');
        if (row && !row.hasAttribute('data-track') && !e.target.closest('.kebab, .trash-btns, button')) {
            toast('That\u2019s a sample song. Add your own music to play it.');
        }
    });

    // On a computer, tapping the empty player bar takes you to Add music (phones: app.js does this)
    mini.addEventListener('click', function (e) {
        if (isPhoneLayout() || P.hasTrack()) return;
        if (e.target.closest('.player-left')) goAdd();
    });

    document.addEventListener('input', function (e) {
        if (e.target.matches && e.target.matches('.vol-pop input[type=range]')) P.setVolume(e.target.value / 100);
    });
    var volIcon = $('[data-player="volume"]');
    if (volIcon) volIcon.addEventListener('click', function () { renderVolume(); });   // slider is built by ui.js just before this runs

    document.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target, tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
        if (!P.hasTrack()) return;
        switch (e.key) {
            case ' ':
            case 'Spacebar':
                if (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A') return;
                P.toggle(); e.preventDefault(); break;
            case 'ArrowRight': if (e.shiftKey) P.next(); else P.seekBy(5); e.preventDefault(); break;
            case 'ArrowLeft': if (e.shiftKey) P.prev(); else P.seekBy(-5); e.preventDefault(); break;
            case 'm': case 'M': P.toggleMute(); break;
        }
    });


    /* ------------------------------------------------------------ wire the engine's events */

    P.on('track', function () { renderTrack(); markNow(); scrollToNow(); });
    P.on('queue', renderQueue);
    P.on('state', function () { renderState(); kick(); qEl.classList.toggle('playing', P.getState().playing); });
    P.on('time', renderTime);
    P.on('mode', renderMode);
    P.on('volume', renderVolume);
    P.on('message', toast);
    P.on('needmusic', function () { toast('Add some music first'); goAdd(); });

    renderTrack(); renderState(); renderMode(); renderVolume(); renderQueue();
})();
