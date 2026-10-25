/* Service worker: makes the app open offline.

   How it behaves
   - App files (same site): NETWORK FIRST. When you're online you always get the
     newest files, and a copy is saved. When you're offline (or the network is
     slower than 3 seconds and a saved copy exists) the saved copy is used.
     Because of this there is no "stale version" problem to manage.
   - Fonts and icons from Google: CACHE FIRST. Saved the first time, then reused.
   - Everything else passes straight through to the network.

   When to change VERSION
   Only when you ADD or REMOVE files in SHELL_FILES below (or change FONT_CSS).
   Editing the contents of an existing file does NOT need a version change.
   Changing VERSION throws away the old saved copies and rebuilds them.
*/
'use strict';

var VERSION = 'v2';
var SHELL_CACHE = 'gpm-shell-' + VERSION;
var FONT_CACHE = 'gpm-fonts-' + VERSION;
var NETWORK_TIMEOUT_MS = 3000;      // only used when a saved copy exists to fall back on
var FONT_PRECACHE_BUDGET_MS = 8000; // never let slow/blocked Google fonts hold up install

/* Every file the app needs to open with no network. './' is the page itself. */
var SHELL_FILES = [
    './',
    'manifest.webmanifest',
    'css/styles.css',
    'css/components.css',
    'css/ios.css',
    'js/app.js',
    'js/ui.js',
    'js/player.js',
    'js/player-ui.js',
    'js/pwa.js',
    'assets/icon.png',
    'assets/logo.png',
    'assets/icons/apple-touch-icon.png',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'assets/icons/icon-maskable-512.png'
];

/* These two URLs must match the <link> tags in index.html exactly.
   subsets: for Roboto we only save the 'latin' files up front (the other
   alphabets are saved on demand); null means save every file listed. */
var FONT_CSS = [
    { url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap', subsets: ['latin'] },
    { url: 'https://fonts.googleapis.com/icon?family=Material+Icons', subsets: null }
];
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

var scopePath = new URL(self.registration.scope).pathname;


/* ---------------------------------------------------------------- install */

self.addEventListener('install', function (event) {
    event.waitUntil((async function () {
        var shell = await caches.open(SHELL_CACHE);
        // cache:'reload' skips the browser's own HTTP cache so we save fresh copies
        await shell.addAll(SHELL_FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));

        // Fonts are best-effort: a failure or a slow network must never break install.
        await Promise.race([
            precacheFonts().catch(function () {}),
            new Promise(function (resolve) { setTimeout(resolve, FONT_PRECACHE_BUDGET_MS); })
        ]);

        await self.skipWaiting();
    })());
});

self.addEventListener('activate', function (event) {
    event.waitUntil((async function () {
        var keep = [SHELL_CACHE, FONT_CACHE];
        var names = await caches.keys();
        await Promise.all(names.filter(function (n) { return keep.indexOf(n) === -1; })
            .map(function (n) { return caches.delete(n); }));
        await self.clients.claim();
    })());
});


/* ------------------------------------------------------------------ fetch */

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    if (req.headers.has('range')) return;   // leave audio/video range requests alone

    var url = new URL(req.url);
    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(event));
    } else if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
        event.respondWith(cacheFirst(req));
    }
});

/* The page itself can be asked for as '/' or '/index.html'; save it under one key. */
function cacheKey(req) {
    if (req.mode === 'navigate') {
        var p = new URL(req.url).pathname;
        if (p === scopePath || p === scopePath + 'index.html') return './';
    }
    return req;
}

function cacheable(res) {
    return res && res.ok && res.type === 'basic';
}

async function networkFirst(event) {
    var req = event.request;
    var cache = await caches.open(SHELL_CACHE);
    var key = cacheKey(req);

    var saved = await cache.match(key, { ignoreSearch: true });
    if (!saved && req.mode === 'navigate') saved = await cache.match('./');

    // cache:'no-cache' = always check with the server (a quick 304 if unchanged),
    // so the browser's own HTTP cache can never hand us an out-of-date file.
    var net = fetch(req, { cache: 'no-cache' });
    // Whenever the network answers (even late), refresh the saved copy for next time.
    event.waitUntil(net.then(function (res) {
        if (cacheable(res)) return cache.put(key, res.clone());
    }).catch(function () {}));

    if (!saved) return net;   // nothing saved yet: just wait for the network

    try {
        return await Promise.race([
            net,
            new Promise(function (_, reject) {
                setTimeout(function () { reject(new Error('timeout')); }, NETWORK_TIMEOUT_MS);
            })
        ]);
    } catch (err) {
        return saved;         // offline, or too slow: use the saved copy
    }
}

async function cacheFirst(req) {
    var cache = await caches.open(FONT_CACHE);
    var hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    var res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
}


/* ------------------------------------------------------------------ fonts */

/* Pull the font file URLs out of a Google Fonts stylesheet.
   Roboto's CSS has one block per alphabet, each preceded by a comment such as
   "latin"; we keep only the alphabets listed in `subsets`. */
function fontUrlsFromCss(css, subsets) {
    var urls = [];
    var m;
    if (!subsets) {
        var all = /url\((['"]?)(https:[^)'"]+)\1\)/g;
        while ((m = all.exec(css))) urls.push(m[2]);
        return urls;
    }
    var block = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{[^}]*?url\((['"]?)(https:[^)'"]+)\2\)/g;
    while ((m = block.exec(css))) {
        if (subsets.indexOf(m[1]) !== -1) urls.push(m[3]);
    }
    return urls;
}

async function precacheFonts() {
    var cache = await caches.open(FONT_CACHE);
    for (var i = 0; i < FONT_CSS.length; i++) {
        var item = FONT_CSS[i];
        var res = await fetch(item.url);
        if (!res.ok) continue;
        var css = await res.clone().text();
        await cache.put(item.url, res);
        var files = fontUrlsFromCss(css, item.subsets);
        for (var j = 0; j < files.length; j++) {
            try {
                var f = await fetch(files[j]);
                if (f.ok) await cache.put(files[j], f);
            } catch (e) { /* skip this file; it will be saved on demand later */ }
        }
    }
}
