# How it works (today)

This describes the project **as it is at the end of Phase 1**. It will be updated at the end of each phase.

In one sentence: a responsive, plain HTML/CSS/JS recreation of the Google Play Music web app that **installs on an iPhone and opens offline**. It looks complete, but **the content is not real yet**: no audio plays, and all songs, albums and settings are hard-coded placeholders.

---

## Run it

No install, no build.

```bash
cd google-play-music
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works, but offline support only runs on `https://` or `localhost`. The first online visit saves the fonts and icons (see Offline and install).

---

## File map

| File | Size | Role |
| --- | --- | --- |
| `index.html` | ~21 KB | The page head (install and iPhone tags) and all the base markup: header, sidebar, **Listen Now** and **My Library** screens, desktop player bar, mobile full-screen player, mobile bottom nav |
| `css/styles.css` | ~29 KB | Variables, layout, header, sidebar, cards, song rows, player bar, and all mobile rules (two breakpoints: 992 px and 768 px) |
| `css/components.css` | ~11 KB | Popup menus, library tabs, settings/help/upload panels, modal, queue panel, toast |
| `css/ios.css` | ~7 KB | iPhone-only fixes: safe areas, status-bar strip, screen height (see iPhone layout) |
| `js/app.js` | ~6 KB | Screen switching, mobile drawer, mobile full-screen player (open, swipe-down close, play/pause icon swap) |
| `js/ui.js` | ~24 KB | Everything else: builds extra screens, all dropdown menus, library tabs, modal, queue, toast |
| `js/pwa.js` | ~5 KB | Registers the service worker, measures the iOS 26 bottom strip, hidden diagnostic panel |
| `sw.js` | ~7 KB | Service worker: saves the app for offline use (see Offline and install) |
| `manifest.webmanifest` | <1 KB | Install info: name, colours, icons |
| `vercel.json` | <1 KB | Vercel cache headers and the `/docs` redirect |
| `assets/icon.png`, `assets/logo.png` | 256×256 | Identical images, used as favicon, sidebar logo and share image |
| `assets/icons/` | | Home-screen and install icons (180, 192, 512, maskable) plus the two SVG sources they are drawn from |
| `docs/` | | This file, the roadmap, and the iPhone test checklist |

---

## How the page starts up

1. The browser loads `index.html`, which contains the markup for the two main screens and the player.
2. Scripts are plain files (not modules) and **must load in this order**:
   1. `app.js` defines `showView()`, `toggleSidebar()`, `closeSidebar()` and the full-screen player behaviour.
   2. `ui.js` runs in one self-contained function. It reaches into the existing page, adds the extra screens and menus, and **replaces `showView` with a wrapped version** so the new screens work.
3. `pwa.js` loads last and registers the service worker once the page has finished loading.
4. `index.html` also calls `toggleSidebar()` and `closeSidebar()` from inline `onclick` attributes, so those two must stay global.

There is no state object. What's on screen **is** the state: for example, the app decides whether the player is playing by reading the text of the play/pause icon.

---

## Layout

- **Desktop:** fixed 64 px header, a sidebar on the left, scrolling content in the middle, a fixed 90 px player bar at the bottom.
- **Mobile (768 px and under):** the sidebar becomes a slide-out drawer, a 56 px bottom nav appears, the player bar becomes a ~70 px mini player sitting above the bottom nav, and tapping it opens a full-screen player that slides up.
- The page itself never scrolls (`body` is `overflow: hidden`); the `.main-content` area scrolls.
- Stacking order, low to high: header 100, player bar 200, queue (desktop) 250, bottom nav 300, drawer overlay 350, drawer 400, queue (mobile) 450, full-screen player 500, its control bar 510, popup menus 1000, modal 1100, toast 1200, iPhone status-bar strip 9999 (iPhones only).

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

## iPhone layout (`css/ios.css`)

The page is told to draw edge to edge (`viewport-fit=cover` in the viewport tag), and the app declares itself full-screen (`apple-mobile-web-app-capable`) with a see-through status bar. That means the page now sits **under** the clock and battery at the top and the home bar at the bottom, so the layout has to leave room for them.

- **Safe areas.** iOS reports how much room to leave through `env(safe-area-inset-top/right/bottom/left)`. `ios.css` copies them into four short variables (`--sat`, `--sar`, `--sab`, `--sal`) and adds them to the header, bottom nav, mini player, full-screen player, drawer, queue, toast and dialogs. Outside the Home Screen app (a normal Safari tab, desktop) the values are 0, so nothing moves.
- **Status-bar strip.** A fixed orange bar (`body::before`) fills the area behind the clock so its white text is readable, including over white panels like the drawer. It sits above everything else.
- **iPhone only.** Every rule is wrapped in two checks: `@supports (-webkit-touch-callout: none)` (true only in iOS WebKit) and a phone-size media query (`max-width: 480px` or `max-height: 480px`, which an iPad never matches). Inside those, the file mirrors the app's own two layouts: `max-width: 768px` for the mobile layout, and `min-width: 769px` for the desktop layout that a phone gets in landscape.
- **Screen height.** Heights use `100dvh` (the visible height, which follows Safari's toolbar) with `100vh` as a fallback for older iOS.
- **The iOS 26 bottom-strip bug.** In an installed iPhone app with a see-through status bar, iOS 26 can make the page area shorter than the screen by the status-bar height. Nothing can be drawn in the strip left at the bottom, and the system colours it using the page's background colour (it was grey in the first screenshot). This is an open, unfixed WebKit bug (tracked as 301994, still reported on iOS 26.5.2 and the iOS 27 beta). We defend in three layers:
  1. In the installed app only, `<html>` gets a minimum height of the full screen (`min(100lvh, 100% + top inset)`). iOS only shortens the viewport while the page is shorter than the screen, and this has restored full height in the iOS 26.2 simulator. One report from a real device says nothing recovered the strip, so this may not work for everyone.
  2. `js/pwa.js` measures what is left (`screen height - visible height`) into `--ios-gap`, only on iPhones in the installed app, and ignores it while you're typing. `ios.css` subtracts it from the home-bar padding, so the bottom bar doesn't add padding on top of the strip.
  3. `<html>` is painted white, the same as the bottom bar, so any strip that remains looks like part of the bar rather than a grey gap. (The system only re-reads this colour when the app is relaunched.)
- **Small iOS fixes.** No double-tap zoom delay, no tap highlight, no rubber-band scrolling that drags the whole page, and form fields are 16px so Safari doesn't zoom in when you tap one.

Adding anything new that is fixed to the top or bottom of the screen means giving it the same treatment in this file.

---

## Offline and install

**Install.** `manifest.webmanifest` gives the app its name, colours and icons. iOS mostly ignores the manifest's icons and uses `apple-touch-icon` from the page head, so both exist. The iOS icon is full-bleed (iOS adds its own rounded corners; transparent corners would show black).

**Service worker (`sw.js`).** A small script the browser keeps running in the background, which sits between the page and the network:

| Request | What it does |
| --- | --- |
| Files from this site | **Network first.** Online: fetch the newest version (always checking with the server, never trusting the browser's own cache), show it, and save a copy. Offline, or network slower than 3 seconds: show the saved copy |
| Google Fonts files | **Cache first.** Saved once, then reused |
| Anything else (and audio range requests) | Passes straight through |

- On install it saves every file listed in `SHELL_FILES`, plus the Latin Roboto fonts and the Material Icons font. If Google is unreachable this is skipped and never blocks install.
- The page can be reached as `/`, `/index.html` or `/?something`; all are served from one saved copy.
- Because files are fetched fresh whenever you're online, you only change `VERSION` in `sw.js` when you **add or remove files** from `SHELL_FILES`. Changing it deletes the old saved copies.
- `vercel.json` makes sure browsers never reuse an old `sw.js`, which would otherwise stop updates arriving.

**Hidden diagnostic panel.** Open the menu and tap the "Google Play music" title 5 times quickly. A panel shows the screen size, visible size, safe areas, `dvh/svh/lvh`, the measured strip and where the bottom bar sits. Tap it to close. It exists so layout problems on a real iPhone can be diagnosed from one screenshot. Adding `?debug` to the address opens it on load (handy on a computer).

**What offline can't do:** the very first visit has to be online. Songs will be a different story: from Phase 3 they live on the device itself.

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
| Install to Home Screen, offline opening | |
| iPhone safe-area fit | |

---

## Things I noticed in the code

None of these are bugs you'd see in normal use, but they matter for the phases ahead.

**Still open**

- **Demo data lives in two places.** The Songs tab rows are in `index.html`; the playlists, queue and trash use a separate `SONGS` array in `ui.js`. They don't match, and the queue highlights a different song from the one the player shows. Phase 3 replaces both with one data store.
- **Sidebar items that already had a `data-view` in the HTML can trigger `showView` twice** for one click (once from `app.js`, once from `ui.js`). Harmless, but wasteful.
- **Both mobile and desktop "next" buttons exist in the markup**; CSS shows one per layout.
- **Lots of inline styles** in the markup, mostly on the placeholder cards. These go away as the cards become real data.
- **Phones in landscape get the desktop layout**, which is cramped. Phase 5.
- **Popup menus are positioned by script and don't know about the safe areas.** A menu opened right at a screen edge could sit slightly under the home bar. Low risk; revisit if it shows up on a device.

**Fixed in Phase 1**

- No safe-area handling, no PWA files: added.
- `100vh` heights: now `100dvh` on iPhone.
- Pinch-zoom lock in the viewport tag: removed.
- Icon with transparent corners on the home screen: new full-bleed icon.
- Dead `via.placeholder.com` image URL: removed.
- README's `.nojekyll` and GitHub Pages mention: replaced with Vercel steps.

---

## Dependencies

| What | Loaded from | Needed for |
| --- | --- | --- |
| Roboto font | Google Fonts | Text |
| Material Icons font | Google Fonts | Every icon (icons are text ligatures, so with no font you'd see words like "play_arrow") |

No JavaScript libraries, no build tools, no package manager. Both fonts are saved by the service worker after the first online visit, so they work offline afterwards.

---

## Where the next phases plug in

| Phase | Touches |
| --- | --- |
| 1 Ship-ready shell | Done. See iPhone layout, and Offline and install |
| 2 Playback | New player module with one audio element and one state object. `app.js` play/pause code is replaced by it; the three sets of controls and the queue panel read from that state |
| 3 Library | New storage module (IndexedDB) and import/tag-reading module. The static library rows in `index.html` and the `SONGS` array in `ui.js` are removed and replaced by data-driven lists |
| 4 Playlists and mixes | Playlist data in storage. The song menu and playlist screens in `ui.js` get real actions |
| 5 Polish | Fonts, backup, error states, accessibility |

### Planned shape of the project

```
index.html
manifest.webmanifest
sw.js
vercel.json
css/                        styles, components, ios
js/
  app.js                    screen switching and drawer
  pwa.js                    registers the service worker
  ui.js                     menus and screens (shrinks over time)
  player.js                 Phase 2
  store.js                  Phase 3
  import.js                 Phase 3
assets/
docs/
```

This may change as we go. The aim is to stay with plain scripts and no build step. Any new file must also be added to `SHELL_FILES` in `sw.js`.
