/* ==========================================================================
   Tag reader

   Reads a song's information (title, artist, album, genre, track number, year)
   and embedded cover art straight from the file's own bytes. Only the parts of
   the file that hold tags are read, never the whole song.

   Formats: MP3 (ID3v2.2 / 2.3 / 2.4 and ID3v1), M4A / MP4, FLAC, WAV,
            Ogg Vorbis / Opus (text tags only).
   Anything else, or a damaged file, just comes back with empty fields: this
   never throws. The caller falls back to the file name.

   Tags.read(file)  ->  Promise of
     { title, artist, album, albumArtist, genre, year, track, disc,
       duration (seconds, only when the container states it), cover (Blob), format }
   Tags.fromFilename(name) -> { artist, title }
   ========================================================================== */
(function (global) {
    'use strict';

    var GENRES = ['Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise', 'Alt. Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret', 'New Wave', 'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock', 'Folk', 'Folk-Rock', 'National Folk', 'Swing', 'Fast Fusion', 'Bebob', 'Latin', 'Revival', 'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock', 'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson', 'Opera', 'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam', 'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul', 'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo', 'A capella', 'Euro-House', 'Dance Hall'];


    /* ------------------------------------------------------------ helpers */

    function slice(file, start, end) {
        return file.slice(start, end).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    function ascii(u8, start, len) {
        var s = '';
        for (var i = start; i < start + len && i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return s;
    }
    function be32(u8, o) { return ((u8[o] * 16777216) + (u8[o + 1] << 16) + (u8[o + 2] << 8) + u8[o + 3]) >>> 0; }
    function le32(u8, o) { return ((u8[o + 3] * 16777216) + (u8[o + 2] << 16) + (u8[o + 1] << 8) + u8[o]) >>> 0; }
    function be24(u8, o) { return (u8[o] << 16) | (u8[o + 1] << 8) | u8[o + 2]; }
    function syncsafe(u8, o) { return ((u8[o] & 127) << 21) | ((u8[o + 1] & 127) << 14) | ((u8[o + 2] & 127) << 7) | (u8[o + 3] & 127); }

    function decode(u8, label) {
        try { return new TextDecoder(label).decode(u8); } catch (e) { return ''; }
    }
    function clean(s) {
        if (s == null) return '';
        // several values (ID3v2.4 uses a zero byte between them): keep them all, comma separated
        return String(s).split('\u0000').map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join(', ');
    }
    function toInt(s) {
        var m = /^\s*(\d+)/.exec(String(s || ''));
        return m ? parseInt(m[1], 10) : null;
    }
    function toYear(s) {
        var m = /(\d{4})/.exec(String(s || ''));
        return m ? parseInt(m[1], 10) : null;
    }
    function genreName(s) {
        s = clean(s);
        if (!s) return '';
        var m = /^\((\d{1,3})\)\s*(.*)$/.exec(s);          // "(13)" or "(13)Pop"
        if (m) return m[2] || GENRES[+m[1]] || '';
        if (/^\d{1,3}$/.test(s)) return GENRES[+s] || '';  // "13"
        return s;
    }
    function sniffImage(u8) {
        if (u8.length > 3 && u8[0] === 0xFF && u8[1] === 0xD8) return 'image/jpeg';
        if (u8.length > 8 && u8[0] === 0x89 && ascii(u8, 1, 3) === 'PNG') return 'image/png';
        if (u8.length > 6 && ascii(u8, 0, 3) === 'GIF') return 'image/gif';
        if (u8.length > 12 && ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 4) === 'WEBP') return 'image/webp';
        return null;
    }
    function makeCover(bytes) {
        var mime = sniffImage(bytes);
        if (!mime || bytes.length < 64) return null;
        return new Blob([bytes], { type: mime });
    }
    function empty() {
        return { title: '', artist: '', album: '', albumArtist: '', genre: '', year: null, track: null, disc: null, duration: null, cover: null, format: null };
    }


    /* ------------------------------------------------------------ MP3 (ID3) */

    function deunsync(u8) {
        var out = new Uint8Array(u8.length), n = 0;
        for (var i = 0; i < u8.length; i++) {
            out[n++] = u8[i];
            if (u8[i] === 0xFF && u8[i + 1] === 0x00) i++;
        }
        return out.subarray(0, n);
    }

    /* text of a text frame: first byte is the encoding */
    function frameText(d) {
        if (!d.length) return '';
        var enc = d[0], body = d.subarray(1);
        if (enc === 0) return decode(body, 'windows-1252');
        if (enc === 3) return decode(body, 'utf-8');
        if (enc === 2) return decode(body, 'utf-16be');
        // encoding 1: UTF-16 with a byte order mark
        if (body.length >= 2 && body[0] === 0xFF && body[1] === 0xFE) return decode(body.subarray(2), 'utf-16le');
        if (body.length >= 2 && body[0] === 0xFE && body[1] === 0xFF) return decode(body.subarray(2), 'utf-16be');
        return decode(body, 'utf-16le');
    }

    /* index just past the end of a null-terminated string in this encoding */
    function skipString(d, i, enc) {
        if (enc === 1 || enc === 2) {
            while (i + 1 < d.length && !(d[i] === 0 && d[i + 1] === 0)) i += 2;
            return i + 2;
        }
        while (i < d.length && d[i] !== 0) i++;
        return i + 1;
    }

    function parseApic(d, v22) {
        var enc = d[0], i = 1, mime;
        if (v22) { mime = ascii(d, 1, 3); i = 4; }
        else { var e = i; while (e < d.length && d[e] !== 0) e++; mime = ascii(d, i, e - i); i = e + 1; }
        var type = d[i]; i++;
        i = skipString(d, i, enc);
        return { type: type, bytes: d.subarray(i) };
    }

    function parseId3v2(u8, out) {
        var ver = u8[3], flags = u8[5];
        var v22 = ver === 2;
        var data = u8.subarray(10);
        if (flags & 0x80) data = deunsync(data);                 // whole-tag unsynchronisation (v2.2 / v2.3)
        var pos = 0;
        if ((flags & 0x40) && !v22 && data.length >= 4) {         // extended header
            pos = ver === 4 ? syncsafe(data, 0) : be32(data, 0) + 4;
        }
        var cover = null, coverType = 99;
        while (pos + (v22 ? 6 : 10) <= data.length) {
            var id, size, fl = 0;
            if (v22) { id = ascii(data, pos, 3); size = be24(data, pos + 3); pos += 6; }
            else {
                id = ascii(data, pos, 4);
                size = ver === 4 ? syncsafe(data, pos + 4) : be32(data, pos + 4);
                fl = (data[pos + 8] << 8) | data[pos + 9];
                pos += 10;
            }
            if (!/^[A-Z0-9]{3,4}$/.test(id) || size <= 0 || pos + size > data.length) break;   // padding or damage
            var d = data.subarray(pos, pos + size);
            pos += size;
            if (ver === 4) {
                if (fl & 0x0C) continue;                              // compressed / encrypted
                if (fl & 0x01) d = d.subarray(4);                     // data length indicator
                if (fl & 0x02) d = deunsync(d);
            } else if (ver === 3 && (fl & 0xC0)) continue;            // compressed / encrypted

            switch (id) {
                case 'TIT2': case 'TT2': out.title = out.title || clean(frameText(d)); break;
                case 'TPE1': case 'TP1': out.artist = out.artist || clean(frameText(d)); break;
                case 'TALB': case 'TAL': out.album = out.album || clean(frameText(d)); break;
                case 'TPE2': case 'TP2': out.albumArtist = out.albumArtist || clean(frameText(d)); break;
                case 'TCON': case 'TCO': out.genre = out.genre || genreName(frameText(d)); break;
                case 'TRCK': case 'TRK': if (out.track == null) out.track = toInt(frameText(d)); break;
                case 'TPOS': case 'TPA': if (out.disc == null) out.disc = toInt(frameText(d)); break;
                case 'TDRC': case 'TYER': case 'TYE': if (out.year == null) out.year = toYear(frameText(d)); break;
                case 'TLEN': case 'TLE': if (out.duration == null) { var ms = toInt(frameText(d)); if (ms) out.duration = ms / 1000; } break;
                case 'APIC': case 'PIC':
                    try {
                        var p = parseApic(d, id === 'PIC');
                        var rank = p.type === 3 ? 0 : (p.type === 0 ? 1 : 2);     // prefer the front cover
                        if (rank < coverType && p.bytes.length) { var c = makeCover(p.bytes); if (c) { cover = c; coverType = rank; } }
                    } catch (e) { /* skip this picture */ }
                    break;
            }
        }
        if (cover && !out.cover) out.cover = cover;
    }

    function parseId3v1(u8, out) {      // the last 128 bytes of the file
        function f(o, n) { return clean(decode(u8.subarray(o, o + n), 'windows-1252').replace(/\u0000.*$/, '')); }
        out.title = out.title || f(3, 30);
        out.artist = out.artist || f(33, 30);
        out.album = out.album || f(63, 30);
        if (out.year == null) out.year = toYear(f(93, 4));
        if (u8[125] === 0 && u8[126] !== 0 && out.track == null) out.track = u8[126];
        if (!out.genre && u8[127] < GENRES.length) out.genre = GENRES[u8[127]];
    }

    function readMp3(file, head, out) {
        var steps = Promise.resolve();
        if (ascii(head, 0, 3) === 'ID3') {
            var size = syncsafe(head, 6);
            steps = slice(file, 0, 10 + Math.min(size, 16 * 1024 * 1024)).then(function (tag) { parseId3v2(tag, out); });
        }
        return steps.then(function () {
            if (out.title && out.artist) return null;
            if (file.size < 128) return null;
            return slice(file, file.size - 128, file.size).then(function (t) { if (ascii(t, 0, 3) === 'TAG') parseId3v1(t, out); });
        });
    }


    /* ------------------------------------------------------------ MP4 / M4A */

    function boxes(u8, start, end) {
        var list = [], p = start;
        while (p + 8 <= end) {
            var size = be32(u8, p), type = ascii(u8, p + 4, 4), hdr = 8;
            if (size === 1) { size = be32(u8, p + 8) * 4294967296 + be32(u8, p + 12); hdr = 16; }
            else if (size === 0) size = end - p;
            if (size < hdr || p + size > end) break;
            list.push({ type: type, start: p + hdr, end: p + size });
            p += size;
        }
        return list;
    }
    function findBox(u8, parent, type) {
        var l = boxes(u8, parent.start, parent.end);
        for (var i = 0; i < l.length; i++) if (l[i].type === type) return l[i];
        return null;
    }

    function parseMoov(u8, moov, out) {
        var mvhd = findBox(u8, moov, 'mvhd');
        if (mvhd) {
            var v = u8[mvhd.start], ts, dur;
            if (v === 1) { ts = be32(u8, mvhd.start + 20); dur = be32(u8, mvhd.start + 24) * 4294967296 + be32(u8, mvhd.start + 28); }
            else { ts = be32(u8, mvhd.start + 12); dur = be32(u8, mvhd.start + 16); }
            if (ts && dur) out.duration = dur / ts;
        }
        var udta = findBox(u8, moov, 'udta'), meta = udta && findBox(u8, udta, 'meta');
        if (!meta) return;
        var ilst = findBox(u8, { start: meta.start + 4, end: meta.end }, 'ilst');   // 'meta' is a full box: 4 extra bytes
        if (!ilst) return;
        boxes(u8, ilst.start, ilst.end).forEach(function (item) {
            var data = findBox(u8, item, 'data');
            if (!data) return;
            var kind = be32(u8, data.start) & 0xFFFFFF;                       // 1 = text, 13 = JPEG, 14 = PNG, 0/21 = numbers
            var body = u8.subarray(data.start + 8, data.end);
            var t = item.type, text = function () { return clean(decode(body, 'utf-8')); };
            if (t === '\u00A9nam') out.title = out.title || text();
            else if (t === '\u00A9ART') out.artist = out.artist || text();
            else if (t === '\u00A9alb') out.album = out.album || text();
            else if (t === 'aART') out.albumArtist = out.albumArtist || text();
            else if (t === '\u00A9gen') out.genre = out.genre || text();
            else if (t === 'gnre') { if (!out.genre && body.length >= 2) out.genre = GENRES[((body[0] << 8) | body[1]) - 1] || ''; }
            else if (t === '\u00A9day') { if (out.year == null) out.year = toYear(text()); }
            else if (t === 'trkn') { if (out.track == null && body.length >= 4) out.track = (body[2] << 8) | body[3] || null; }
            else if (t === 'disk') { if (out.disc == null && body.length >= 4) out.disc = (body[2] << 8) | body[3] || null; }
            else if (t === 'covr' && !out.cover && (kind === 13 || kind === 14 || kind === 0)) out.cover = makeCover(body);
        });
    }

    function readMp4(file, out) {
        var offset = 0;
        function next() {
            if (offset + 8 > file.size) return Promise.resolve();
            return slice(file, offset, offset + 16).then(function (h) {
                var size = be32(h, 0), type = ascii(h, 4, 4), hdr = 8;
                if (size === 1) { size = be32(h, 8) * 4294967296 + be32(h, 12); hdr = 16; }
                else if (size === 0) size = file.size - offset;
                if (size < hdr) return;
                if (type === 'moov') {
                    if (size > 64 * 1024 * 1024) return;
                    return slice(file, offset, offset + size).then(function (b) { parseMoov(b, { start: hdr, end: b.length }, out); });
                }
                offset += size;
                return next();
            });
        }
        return next();
    }


    /* ------------------------------------------------------------ FLAC / Vorbis comments */

    function parseVorbisComment(u8, o, out) {
        var vlen = le32(u8, o); o += 4 + vlen;
        var n = le32(u8, o); o += 4;
        for (var i = 0; i < n && o + 4 <= u8.length; i++) {
            var len = le32(u8, o); o += 4;
            var kv = decode(u8.subarray(o, o + len), 'utf-8'); o += len;
            var eq = kv.indexOf('=');
            if (eq < 1) continue;
            var k = kv.slice(0, eq).toUpperCase(), v = kv.slice(eq + 1);
            if (k === 'TITLE') out.title = out.title || clean(v);
            else if (k === 'ARTIST') out.artist = out.artist || clean(v);
            else if (k === 'ALBUM') out.album = out.album || clean(v);
            else if (k === 'ALBUMARTIST' || k === 'ALBUM ARTIST') out.albumArtist = out.albumArtist || clean(v);
            else if (k === 'GENRE') out.genre = out.genre || clean(v);
            else if (k === 'TRACKNUMBER') { if (out.track == null) out.track = toInt(v); }
            else if (k === 'DISCNUMBER') { if (out.disc == null) out.disc = toInt(v); }
            else if (k === 'DATE' || k === 'YEAR') { if (out.year == null) out.year = toYear(v); }
        }
    }

    function parseFlacPicture(u8, out) {
        var type = be32(u8, 0), mlen = be32(u8, 4), o = 8 + mlen;
        var dlen = be32(u8, o); o += 4 + dlen + 16;                  // description, then width/height/depth/colours
        var len = be32(u8, o); o += 4;
        if (!out.cover || type === 3) { var c = makeCover(u8.subarray(o, o + len)); if (c) out.cover = c; }
    }

    function readFlac(file, out) {
        var offset = 4;
        function next() {
            return slice(file, offset, offset + 4).then(function (h) {
                if (h.length < 4) return;
                var last = h[0] & 0x80, type = h[0] & 0x7F, len = be24(h, 1);
                var wanted = type === 0 || type === 4 || type === 6;
                var step = wanted ? slice(file, offset + 4, offset + 4 + len) : Promise.resolve(null);
                return step.then(function (b) {
                    if (b) {
                        try {
                            if (type === 0 && b.length >= 18) {                // STREAMINFO: 20-bit rate, 36-bit total samples
                                var rate = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4);
                                var total = (b[13] & 15) * 4294967296 + be32(b, 14);
                                if (rate && total) out.duration = total / rate;
                            } else if (type === 4) parseVorbisComment(b, 0, out);
                            else if (type === 6) parseFlacPicture(b, out);
                        } catch (e) { /* skip this block */ }
                    }
                    offset += 4 + len;
                    if (!last) return next();
                });
            });
        }
        return next();
    }


    /* ------------------------------------------------------------ WAV (INFO list) */

    function readWav(file, out) {
        var offset = 12, rate = 0, align = 0;
        function next() {
            if (offset + 8 > file.size) return Promise.resolve();
            return slice(file, offset, offset + 12).then(function (h) {
                var id = ascii(h, 0, 4), size = le32(h, 4);
                if (id === 'fmt ') {
                    return slice(file, offset + 8, offset + 8 + Math.min(size, 40)).then(function (b) {
                        rate = le32(b, 8); align = b[12] | (b[13] << 8);       // bytes per second
                        offset += 8 + size + (size & 1);
                        return next();
                    });
                }
                if (id === 'data') {
                    if (rate) out.duration = size / rate;
                } else if (id === 'LIST' && ascii(h, 8, 4) === 'INFO') {
                    return slice(file, offset + 12, offset + 8 + Math.min(size, 1024 * 1024)).then(function (b) {
                        var p = 0;
                        while (p + 8 <= b.length) {
                            var sid = ascii(b, p, 4), slen = le32(b, p + 4);
                            var txt = clean(decode(b.subarray(p + 8, p + 8 + slen), 'utf-8').replace(/\u0000+$/, ''));
                            if (sid === 'INAM') out.title = out.title || txt;
                            else if (sid === 'IART') out.artist = out.artist || txt;
                            else if (sid === 'IPRD') out.album = out.album || txt;
                            else if (sid === 'IGNR') out.genre = out.genre || txt;
                            else if (sid === 'ICRD') { if (out.year == null) out.year = toYear(txt); }
                            else if (sid === 'ITRK' || sid === 'IPRT') { if (out.track == null) out.track = toInt(txt); }   // two conventions for the track number
                            p += 8 + slen + (slen & 1);
                        }
                        offset += 8 + size + (size & 1);
                        return next();
                    });
                }
                offset += 8 + size + (size & 1);
                return next();
            });
        }
        return next();
    }


    /* ------------------------------------------------------------ Ogg (Vorbis / Opus), text only */

    function readOgg(file, out) {
        return slice(file, 0, 128 * 1024).then(function (u8) {
            var s = ascii(u8, 0, u8.length);
            var i = s.indexOf('OpusTags');
            if (i > -1) { parseVorbisComment(u8, i + 8, out); return; }
            i = s.indexOf('\u0003vorbis');
            if (i > -1) parseVorbisComment(u8, i + 7, out);
        });
    }


    /* ------------------------------------------------------------ entry points */

    function read(file) {
        var out = empty();
        return slice(file, 0, 16).then(function (head) {
            var ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1];
            ext = ext ? ext.toLowerCase() : '';
            var tagged = ascii(head, 0, 3) === 'ID3';
            var job;
            if (tagged || (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) || ext === 'mp3') { out.format = 'mp3'; job = readMp3(file, head, out); }
            else if (ascii(head, 4, 4) === 'ftyp') { out.format = 'm4a'; job = readMp4(file, out); }
            else if (ascii(head, 0, 4) === 'fLaC') { out.format = 'flac'; job = readFlac(file, out); }
            else if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WAVE') { out.format = 'wav'; job = readWav(file, out); }
            else if (ascii(head, 0, 4) === 'OggS') { out.format = 'ogg'; job = readOgg(file, out); }
            else return out;
            return job.then(function () { return out; });
        }).catch(function (e) {
            if (global.console) console.warn('Could not read tags from', file && file.name, e);
            return out;
        });
    }

    /* "Artist - Title.mp3" -> artist and title, with common download clutter removed */
    var JUNK = /^(official|lyrics?|lyric video|audio|video|music video|hd|hq|4k|visuali[sz]er|remaster(ed)?|explicit|clean|full song|full video)\b/i;
    function fromFilename(filename) {
        var base = String(filename || '').replace(/\.[^.]+$/, '').replace(/^\d{1,3}\s*[-._)]\s*/, '').replace(/_/g, ' ');   // number first: "03_Song"
        base = base.replace(/\s*[\(\[]([^\)\]]*)[\)\]]/g, function (m, inner) { return JUNK.test(inner.trim()) || /official/i.test(inner) ? '' : m; });
        base = base.replace(/\s+/g, ' ').trim();
        base = base.replace(/^\d{1,3}\s*[-._)]\s*/, '');
        var m = /^(.+?)\s+[-\u2013\u2014]\s+(.+)$/.exec(base);
        if (m) return { artist: m[1].trim(), title: m[2].trim() };
        return { artist: '', title: base || String(filename || '') };
    }

    global.Tags = { read: read, fromFilename: fromFilename };
})(typeof window !== 'undefined' ? window : globalThis);
