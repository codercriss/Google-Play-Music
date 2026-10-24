function toggleSidebar() {
            document.querySelector('.sidebar').classList.toggle('open');
            document.getElementById('sidebar-overlay').classList.toggle('open');
        }
        function closeSidebar() {
            document.querySelector('.sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('open');
        }
        // Close the drawer when a sidebar item is tapped
        document.querySelectorAll('.sidebar-item, .sidebar-subitem').forEach(function(el) {
            el.addEventListener('click', closeSidebar);
        });

        // --- View switching: Listen Now / Library ---
        var VIEW_TITLES = {
            'listen-now': 'Listen Now',
            'library': 'My Library'
        };
        var headerTitle = document.getElementById('header-title');

        function showView(viewName) {
            // Toggle the visible content panel
            document.querySelectorAll('.content-view').forEach(function(panel) {
                panel.style.display = (panel.id === 'view-' + viewName) ? '' : 'none';
            });

            // Update the header title text
            if (headerTitle && VIEW_TITLES[viewName]) {
                headerTitle.textContent = VIEW_TITLES[viewName];
            }

            // Sync "active" state on the sidebar's primary items
            document.querySelectorAll('.sidebar-menu-primary .sidebar-item').forEach(function(item) {
                item.classList.toggle('active', item.getAttribute('data-view') === viewName);
            });

            // Sync "active" state on the mobile bottom nav
            document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(function(item) {
                item.classList.toggle('active', item.getAttribute('data-view') === viewName);
            });

            // Scroll back to the top of the content area
            var mainContent = document.querySelector('.main-content');
            if (mainContent) mainContent.scrollTop = 0;
            window.scrollTo(0, 0);
        }

        // Wire up every element that declares a data-view target
        document.querySelectorAll('[data-view]').forEach(function(el) {
            el.addEventListener('click', function() {
                showView(el.getAttribute('data-view'));
            });
        });

        // --- Full-screen player (mobile only) ---
        var MOBILE_BREAKPOINT = 768;
        var miniPlayer = document.getElementById('mini-player');
        var fullscreenPlayer = document.getElementById('fullscreen-player');
        var fsBottomBar = document.getElementById('fs-bottom-bar');
        var fsCloseBtn = document.getElementById('fs-close');
        var miniPlayBtn = document.getElementById('mini-play-btn');
        var fsPlayBtn = document.getElementById('fs-play-btn');

        function isMobile() {
            return window.innerWidth <= MOBILE_BREAKPOINT;
        }

        function openFullscreenPlayer() {
            if (!isMobile()) return;
            fullscreenPlayer.classList.add('open');
            fsBottomBar.classList.add('open');
        }

        function closeFullscreenPlayer() {
            fullscreenPlayer.classList.remove('open');
            fsBottomBar.classList.remove('open');
        }

        miniPlayer.addEventListener('click', function(e) {
            // Don't open the full-screen player if a control button was tapped directly
            if (e.target.closest('.player-center') || e.target.closest('.player-right')) return;
            openFullscreenPlayer();
        });

        fsCloseBtn.addEventListener('click', closeFullscreenPlayer);

        // Swipe down to dismiss
        (function() {
            var startY = 0;
            var currentY = 0;
            var dragging = false;

            fullscreenPlayer.addEventListener('touchstart', function(e) {
                startY = e.touches[0].clientY;
                dragging = true;
                fullscreenPlayer.style.transition = 'none';
            }, { passive: true });

            fullscreenPlayer.addEventListener('touchmove', function(e) {
                if (!dragging) return;
                currentY = e.touches[0].clientY - startY;
                if (currentY > 0) {
                    fullscreenPlayer.style.transform = 'translateY(' + currentY + 'px)';
                }
            }, { passive: true });

            fullscreenPlayer.addEventListener('touchend', function() {
                dragging = false;
                fullscreenPlayer.style.transition = '';
                fullscreenPlayer.style.transform = '';
                if (currentY > 100) {
                    closeFullscreenPlayer();
                }
                currentY = 0;
            });
        })();

        // Keep mini player and full-screen play/pause buttons in sync
        function togglePlayIcon(iconEl) {
            var isPlaying = iconEl.textContent.trim() === 'pause';
            iconEl.textContent = isPlaying ? 'play_arrow' : 'pause';
        }

        miniPlayBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var icon = miniPlayBtn.querySelector('.material-icons');
            togglePlayIcon(icon);
            fsPlayBtn.querySelector('.material-icons').textContent = icon.textContent;
        });

        fsPlayBtn.addEventListener('click', function() {
            var icon = fsPlayBtn.querySelector('.material-icons');
            togglePlayIcon(icon);
            miniPlayBtn.querySelector('.material-icons').textContent = icon.textContent;
        });

        // If the window is resized past the breakpoint, hide the full-screen player
        window.addEventListener('resize', function() {
            if (!isMobile()) {
                closeFullscreenPlayer();
            }
        });
