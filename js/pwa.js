/* Registers the service worker so the app can open offline.
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
