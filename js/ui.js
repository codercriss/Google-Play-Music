/* ===== COMPLETED UI (visual only: no real playback / data) ===== */
    (function () {
        var $ = function (s, r) { return (r || document).querySelector(s); };
        var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
        var main = $('.main-content');
        var PAL = [['#ef6c00','#ffb74d'],['#5e35b1','#9575cd'],['#00897b','#4db6ac'],['#d81b60','#f48fb1'],['#1e88e5','#64b5f6'],['#43a047','#a5d6a7'],['#546e7a','#b0bec5'],['#f4511e','#ffab91']];
        var grad = function (i) { var p = PAL[i % PAL.length]; return 'linear-gradient(135deg,' + p[0] + ',' + p[1] + ')'; };
        var icon = function (n, st) { return '<i class="material-icons"' + (st ? ' style="' + st + '"' : '') + '>' + n + '</i>'; };

        function card(i, ic, title, sub, extra, cls) {
            return '<div class="card ' + (cls || '') + '"><div class="card-image" style="background:' + grad(i) + ';display:flex;align-items:center;justify-content:center">' +
                icon(ic, 'font-size:52px;color:rgba(255,255,255,.85)') + '</div><div class="card-info"><div class="card-title">' + title +
                '</div><div class="card-subtitle">' + sub + '</div>' + (extra || '') + '</div></div>';
        }
        function head(t, s, btn) {
            return '<div class="section-header"><div class="section-title"><h2>' + t + '</h2>' + (s ? '<p>' + s + '</p>' : '') + '</div>' + (btn ? '<button class="btn-see-all">' + btn + '</button>' : '') + '</div>';
        }
        function chips(list) { return '<div class="chips">' + list.map(function (c, i) { return '<div class="chip' + (i ? '' : ' active') + '">' + c + '</div>'; }).join('') + '</div>'; }
        function view(id, html) {
            var d = document.createElement('div');
            d.className = 'content-view'; d.id = 'view-' + id; d.style.display = 'none'; d.innerHTML = html;
            main.appendChild(d); return d;
        }
        function toast(t) {
            var el = $('#toast'); el.textContent = t; el.classList.add('show');
            clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2200);
        }
        var SONGS = [['DAFTENDIREKT','DAFT PUNK - HOMEWORK','2:45'],['AERODYNAMIC','DAFT PUNK - DISCOVERY','3:28'],['DIGITAL LOVE','DAFT PUNK - DISCOVERY','4:58'],['NIGHTVISION','DAFT PUNK - DISCOVERY','1:45'],['SOMETHING ABOUT US','DAFT PUNK - DISCOVERY','3:51'],['VOYAGER','DAFT PUNK - DISCOVERY','3:48'],['CRESCENDOLLS','DAFT PUNK - DISCOVERY','3:32'],['VERDIS QUO','DAFT PUNK - DISCOVERY','3:45']];
        function rows(n, trash) {
            return SONGS.slice(0, n).map(function (s, i) {
                return '<div class="song-row"><div class="song-row-art" style="background:' + grad(i + 1) + '">' + icon('music_note', 'color:#fff;font-size:20px') + '</div>' +
                    '<div class="song-row-info"><div class="song-row-title">' + s[0] + '</div><div class="song-row-artist">' + s[1] + '</div></div>' +
                    '<div class="song-row-time">' + s[2] + '</div>' +
                    (trash ? '<div class="trash-btns"><button class="btn-ghost" data-toast="Song restored">Restore</button><button class="btn-ghost" data-toast="Deleted forever">Delete</button></div>'
                           : '<div class="song-row-plays">' + (10 + i * 3) + '</div>') + '</div>';
            }).join('');
        }
        var listHead = '<div class="song-list-header"><div class="song-col-title">SONG</div><div class="song-col-time">' + icon('schedule') + '</div><div class="song-col-plays">' + icon('music_note') + '</div></div>';

        /* ---------- Popover (all dropdowns share this) ---------- */
        var pop = null, popAnchor = null;
        function closePop() { if (pop) { pop.remove(); pop = null; } if (popAnchor) popAnchor.classList.remove('on'); popAnchor = null; }
        function openPop(anchor, html, o) {
            o = o || {}; var same = popAnchor === anchor; closePop(); if (same) return;
            pop = document.createElement('div'); pop.className = 'pop'; pop.innerHTML = html; document.body.appendChild(pop);
            var r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
            var left = o.left ? r.left : r.right - w; left = Math.max(8, Math.min(left, innerWidth - w - 8));
            var top = o.up ? r.top - h - 8 : r.bottom + 6; top = Math.max(8, Math.min(top, innerHeight - h - 8));
            pop.style.left = left + 'px'; pop.style.top = top + 'px';
            popAnchor = anchor; anchor.classList.add('on');
            pop.addEventListener('click', function (e) {
                var it = e.target.closest('.pop-item'); if (!it) return;
                if (it.dataset.sub) { $('#' + it.dataset.sub, pop).classList.toggle('open'); return; }
                if (it.parentNode.dataset.single) { $$('.pop-item', it.parentNode).forEach(function (x) { x.classList.remove('sel'); }); it.classList.add('sel'); }
                if (o.pick) o.pick(it);
                if (it.dataset.toast) toast(it.dataset.toast);
                closePop();
            });
        }
        document.addEventListener('click', function (e) { if (pop && !pop.contains(e.target) && !popAnchor.contains(e.target)) closePop(); }, true);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePop(); modal.classList.remove('open'); queue.classList.remove('open'); } });
        window.addEventListener('resize', closePop);
        main.addEventListener('scroll', closePop);
        var item = function (ic, t, toastTxt, extra) { return '<div class="pop-item" ' + (toastTxt ? 'data-toast="' + toastTxt + '"' : '') + (extra || '') + '>' + icon(ic) + t + '</div>'; };
        var opt = function (t, sel) { return '<div class="pop-item' + (sel ? ' sel' : '') + '">' + t + icon('check', '') .replace('<i ', '<i class="chk" ').replace('class="chk" class="material-icons"', 'class="material-icons chk"') + '</div>'; };

        /* ---------- Header dropdowns ---------- */
        var acts = $$('.header-actions > *');
        var avatar = acts[2]; avatar.className = 'avatar'; avatar.removeAttribute('style'); avatar.textContent = 'M'; avatar.style.cursor = 'pointer';
        acts[0].onclick = function () {
            openPop(acts[0], '<div class="apps-grid">' + [['account_circle','Account'],['search','Search'],['map','Maps'],['mail','Mail'],['cloud','Drive'],['event','Calendar']].map(function (a) { return '<div>' + icon(a[0]) + a[1] + '</div>'; }).join('') + '</div>');
        };
        acts[1].onclick = function () {
            openPop(acts[1], '<div class="pop-head">Notifications<a data-toast="All caught up">Mark all as read</a></div>' +
                [['new_releases','New release from Daft Punk','Added to your Listen Now · 2h ago'],['playlist_add_check','Pretty Music was updated','3 new songs · Yesterday'],['cloud_done','Upload complete','12 songs added to your library · 2d ago']]
                .map(function (n) { return '<div class="pop-note">' + icon(n[0]) + '<div>' + n[1] + '<small>' + n[2] + '</small></div></div>'; }).join('') + '<div class="pop-item" style="justify-content:center;color:var(--primary-orange)">See all</div>');
        };
        avatar.onclick = function () {
            openPop(avatar, '<div class="acct"><div class="avatar">M</div><b>Music Fan</b><small>fan@example.com</small><br><span class="btn-line">Manage your account</span></div><div class="pop-sep"></div>' +
                item('swap_horiz', 'Switch account') + item('person_add', 'Add another account') + item('settings', 'Music settings', '', ' data-go="settings"') + '<div class="pop-sep"></div>' + item('logout', 'Sign out', 'Signed out (demo)'));
        };

        /* ---------- Sidebar: playlists collapse + new views ---------- */
        var plHead = $('.sidebar-header'), plMenu = plHead.parentNode;
        plHead.querySelector('span').insertAdjacentHTML('afterend', icon('expand_more').replace('<i ', '<i class="chev" ').replace('class="chev" class="material-icons"', 'class="material-icons chev"'));
        plHead.addEventListener('click', function (e) { if (e.target.textContent.trim() === 'add') { modal.classList.add('open'); return; } plMenu.classList.toggle('collapsed'); });
        var MAP = { 'Instant Mixes': 'mixes', 'Shop': 'shop', 'Auto Playlists': 'pl-auto', 'Thumbs up': 'pl-thumbs', 'Last added': 'pl-last', 'Free and purchased': 'pl-free', 'Pretty Music': 'pl-pretty', 'Raine': 'pl-raine', 'sync': 'pl-sync', 'Add music': 'add', 'Settings': 'settings', 'Trash': 'trash', 'Help & Feedback': 'help' };
        var PL = { 'pl-auto': ['Auto Playlists', 'thumb_up', 'Playlists that update on their own', 8], 'pl-thumbs': ['Thumbs up', 'thumb_up', 'Songs you liked', 6], 'pl-last': ['Last added', 'schedule', 'Added in the last 30 days', 8], 'pl-free': ['Free and purchased', 'shopping_bag', 'Songs you own', 5], 'pl-pretty': ['Pretty Music', 'queue_music', 'Playlist', 7], 'pl-raine': ['Raine', 'queue_music', 'Playlist', 4], 'pl-sync': ['sync', 'queue_music', 'Playlist', 6] };
        function wire(el, v) { el.dataset.view = v; if (!el.__w) { el.__w = 1; el.addEventListener('click', function () { showView(v); }); } }
        $$('.sidebar-item, .sidebar-subitem').forEach(function (el) { var k = el.textContent.trim().replace(/^\w+_?\w*\s+(?=[A-Z])/, ''); for (var n in MAP) if (el.textContent.trim().slice(-n.length) === n) k = n; if (MAP[k]) { wire(el, MAP[k]); } });
        $$('.mobile-bottom-nav .nav-item').forEach(function (el) { var t = $('span', el).textContent.trim(); if (t === 'Mixes') wire(el, 'mixes'); if (t === 'Shop') wire(el, 'shop'); });

        /* ---------- Library tabs + sort ---------- */
        var lib = $('#view-library'), first = $('.song-list-header', lib);
        var wrap = document.createElement('div'); wrap.id = 'lib-songs';
        lib.insertBefore(wrap, first); while (wrap.nextSibling) wrap.appendChild(wrap.nextSibling);
        lib.insertAdjacentHTML('afterbegin', '<div class="lib-bar"><div class="tabs">' + ['Playlists','Artists','Albums','Songs','Genres'].map(function (t) { return '<div class="tab' + (t === 'Songs' ? ' active' : '') + '">' + t + '</div>'; }).join('') + '</div><div class="sort-btn" id="sort-btn"><span>Recently added</span>' + icon('arrow_drop_down') + '</div></div><div class="cards-grid" id="lib-grid" style="display:none"></div>');
        var GRIDS = {
            Playlists: function () { return ['Pretty Music','Raine','sync','Thumbs up','Gym mix','Road trip'].map(function (n, i) { return card(i, 'queue_music', n, (i + 3) + ' songs'); }).join(''); },
            Artists: function () { return ['Daft Punk','FKA twigs','ILLENIUM','Big Gigantic','Tove Lo','Hippie Sabotage','LUZCID','Ruxell'].map(function (n, i) { return card(i, 'person', n, (i + 2) + ' songs', '', 'artist'); }).join(''); },
            Albums: function () { return [['Discovery','Daft Punk'],['Homework','Daft Punk'],['LP1','FKA twigs'],['The Night Is Young','Big Gigantic'],['Ash & Ember','ILLENIUM'],['Lady Wood','Tove Lo']].map(function (a, i) { return card(i, 'album', a[0], a[1]); }).join(''); },
            Genres: function () { return ['Electronic','Dance','Pop','Hip-hop','Chill','Rock','Afrobeats','Jazz'].map(function (n, i) { return card(i, 'graphic_eq', n, (i * 4 + 6) + ' songs'); }).join(''); }
        };
        $$('.tab', lib).forEach(function (t) {
            t.onclick = function () {
                $$('.tab', lib).forEach(function (x) { x.classList.toggle('active', x === t); });
                var g = $('#lib-grid'), songs = t.textContent === 'Songs';
                wrap.style.display = songs ? '' : 'none'; g.style.display = songs ? 'none' : '';
                if (!songs) g.innerHTML = GRIDS[t.textContent]();
                $('#sort-btn').style.visibility = (songs || t.textContent === 'Albums') ? '' : 'hidden';
            };
        });
        $('#sort-btn').onclick = function () {
            var b = this;
            openPop(b, '<div data-single="1">' + ['Recently added','A to Z','Most played','Duration'].map(function (s, i) { return opt(s, i === 0); }).join('') + '</div>', { pick: function (it) { $('span', b).textContent = it.textContent.replace('check', '').trim(); } });
        };

        /* ---------- Row context menu ---------- */
        function addKebabs(root) {
            $$('.song-row', root).forEach(function (r) {
                if ($('.kebab', r) || $('.trash-btns', r)) return;
                var k = document.createElement('div'); k.className = 'kebab'; k.innerHTML = icon('more_vert'); r.appendChild(k);
                k.onclick = function (e) {
                    e.stopPropagation();
                    openPop(k, item('play_arrow', 'Play next', 'Playing next') + item('queue_music', 'Add to queue', 'Added to queue') + item('playlist_add', 'Add to playlist', '', ' data-sub="pls"') +
                        '<div class="pop-sub" id="pls">' + item('add', 'New playlist', '', ' data-go="new"') + ['Pretty Music', 'Raine', 'sync'].map(function (p) { return item('queue_music', p, 'Added to ' + p); }).join('') + '</div>' +
                        item('radio', 'Start instant mix', 'Mix started') + '<div class="pop-sep"></div>' + item('person', 'Go to artist') + item('album', 'Go to album') + item('thumb_up_off_alt', 'Thumbs up', 'Thumbs up') + '<div class="pop-sep"></div>' + item('delete', 'Remove from library', 'Moved to Trash'));
                };
            });
        }
        addKebabs(lib);

        /* ---------- New views ---------- */
        view('mixes', head('Instant mixes', 'Pick a mood or start from any song') + chips(['All', 'Energize', 'Chill', 'Focus', 'Party', 'Workout']) +
            '<div class="recommended-grid" style="margin-bottom:32px"><div class="lucky-mix-card"><div class="lucky-icon">' + icon('casino') + '</div><div class="lucky-info"><div class="lucky-title">I\'m feeling lucky mix</div><div class="lucky-subtitle">Based on your music taste</div></div></div></div>' +
            '<div class="cards-grid">' + [['bolt','Energize'],['spa','Chill'],['center_focus_strong','Focus'],['celebration','Party'],['fitness_center','Workout'],['directions_car','Road trip'],['bedtime','Sleep'],['history','Throwback']].map(function (m, i) { return card(i, m[0], m[1], 'Instant mix'); }).join('') + '</div>');

        view('shop', '<div class="hero"><div><h2>Get unlimited music</h2><p>Ad-free listening, offline downloads and more. 30 days free.</p></div><button class="btn-solid light">Start free trial</button></div>' +
            chips(['All', 'Electronic', 'Pop', 'Hip-hop', 'Rock', 'Afrobeats', 'Jazz']) + head('New releases', 'Albums you can buy', 'See All') +
            '<div class="cards-grid">' + ['Neon Tides','Golden Hour','Low Light','Afterglow','Parallel','Blue Static'].map(function (n, i) { return card(i, 'album', n, 'Various artists', '<span class="price">$' + (7 + i % 3) + '.99</span>'); }).join('') + '</div>' +
            head('Top albums', '', 'See All') + '<div class="cards-grid">' + ['Echoes','Midnight Run','Sunday Radio','Wavelength','Paper Planes','Static Bloom'].map(function (n, i) { return card(i + 3, 'album', n, 'Various artists', '<span class="price">$9.99</span>'); }).join('') + '</div>');

        view('pl', '');
        view('settings', '<div class="panel"><h3>Account</h3><div class="set-row"><div>fan@example.com<small>Signed in</small></div><button class="btn-ghost">Change</button></div><div class="set-row"><div>Free plan<small>Upgrade for ad-free, offline listening</small></div><button class="btn-solid">Upgrade</button></div></div>' +
            '<div class="panel"><h3>Playback</h3>' +
            '<div class="set-row"><div>Streaming quality<small>Higher quality uses more data</small></div><select><option>Low</option><option>Normal</option><option selected>High</option><option>Always high</option></select></div>' +
            '<div class="set-row"><div>Crossfade<small>Blend the end of one song into the next</small></div><select><option>Off</option><option>3 seconds</option><option>6 seconds</option><option>12 seconds</option></select></div>' +
            '<div class="set-row"><div>Stream on mobile data</div><label class="sw"><input type="checkbox" checked><i></i></label></div>' +
            '<div class="set-row"><div>Show explicit content</div><label class="sw"><input type="checkbox" checked><i></i></label></div></div>' +
            '<div class="panel"><h3>Notifications</h3><div class="set-row"><div>New releases<small>From artists in your library</small></div><label class="sw"><input type="checkbox" checked><i></i></label></div><div class="set-row"><div>Playlist updates</div><label class="sw"><input type="checkbox"><i></i></label></div></div>' +
            '<div class="panel"><h3>Devices</h3><div class="set-row"><div>This browser<small>Active now</small></div><span style="color:var(--text-muted);font-size:12px">Current</span></div><div class="set-row"><div>Pixel phone<small>Last used 2 days ago</small></div><button class="btn-ghost" data-toast="Device removed">Remove</button></div></div>' +
            '<div class="panel"><h3>Language</h3><div class="set-row"><div>Display language</div><select><option>English</option><option>Français</option><option>Español</option><option>Twi</option></select></div></div>');

        view('add', '<div class="drop">' + icon('cloud_upload') + '<h3>Drag and drop songs here</h3><p>MP3, AAC, FLAC and more. Up to 100,000 songs.</p><button class="btn-solid">Select from your computer</button></div>' +
            '<div class="panel"><h3>Recent uploads</h3>' + [['Digital Love.mp3', 100, 'check_circle'], ['Voyager.mp3', 100, 'check_circle'], ['Nightvision.flac', 64, 'sync'], ['Aerodynamic.mp3', 18, 'sync']].map(function (u) { return '<div class="up-row"><div class="name">' + u[0] + '</div><div class="bar"><span style="width:' + u[1] + '%"></span></div>' + icon(u[2]) + '</div>'; }).join('') + '</div>');

        view('trash', head('Trash', 'Songs are deleted forever after 30 days') + '<div style="display:flex;justify-content:flex-end;margin:-8px 0 8px"><button class="btn-ghost" data-toast="Trash emptied">Empty trash</button></div>' + listHead.replace(/<div class="song-col-plays">.*?<\/div><\/div>$/, '</div>') + '<div>' + rows(3, 1) + '</div>');

        view('help', '<div class="panel"><h3>How can we help?</h3><div style="padding:16px 24px"><input class="field" placeholder="Describe your issue"></div></div>' +
            '<div class="panel"><h3>Popular questions</h3>' + [['How do I upload my own music?', 'Open Add music from the menu, then drag your files in or choose them from your computer.'], ['How do I make a playlist?', 'Tap the plus next to Playlists, name it, and add songs from any song menu.'], ['Can I listen offline?', 'Offline listening comes with a paid plan. Downloaded songs stay on your device.'], ['How do I restore a deleted song?', 'Open Trash from the menu and choose Restore. Songs stay there for 30 days.']].map(function (q) { return '<details><summary>' + q[0] + '</summary><p>' + q[1] + '</p></details>'; }).join('') + '</div>' +
            '<div class="panel"><h3>Send feedback</h3><div style="padding:16px 24px;display:flex;flex-direction:column;gap:12px"><select><option>Suggestion</option><option>Something is broken</option><option>Other</option></select><textarea class="field" rows="4" placeholder="Tell us what happened"></textarea><div><button class="btn-solid" data-toast="Feedback sent">Send feedback</button></div></div></div>');

        /* extra sections on Listen Now */
        var ln = $('#view-listen-now');
        var extra = document.createElement('div');
        extra.innerHTML = head('New releases', 'Fresh music picked for you', 'See All') + '<div class="cards-grid">' + ['Neon Tides','Golden Hour','Low Light','Afterglow','Parallel','Blue Static'].map(function (n, i) { return card(i + 2, 'album', n, 'Various artists'); }).join('') + '</div>' + head('Browse genres') + chips(['Electronic', 'Dance', 'Pop', 'Hip-hop', 'Chill', 'Rock', 'Afrobeats', 'Jazz']).replace(' active', '');
        while (extra.firstChild) ln.insertBefore(extra.firstChild, ln.lastElementChild);

        /* ---------- Wrap showView for the new views ---------- */
        Object.assign(VIEW_TITLES, { mixes: 'Instant Mixes', shop: 'Shop', settings: 'Settings', add: 'Add music', trash: 'Trash', help: 'Help & Feedback' });
        var baseShow = showView;
        showView = function (v) {
            baseShow(v);
            var isPl = v.indexOf('pl-') === 0;
            if (isPl) {
                var p = PL[v], pv = $('#view-pl');
                pv.innerHTML = '<div class="pl-hero"><div class="pl-art" style="background:' + grad(Object.keys(PL).indexOf(v)) + '">' + icon(p[1]) + '</div><div><h1>' + p[0] + '</h1><p>' + p[2] + ' · ' + p[3] + ' songs</p><div class="pl-actions"><button class="btn-solid">' + icon('play_arrow', 'font-size:18px') + 'Play</button><button class="btn-ghost">Shuffle</button><span class="sort-btn" id="pl-more">' + icon('more_vert') + '</span></div></div></div>' + listHead + rows(p[3]);
                pv.style.display = ''; headerTitle.textContent = p[0]; addKebabs(pv);
                $('#pl-more').onclick = function () { openPop(this, item('edit', 'Edit playlist') + item('share', 'Share', 'Link copied') + item('queue_music', 'Add to queue', 'Added to queue') + item('delete', 'Delete playlist', 'Playlist deleted')); };
            }
            $$('.sidebar-item, .sidebar-subitem').forEach(function (el) { el.classList.toggle('active', el.dataset.view === v); });
            closePop();
        };

        /* ---------- Modal, queue, volume, cast, chips, toasts ---------- */
        document.body.insertAdjacentHTML('beforeend',
            '<div class="scrim" id="modal"><div class="modal"><h3>New playlist</h3><div class="body"><input class="field" placeholder="Name"><textarea class="field" rows="3" placeholder="Description (optional)"></textarea><select><option>Private</option><option>Public</option></select></div><div class="foot"><button class="btn-ghost" data-close="1">Cancel</button><button class="btn-solid" data-close="1" data-toast="Playlist created">Create playlist</button></div></div></div>' +
            '<div class="queue" id="queue"><div class="pop-head">Queue<span><a data-toast="Queue cleared">Clear</a> &nbsp; <a id="q-close">Close</a></span></div><div class="list">' +
            SONGS.map(function (s, i) { return '<div class="q-row' + (i === 3 ? ' now' : '') + '">' + icon(i === 3 ? 'volume_up' : 'drag_handle') + '<div>' + s[0] + '<small>' + s[1] + '</small></div><span>' + s[2] + '</span></div>'; }).join('') + '</div></div><div class="toast" id="toast"></div>');
        var modal = $('#modal'), queue = $('#queue');
        modal.addEventListener('click', function (e) { if (e.target === modal || e.target.dataset.close) modal.classList.remove('open'); });
        $('#q-close').onclick = function () { queue.classList.remove('open'); };
        var pr = $$('.player-right > *');
        pr[0].onclick = function () { openPop(pr[0], '<div class="vol-pop">' + icon('volume_down') + '<input type="range" min="0" max="100" value="70">' + icon('volume_up') + '</div>', { up: 1 }); };
        pr[1].onclick = function () { openPop(pr[1], '<div class="pop-head">Cast to</div><div data-single="1"><div class="pop-item sel">' + icon('computer') + 'This browser' + icon('check').replace('<i ', '<i class="chk" ').replace('class="chk" class="material-icons"', 'class="material-icons chk"') + '</div>' + item('speaker', 'Living room speaker').replace('pop-item', 'pop-item') + item('tv', 'Kitchen TV') + '</div>', { up: 1 }); };
        pr[2].onclick = function () { closePop(); queue.classList.toggle('open'); };
        document.addEventListener('click', function (e) {
            var c = e.target.closest('.chip'); if (c) { $$('.chip', c.parentNode).forEach(function (x) { x.classList.toggle('active', x === c); }); return; }
            var t = e.target.closest('[data-toast]'); if (t) toast(t.dataset.toast);
            var g = e.target.closest('[data-go]'); if (g) { if (g.dataset.go === 'new') modal.classList.add('open'); else showView(g.dataset.go); }
        });
    })();
