# How it works (today)

This describes the project **as it is right now (Phase 0 baseline)**. It will be updated at the end of each phase.

In one sentence: a responsive, plain HTML/CSS/JS recreation of the Google Play Music web app. It looks complete, but **nothing is real yet**: no audio plays, and all songs, albums and settings are hard-coded placeholders.

---

## Run it

No install, no build.

```bash
cd google-play-music
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works. You need an internet connection for the fonts and icons (see Dependencies).

---

## File map

| File | Size | Role |
| --- | --- | --- |
| `index.html` | ~21 KB | All the base markup: header, sidebar, **Listen Now** and **My Library** screens, desktop player bar, mobile full-screen player, mobile bottom nav |
| `css/styles.css` | ~29 KB | Variables, layout, header, sidebar, cards, song rows, player bar, and all mobile rules (two breakpoints: 992 px and 768 px) |
| `css/components.css` | ~11 KB | Popup menus, library tabs, settings/help/upload panels, modal, queue panel, toast |
| `js/app.js` | ~6 KB | Screen switching, mobile drawer, mobile full-screen player (open, swipe-down close, play/pause icon swap) |
| `js/ui.js` | ~24 KB | Everything else: builds extra screens, all dropdown menus, library tabs, modal, queue, toast |
| `assets/icon.png`, `assets/logo.png` | 256×256 | Identical images, used as favicon, sidebar logo and share image |
| `docs/` | | This file and the roadmap |

---

## How the page starts up

1. The browser loads `index.html`, which contains the markup for the two main screens and the player.
2. Scripts are plain files (not modules) and **must load in this order**:
   1. `app.js` defines `showView()`, `toggleSidebar()`, `closeSidebar()` and the full-screen player behaviour.
   2. `ui.js` runs in one self-contained function. It reaches into the existing page, adds the extra screens and menus, and **replaces `showView` with a wrapped version** so the new screens work.
3. `index.html` also calls `toggleSidebar()` and `closeSidebar()` from inline `onclick` attributes, so those two must stay global.

There is no state object. What's on screen **is** the state: for example, the app decides whether the player is playing by reading the text of the play/pause icon.

---

## Layout

- **Desktop:** fixed 64 px header, a sidebar on the left, scrolling content in the middle, a fixed 90 px player bar at the bottom.
- **Mobile (768 px and under):** the sidebar becomes a slide-out drawer, a 56 px bottom nav appears, the player bar becomes a ~70 px mini player sitting above the bottom nav, and tapping it opens a full-screen player that slides up.
- The page itself never scrolls (`body` is `overflow: hidden`); the `.main-content` area scrolls.
- Stacking order, low to high: header 100, player bar 200, queue (desktop) 250, bottom nav 300, drawer overlay 350, drawer 400, queue (mobile) 450, full-screen player 500, its control bar 510, popup menus 1000, modal 1100, toast 1200.

---

## Screens

Switching screens means showing one `.content-view` panel and hiding the others. `showView('id')` does this, updates the header title, highlights the matching sidebar and bottom-nav items, and scrolls to top.

| View id | Where it comes from | What's in it |
| --- | --- | --- |
| `listen-now` | `index.html` (plus extra sections added by `ui.js`) | Fake recent albums, "I'm feeling lucky", fake mixes, new releases, genre chips |
| `library` | `index.html`, then reworked by `ui.js` | Tabs (Playlists, Artists, Albums, Songs, Genres) and a sort menu. The Songs tab is static HTML rows; the other tabs are generated placeholder cards |
| `mixes`, `shop`, `settings`, `add`, `trash`, `help` | Built by `ui.js` with its `view(id, html)` helper | Placeholder content |
| `pl` | One shared panel built by `ui.js` | Reused for all seven sidebar playlists. Filled in when you open one, from a small lookup table |

---

## The reusable pieces

**Popup menus.** One function, `openPop(anchor, html, options)`, powers every dropdown: apps, notifications, account, song menu, sort, volume, cast. It positions the popup next to its button, keeps it on screen, and closes on outside click, Escape, resize or scroll. Menu items can carry these attributes:
- `data-toast="text"` shows a toast
- `data-sub="id"` opens a submenu (used for "Add to playlist")
- `data-go="view"` jumps to a screen (or opens the New playlist dialog)
- a parent with `data-single` makes it a pick-one list

**Toast.** One `#toast` element. Anything with `data-toast` shows it when clicked, using a single document-level click listener.

**New playlist dialog.** A modal added to the page by `ui.js`. Nothing is saved when you press Create.

**Queue panel.** A side panel (full-screen on mobile) listing the demo songs. Toggled from the queue icon.

**Song menu.** Three-dot buttons are added to every song row by `addKebabs()`. Every menu item only shows a toast.

**Mobile full-screen player.** `app.js` handles opening it (tap the mini player, ignoring taps on its buttons), closing it (tap the song title area at the top, or swipe down more than 100 px), and keeping the mini and full-screen play/pause icons matching. The song details are duplicated in the markup for the mini player and the full-screen player.

---

## How `ui.js` hooks into the page

`ui.js` was written to add features on top of the original markup without editing it. That has side effects worth knowing before we change things:

- **It finds elements by position.** The header icons are `.header-actions > *` items 0, 1, 2 (apps, notifications, profile) and the player's right-hand icons are `.player-right > *` items 0, 1, 2 (volume, cast, queue). Reordering those icons in the HTML silently breaks their menus.
- **It maps sidebar items to screens by their text** ("Settings", "Trash", "Pretty Music", and so on). Renaming a sidebar label breaks its link.
- **It wraps `showView`** by saving the old function and reassigning the global name. This only works because the scripts are non-module and loaded in order.
- **It rewrites the profile picture** into a letter avatar, which is why the original placeholder image URL never actually shows.
- **It moves the static library rows** into a wrapper so the tabs can hide and show them.

---

## What's real and what's fake

| Real | Fake |
| --- | --- |
| Screen switching and highlighting | Audio playback (there is no audio element) |
| Mobile drawer and bottom nav | Song, album, artist and playlist data |
| Mobile full-screen player open/close and swipe | Progress bars, times, track names in the player |
| Popup menus, modal, queue panel, toasts (as UI) | Every menu action (only shows a toast) |
| Library tabs and sort menu (as UI) | Search box, settings, upload, cast, notifications |
| Responsive layout | Play counts, queue contents |

---

## Things I noticed in the code

None of these are bugs you'd see in normal use, but they matter for the phases ahead.

- **Demo data lives in two places.** The Songs tab rows are in `index.html`; the playlists, queue and trash use a separate `SONGS` array in `ui.js`. They don't match, and the queue highlights a different song from the one the player shows. Phase 3 replaces both with one data store.
- **Sidebar items can trigger `showView` twice** for the same click (once from `app.js`, once from `ui.js`). Harmless, but wasteful.
- **No safe-area handling and no PWA files** (manifest, service worker, iOS tags). Phase 1.
- **Heights use `100vh`**, which is wrong on iPhone when Safari's toolbar shows or hides. Phase 1.
- **The viewport tag disables pinch-zoom** (`user-scalable=no`). Accessibility concern; decision in Phase 1.
- **The icon has transparent corners**, which iOS shows with a black background on the home screen. Phase 1.
- **The README mentions a `.nojekyll` file** that isn't in the project. It isn't needed for Vercel.
- **Both mobile and desktop "next" buttons exist in the markup**; CSS shows one per layout.
- **Lots of inline styles** in the markup, mostly on the placeholder cards. These go away as the cards become real data.

---

## Dependencies

| What | Loaded from | Needed for |
| --- | --- | --- |
| Roboto font | Google Fonts | Text |
| Material Icons font | Google Fonts | Every icon (icons are text ligatures, so with no font you'd see words like "play_arrow") |
| `via.placeholder.com` image | the header markup | Nothing in practice (replaced by a letter avatar; the service is also dead) |

No JavaScript libraries, no build tools, no package manager.

---

## Where the next phases plug in

| Phase | Touches |
| --- | --- |
| 1 Ship-ready shell | `index.html` head, `css/styles.css` (safe-area and `dvh` rules), new `manifest.webmanifest`, `sw.js`, `vercel.json`, icons, and a small registration script |
| 2 Playback | New player module with one audio element and one state object. `app.js` play/pause code is replaced by it; the three sets of controls and the queue panel read from that state |
| 3 Library | New storage module (IndexedDB) and import/tag-reading module. The static library rows in `index.html` and the `SONGS` array in `ui.js` are removed and replaced by data-driven lists |
| 4 Playlists and mixes | Playlist data in storage. The song menu and playlist screens in `ui.js` get real actions |
| 5 Polish | Fonts, backup, error states, accessibility |

### Planned shape of the project

```
index.html
manifest.webmanifest        Phase 1
sw.js                       Phase 1
vercel.json                 Phase 1
css/
js/
  app.js                    screen switching and drawer
  ui.js                     menus and screens (shrinks over time)
  player.js                 Phase 2
  store.js                  Phase 3
  import.js                 Phase 3
assets/
docs/
```

This may change as we go. The aim is to stay with plain scripts and no build step.
