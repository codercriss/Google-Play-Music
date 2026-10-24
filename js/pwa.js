/* PWA helpers: (1) registers the service worker so the app opens offline,
   (2) measures the iOS 26 "bottom strip" bug so the layout can adapt,
   (3) a hidden diagnostic panel for checking real iPhone numbers. */


/* ---------------------------------------------------------------- 1. offline
   Service workers only run on https:// (or localhost), so this quietly does
   nothing when index.html is opened straight from disk. */
(function () {
    if (!('serviceWorker' in navigator)) return;
    var h = location.hostname;
    var ok = location.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1';
    if (!ok) return;

    window.addEventListener('load', function () {
        // updateViaCache:'none' makes the browser always check sw.js for changes
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function (err) {
            console.warn('Service worker could not be registered:', err);
        });
    });
})();


/* ------------------------------------------------- 2. iOS 26 bottom-strip bug
   In an installed iPhone app with a see-through status bar, iOS 26 can make the
   page area shorter than the screen (by the status-bar height). Nothing can be
   drawn in the leftover strip at the bottom.

   We measure it: strip = screen height - visible page height. The result goes
   into the CSS variable --ios-gap, and css/ios.css uses it so the bottom bar
   doesn't add extra padding on top of the strip. If iOS gives the full height
   back (or isn't affected) the strip is 0 and nothing changes. */
(function () {
    if (!/iPhone/.test(navigator.userAgent)) return;   // iPhones only
    var root = document.documentElement;

    function standalone() {
        return navigator.standalone === true ||
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    }
    function typing() {
        var a = document.activeElement;
        return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    }
    function stripHeight() {
        if (!standalone()) return 0;
        var longSide = Math.max(screen.width, screen.height);
        var shortSide = Math.min(screen.width, screen.height);
        var portrait = window.innerHeight >= window.innerWidth;   // iOS never swaps screen.width/height
        var gap = (portrait ? longSide : shortSide) - window.innerHeight;
        return (gap > 0 && gap <= 100) ? gap : 0;                 // ignore nonsense values
    }
    function update() {
        if (typing()) return;                                     // keyboard can disturb sizes
        root.style.setProperty('--ios-gap', stripHeight() + 'px');
    }

    update();
    ['resize', 'orientationchange', 'pageshow', 'load'].forEach(function (ev) {
        window.addEventListener(ev, function () {
            update();
            setTimeout(update, 300);    // iOS settles its sizes a moment after a change
        });
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) update(); });
    // iOS can take a moment to hand over the final height after launch
    [150, 500, 1200, 2500].forEach(function (ms) { setTimeout(update, ms); });
})();


/* ------------------------------------------------ 3. hidden diagnostic panel
   Open it: menu, then tap the "Google Play music" title 5 times quickly.
   (Or add ?debug to the address on a computer.) Tap the panel to close it.
   Shows the numbers needed to pin down iPhone layout problems. */
(function () {
    var taps = 0, timer = null;

    function measure(prop, value) {
        var p = document.createElement('div');
        p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;';
        p.style[prop] = value;
        document.body.appendChild(p);
        var cs = getComputedStyle(p);
        var out = prop === 'height' ? p.getBoundingClientRect().height : parseFloat(cs.paddingTop);
        p.remove();
        return Math.round(out * 10) / 10;
    }
    function rectOf(sel) {
        var e = document.querySelector(sel);
        if (!e) return 'n/a';
        var r = e.getBoundingClientRect();
        return Math.round(r.top) + '..' + Math.round(r.bottom);
    }
    function text() {
        var standalone = navigator.standalone === true ||
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        var gapVar = getComputedStyle(document.documentElement).getPropertyValue('--ios-gap').trim() || 'unset';
        return [
            'PLAY MUSIC DIAGNOSTICS  (tap to close)',
            'installed app : ' + standalone,
            'screen        : ' + screen.width + ' x ' + screen.height,
            'inner         : ' + window.innerWidth + ' x ' + window.innerHeight,
            '100dvh/svh/lvh: ' + measure('height', '100dvh') + ' / ' + measure('height', '100svh') + ' / ' + measure('height', '100lvh'),
            'safe top/bottom: ' + measure('paddingTop', 'env(safe-area-inset-top)') + ' / ' + measure('paddingTop', 'env(safe-area-inset-bottom)'),
            'strip (--ios-gap): ' + gapVar,
            'strip, measured : ' + (screen.height - window.innerHeight),
            'bottom nav top..bottom : ' + rectOf('.mobile-bottom-nav'),
            'mini player top..bottom: ' + rectOf('#mini-player'),
            'html min-height: ' + getComputedStyle(document.documentElement).minHeight
        ].join('\n');
    }
    function toggle() {
        var el = document.getElementById('ios-debug');
        if (el) { el.remove(); return; }
        el = document.createElement('pre');
        el.id = 'ios-debug';
        el.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top, 0px) + 72px);' +
            'z-index:100000;margin:0;padding:10px;border-radius:8px;background:rgba(0,0,0,.85);color:#7CFC00;' +
            'font:11px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;';
        el.textContent = text();
        el.addEventListener('click', function () { el.remove(); });
        document.body.appendChild(el);
    }

    document.addEventListener('click', function (e) {
        if (!e.target.closest || !e.target.closest('.sidebar-drawer-header .logo')) return;
        taps++;
        clearTimeout(timer);
        timer = setTimeout(function () { taps = 0; }, 2500);
        if (taps >= 5) { taps = 0; toggle(); }
    });
    if (/[?&]debug\b/.test(location.search)) window.addEventListener('load', toggle);
})();
