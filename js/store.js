/* ==========================================================================
   Store: the browser database (IndexedDB) that keeps your songs on the device

   Three tables, kept apart so listing your library never loads any audio:
     tracks   one small record of information per song
     blobs    the audio file itself, by the same id
     covers   one cover image per album, by album key

   Everything returns promises. Nothing here knows about screens or playback.
   ========================================================================== */
(function (global) {
    'use strict';

    var DB_NAME = 'gpm-library';
    var DB_VERSION = 1;
    var dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve, reject) {
            if (!global.indexedDB) { reject(new Error('This browser cannot save songs (no IndexedDB).')); return; }
            var req;
            try { req = global.indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
            req.onupgradeneeded = function () {
                var db = req.result;
                if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers', { keyPath: 'key' });
            };
            req.onsuccess = function () {
                var db = req.result;
                db.onversionchange = function () { db.close(); dbPromise = null; };   // another tab upgraded: let it
                resolve(db);
            };
            req.onerror = function () { dbPromise = null; reject(req.error || new Error('Could not open the song database')); };
            req.onblocked = function () { /* another tab holds an old version; the open waits */ };
        });
        return dbPromise;
    }

    function reqP(req) {
        return new Promise(function (resolve, reject) {
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    /* Run work(tx) in one transaction; resolves when the whole transaction is safely committed. */
    function run(stores, mode, work) {
        return open().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx;
                try { tx = db.transaction(stores, mode); } catch (e) { reject(e); return; }
                var result;
                tx.oncomplete = function () { resolve(result); };
                tx.onerror = function () { reject(tx.error); };
                tx.onabort = function () { reject(tx.error || new Error('The save was cancelled')); };
                try { result = work(tx); } catch (e) { reject(e); try { tx.abort(); } catch (x) { /* ignore */ } }
            });
        });
    }

    function getAllTracks() {
        return open().then(function (db) { return reqP(db.transaction('tracks', 'readonly').objectStore('tracks').getAll()); });
    }

    /* One song in, atomically: its record, its audio, and (optionally) its cover. */
    function addTrack(meta, blob, cover) {
        return run(['tracks', 'blobs', 'covers'], 'readwrite', function (tx) {
            tx.objectStore('tracks').put(meta);
            tx.objectStore('blobs').put({ id: meta.id, blob: blob });
            if (cover) tx.objectStore('covers').put({ key: cover.key, blob: cover.blob });
        });
    }

    function updateTracks(metas) {
        if (!metas.length) return Promise.resolve();
        return run('tracks', 'readwrite', function (tx) {
            var s = tx.objectStore('tracks');
            metas.forEach(function (m) { s.put(m); });
        });
    }

    function getBlob(id) {
        return open().then(function (db) { return reqP(db.transaction('blobs', 'readonly').objectStore('blobs').get(id)); })
            .then(function (rec) { return rec ? rec.blob : null; });
    }
    function getCover(key) {
        return open().then(function (db) { return reqP(db.transaction('covers', 'readonly').objectStore('covers').get(key)); })
            .then(function (rec) { return rec ? rec.blob : null; });
    }

    function deleteTracks(ids) {
        if (!ids.length) return Promise.resolve();
        return run(['tracks', 'blobs'], 'readwrite', function (tx) {
            ids.forEach(function (id) { tx.objectStore('tracks').delete(id); tx.objectStore('blobs').delete(id); });
        });
    }
    function deleteCovers(keys) {
        if (!keys.length) return Promise.resolve();
        return run('covers', 'readwrite', function (tx) { keys.forEach(function (k) { tx.objectStore('covers').delete(k); }); });
    }
    function clearAll() {
        return run(['tracks', 'blobs', 'covers'], 'readwrite', function (tx) {
            tx.objectStore('tracks').clear(); tx.objectStore('blobs').clear(); tx.objectStore('covers').clear();
        });
    }

    /* How much room is used / left, and whether the browser promises not to clear it. */
    function estimate() {
        var s = global.navigator && navigator.storage;
        if (!s || !s.estimate) return Promise.resolve({ usage: null, quota: null });
        return s.estimate().then(function (e) { return { usage: e.usage, quota: e.quota }; }, function () { return { usage: null, quota: null }; });
    }
    function persisted() {
        var s = global.navigator && navigator.storage;
        if (!s || !s.persisted) return Promise.resolve(null);
        return s.persisted().catch(function () { return null; });
    }
    function persist() {
        var s = global.navigator && navigator.storage;
        if (!s || !s.persist) return Promise.resolve(null);
        return s.persist().catch(function () { return null; });
    }

    global.Store = {
        open: open, getAllTracks: getAllTracks, addTrack: addTrack, updateTracks: updateTracks,
        getBlob: getBlob, getCover: getCover, deleteTracks: deleteTracks, deleteCovers: deleteCovers, clearAll: clearAll,
        estimate: estimate, persisted: persisted, persist: persist
    };
})(window);
