# How it works (today)

This describes the project **as it is at the end of Phase 3**. It will be updated at the end of each phase.

In one sentence: a responsive, plain HTML/CSS/JS music player that **installs on an iPhone, opens offline, and plays your own songs**, which it saves on the device. Add songs once and they are still there next time, with their real titles, artists, albums and cover art, in a library you can browse by song, artist, album and genre, search, and tidy with a Trash. What is still sample content: Listen Now, Instant Mixes, Shop, the sidebar playlists and Settings.


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
| `css/components.css` | ~21 KB | Popup menus, library tabs, library screens, settings/help panels, modal, the queue panel and phone sheet, toast |
| `css/ios.css` | ~7 KB | iPhone-only fixes: safe areas, status-bar strip, screen height (see iPhone layout) |
| `js/app.js` | ~5 KB | Screen switching, mobile drawer, mobile full-screen player (open, swipe-down close) |
| `js/ui.js` | ~21 KB | The menus and the sample screens: all dropdowns, modal, toast, Settings, Help, sample playlists. Also empty containers for the library screens, and `window.AppUI` (menu helpers shared with `library-ui.js`) |
| `js/tags.js` | ~25 KB | Reads song info and cover art from the file's own bytes (MP3, M4A, FLAC, WAV, Ogg), and tidies website promo out of names |
| `js/store.js` | ~6 KB | The on-device database (IndexedDB): songs' info, audio files, cover images |
| `js/library.js` | ~27 KB | Your library: import, duplicates, covers, the shared placeholder-colour rule, grouping, search, sorting, trash, play counts, storage numbers. Never touches the page |
| `js/player.js` | ~24 KB | The playback engine: the one audio element, the queue, shuffle/repeat, lock-screen controls. Never touches the page |
| `js/player-ui.js` | ~23 KB | Draws the engine on screen: player bars, cover art, progress, the queue (panel on a computer, bottom sheet on a phone, with drag, swipe and the Now playing pill), keyboard shortcuts |
| `js/library-ui.js` | ~31 KB | The library screens: Songs / Artists / Albums / Genres tabs, album, artist and genre pages, search, Trash, Add music with import progress and storage panel, the song menu. Connects the library to the player |
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
   2. `ui.js` runs in one self-contained function. It reaches into the existing page, adds the extra screens and menus, and **replaces `showView` with a wrapped version** so the new screens work. It also shares its toast as `window.showToast`.
   3. `tags.js`, `store.js` and `library.js` define `window.Tags`, `window.Store` and `window.Library`. None depends on the page. `library.js` starts reading the database as soon as it is asked to (`Library.init()`).
   4. `player.js` creates the audio element and `window.Player`. It has no dependencies on the page or the library.
   5. `player-ui.js` finds the player bars and queue panel (built by the scripts above) and connects them to `Player`.
   6. `library-ui.js` fills the library, detail, search, trash and add-music screens, wraps `showView` once more, and connects `Library` to `Player` (`Player.configure(...)`).
3. `pwa.js` loads last and registers the service worker once the page has finished loading.
4. `index.html` also calls `toggleSidebar()` and `closeSidebar()` from inline `onclick` attributes, so those two must stay global.

The player has a real state (inside `player.js`), and the screen is drawn from it. The rest of the app (screens, menus) still keeps its state in the page itself, for example which screen is visible.

---

## Layout

- **Desktop:** fixed 64 px header, a sidebar on the left, scrolling content in the middle, a fixed 90 px player bar at the bottom.
- **Mobile (768 px and under):** the sidebar becomes a slide-out drawer, a 56 px bottom nav appears, the player bar becomes a ~70 px mini player sitting above the bottom nav, and tapping it opens a full-screen player that slides up.
- The page itself never scrolls (`body` is `overflow: hidden`); the `.main-content` area scrolls.
- Stacking order, low to high: header 100, player bar 200, queue (desktop) 250, bottom nav 300, drawer overlay 350, drawer 400, full-screen player 500, its control bar 510, the phone queue's dimmed backdrop 519, the phone queue sheet 520, popup menus 1000, modal 1100, toast 1200, iPhone status-bar strip 9999 (iPhones only).

---

## Screens

Switching screens means showing one `.content-view` panel and hiding the others. `showView('id')` does this, updates the header title, highlights the matching sidebar and bottom-nav items, and scrolls to top.

| View id | Where it comes from | What's in it |
| --- | --- | --- |
| `listen-now` | `index.html` (plus extra sections added by `ui.js`) | Fake recent albums, "I'm feeling lucky", fake mixes, new releases, genre chips |
| `library` | Container in `index.html`, filled by `library-ui.js` | Your real songs: tabs for Playlists (a "coming next" note), Artists, Albums, Songs and Genres, with sorting |
| `detail` | Container made by `ui.js`, filled by `library-ui.js` | One album, artist or genre: cover, details, Play / Shuffle, and its songs. The header title is the name |
| `search` | Same | Results for what is typed in the header search box: artists, albums, songs |
| `add` | Same | Choose songs, import progress and results, storage numbers |
| `trash` | Same | Removed songs with Restore and Delete, and Empty trash |
| `mixes`, `shop`, `settings`, `help` | Built by `ui.js` with its `view(id, html)` helper | Placeholder content |
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

**Queue panel.** `ui.js` creates the empty panel (header, a hint line, the list, a "Now playing" pill); `player-ui.js` fills it with the real queue.
- **Computer:** a 340 px panel above the player bar. Each row has a drag handle on the left, the cover, title and artist, the length, and a × to remove it.
- **Phone:** a **bottom sheet**. It slides up from the bottom (300 ms), dims the page behind it with a backdrop, and sits above the full-screen player so it can be opened from there. The top edge clears the status bar. Rows are 64 px tall with a 48 px cover and the drag handle on the right.
  - **Close it** by tapping the dimmed area, the close button, or dragging the top edge (the grabber and header) down. A short or slow drag snaps back.
  - **Remove a song** by swiping it left (a red "Remove" shows underneath). It must go past about 30% of the width; a shorter swipe snaps back, and a swipe never counts as a tap that starts the song.
  - **Reorder** by dragging the handle.
  - A hint ("Drag ≡ to reorder · swipe a song left to remove it") shows until you have used either gesture once.
- **Both:** the playing song is highlighted and shows moving equaliser bars on its cover while playing (still when paused); songs already played are dimmed. The header shows the song count and total time. When the playing song is scrolled out of view, a "Now playing" pill (with an up or down arrow) appears; tapping it scrolls back. The panel opens already scrolled to the playing song.
- **The rows are built only when the panel opens.** A closed panel can't be seen, and building thousands of rows on every tap on a song would delay the music. Changing songs afterwards only moves the highlight; the rows are rebuilt only when the list itself changes.

**Song menu.** Real songs get a working menu from `library-ui.js` (see Your library). The sample playlist rows still get their three-dot buttons from `addKebabs()` in `ui.js`, and those menu items only show a toast.

**Mobile full-screen player.** `app.js` handles opening it (tap the mini player, ignoring taps on its buttons) and closing it (tap the song title area at the top, or swipe down more than 100 px). With nothing queued, tapping the mini player goes to Add music instead. `player-ui.js` keeps the song details, play buttons and progress in the mini and full-screen players matching.

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

**What offline can't do:** the very first visit has to be online. After that everything works offline, including your songs, because they are stored in the on-device database rather than fetched from anywhere.

---

## Playback (`js/player.js` and `js/player-ui.js`)

**Two halves.** `player.js` is the engine: it owns the audio, the queue and the modes, and announces what changed. `player-ui.js` listens and draws. Nothing on screen is updated because a button was tapped; it's updated because the audio element said something happened. That's why a pause from the lock screen, or a phone call, shows up correctly on the buttons.

**One audio element.** Created in code (not in the page) and used for every song. This matters on iPhone: iOS only lets audio start from a tap, and it remembers that permission *per element*. Reusing the same element is what lets the next song start by itself and keep going with the screen locked.

**Where songs come from.** The engine knows nothing about the database. `library-ui.js` hands it a function (`Player.configure({ resolveUrl, cachedUrl, releaseUrl, coverUrl })`) that turns a song id into an audio address. Tapping a song in any list calls `Player.setQueue(thatList, positionTapped)`, so the whole list (a sorted Songs tab, an album, search results) becomes the queue, starting at that song. Shuffle all and the song menu ("Play next", "Add to queue") use `setQueue` and `addTracks`.

**Why playing a song needs care on iPhone.** Reading a song out of the database takes a moment, and iOS may refuse to start audio that begins after such a pause. So:
- The first time a song is played in a session, the engine plays a 10 millisecond silent clip *inside the tap itself*. That lifts iOS's "needs a tap" rule for the audio element for good, so the real song can start a moment later.
- The next song's audio address is fetched while the current one plays, so moving on (including with the screen locked) is instant and needs no new permission.
- Only the current and next songs' addresses are kept; the rest are released so memory stays low.

**Queue and modes**
- The queue is a list plus a pointer to the current song. Adding songs while one plays appends them without interrupting it. If nothing was queued, the first added song plays.
- **Shuffle really reorders the queue** (as the original did), keeping the playing song first, so the queue panel always shows what will play. Turning it off restores the order the songs were added in. Songs added while shuffled go to the end.
- **Repeat** cycles off, all, one. Off: the queue stops after the last song (and the play button resets). All: wraps to the first. One: the song loops.
- **Previous** restarts the song if it's more than 3 seconds in, otherwise goes back (wrapping to the last song when repeating all). **Next** on the last song with repeat off does nothing.
- A song counts as a play once it has really been listened to (30 seconds or half its length, whichever is shorter); skipping through songs adds nothing. The play count is stored with the song.
- Removing the playing song moves to the one that slid into its place and keeps playing. Removing the last song while it plays loads the new last song paused rather than wrapping round.
- A song the device can't decode, or whose audio has gone missing from the database, is marked "can't play", a message is shown, and playback moves on. If every song fails it stops trying.
- Lock-screen artwork is the song's real cover when it has one, the app icon otherwise.

**Progress and seeking.** Both progress bars (desktop bar, full-screen player) can be clicked or dragged, with mouse or finger. The phone's thin mini bar is not a seek bar: tapping it opens the full-screen player. While you drag, the bar and time follow your finger and the seek happens on release. Dragging the full-screen bar is shielded from the swipe-down-to-close gesture. Duration for each queued song is found by loading just its header one at a time; until then the queue shows a dash.

**Lock screen and Control Center (Media Session).** Title, artist and the app icon as artwork, plus play, pause, previous, next and the scrubber. The next button is greyed on the last song unless repeating. The icon is also what a computer shows in its media hub.

**Controls in the page.** Each control carries a `data-player="..."` attribute (`play`, `prev`, `next`, `shuffle`, `repeat`, `queue`, `volume`), and one click handler on the whole page does the work. Shuffle and repeat show orange when on, and repeat changes to the "repeat one" icon.

**Volume.** The slider in the desktop volume menu sets the audio volume and is remembered (along with the repeat mode) in the browser's storage under `gpm.player.v1`. iPhones ignore page volume entirely (the side buttons control it), and the phone layout has no volume control.

**Keyboard shortcuts (computer).** Space plays or pauses, Left/Right jump 5 seconds, Shift+Left/Right go to the previous or next song, M mutes. They are ignored while typing in a box, and don't take over Space until something is loaded.

**Queue panel.** Tap a row to play it (or pause, if it is the playing one), drag the handle to reorder (the playing song keeps playing and the pointer follows it), and on a phone swipe a song left to remove it (on a computer, use the ×). Dragging doesn't auto-scroll a long list yet. See Reusable pieces for the full description.

**Sample songs.** The rows in the sample playlists (sidebar) are still placeholders with no audio, so tapping one says so instead of doing nothing. Real songs are recognised by a `data-track` attribute on their row.

---

## Your library (`tags.js`, `store.js`, `library.js`, `library-ui.js`)

**The three layers.** `store.js` is the database, `library.js` is what the app does with it, and `library-ui.js` is what you see. Each only talks to the one below.

**What is stored (IndexedDB, in the browser, on the device).** Three tables, kept apart so that listing your songs never loads any audio:

| Table | Holds | Looked up by |
| --- | --- | --- |
| `tracks` | One small record per song: title, artist, album, album artist, genre, year, track and disc number, length, size, file type, date added, play count, last played, when it was trashed, which cover it uses | song id |
| `blobs` | The audio file itself | song id |
| `covers` | One cover image per album (re-saved at most 512 pixels wide, as a JPEG) | album key |

At start-up all the small `tracks` records are read into memory. Browsing, sorting, grouping and searching then never touch the database, and audio is only read when a song is about to play.

**Importing.** For each chosen file, one at a time (so the screen stays responsive and shows progress):
1. **Tags** (`tags.js`) are read from the file itself, touching only the bytes where tags live: MP3 (ID3v2.2, 2.3, 2.4 and ID3v1), M4A/MP4, FLAC, WAV and Ogg (text only). Cover art comes out too; the front cover is preferred. A damaged or tag-less file just returns empty fields; it never throws.
2. **Tidy-up and file name fallback.** Music download sites often stamp themselves into the tags. These are cleaned so names read properly, and the original text is always kept (`rawNames` on the song):
   - A bar followed by a web address is cut off: `Body (Remix) || TrendyBeatz.com` becomes `Body (Remix)`, and `KU LO SA (Full Version) | val9ja.com` becomes `KU LO SA (Full Version)`. A bar with no web address after it is left alone.
   - Dashes, bars and colons dangling at either end go: `Oxlade –` becomes `Oxlade`. Real names are never altered.
   - Web addresses in brackets (`[www.site.com]`) go.
   - An album that is just a website, or a social-media handle (`IG: @someone`, `@handle`), or "Visit site.com", is dropped, so those songs fall under "Unknown album". Albums that merely start with a word like "Instagram" or "Follow" are kept.
   - If a tag is missing, the file name is used: `Artist - Title.mp3` is split, a leading track number such as `03_` is dropped, and clutter such as `(Official Music Video)`, `[Official Audio]` or `(Lyrics)` is removed. `(feat. someone)` is kept. No artist at all becomes "Unknown artist".
   - **Songs added before this existed** are tidied once the first time the app starts (a flag in the browser's storage stops it repeating), and the originals are kept.
   - **Duplicate detection uses the original text**, not the tidied text, so a file you added earlier is still recognised as a duplicate after tidying.
3. **Check it plays.** A short load of the audio (the same way the player will use it) gives the true length and proves this device can decode it. A file the device can't play (for example Ogg on an iPhone, or a damaged file) is refused with a reason rather than saved as a dead entry.
4. **Duplicates.** Two files are the same song if title, artist, album and byte size all match. Duplicates are skipped and counted. A match that is in the Trash is brought back instead.
5. **Cover.** Shrunk to at most 512 pixels so a big library stays light. One cover is kept per album, however many songs share it.
6. **Save** the record, the audio and the cover in one all-or-nothing database transaction. If the browser refuses the file (some Safari versions dislike a blob that still points at the picked file) it retries with a real copy of the bytes. If the device is out of space the import stops, keeps what was already saved, and says so.

The browser is also asked to treat the library as persistent (`storage.persist()`), so it isn't cleared when space runs low. The Add music screen shows how many songs, how much space they use, how much is free, and whether that protection was granted. Installed Home Screen apps are generally exempt from Safari's "clear after 7 days unused" rule; plain browser tabs are not.

**Browsing.** Songs, artists, albums and genres are worked out from the in-memory records.
- **Artists** group by album artist, falling back to artist, so a compilation doesn't create dozens of one-song artists.
- **Albums** group by artist and album name; tracks are ordered by disc, then track number.
- An artist's picture is the cover of their biggest album.
- **Sorting** (Songs: recently added, A to Z, artist, most played, duration; Albums and Artists have their own) ignores case and a leading "The", "A" or "An".
- **Search** matches title, artist, album and genre, ignores accents ("beyonce" finds Beyoncé), and requires every typed word to match in any order.
- Long lists are drawn 120 rows at a time as you scroll, so thousands of songs stay quick (2,500 tested).

**Trash.** Removing a song moves it to the Trash and takes it out of the queue (playback carries on if other songs are queued). Restore brings it back with its play count. Songs are deleted for good after 30 days, or immediately with Delete or Empty trash (both ask first). Deleting also removes a cover nobody else uses.

**Covers on screen.** Any element marked `data-cover="key"` gets its picture the moment it has loaded. Until then, and for songs with no picture at all, it shows a colour with a music note.

**One colour per album, everywhere.** The placeholder colour is chosen by one rule in `library.js`, so the same thing is the same colour wherever it appears: library rows, album cards, album page, mini player, full-screen player, queue. A song **with an album** is coloured by artist + album (so all songs on an album match, as real covers would). A song **without an album** is coloured by title + artist. Artists and genres have their own colours. Before this rule the library and the players each picked a colour their own way, which is why they disagreed.

**The song menu** (the three dots on a song): Play next, Add to queue, Add to playlist (a placeholder until playlists exist), Go to artist, Go to album, Remove from library.

---

## What's real and what's fake

| Real | Fake |
| --- | --- |
| **Your songs**, saved on the device with real tags and cover art | Listen Now, Instant Mixes, Shop |
| Songs / Artists / Albums / Genres browsing, album and artist pages | The sidebar playlists (Auto Playlists, Thumbs up, Last added, Pretty Music...) |
| Search, sorting, play counts, Trash (restore, delete forever, 30-day expiry) | Thumbs up/down, the player's "more" menu, cast |
| Audio playback, queue, shuffle, repeat, seek, volume (computer), keyboard shortcuts | "Add to playlist", Settings, notifications |
| Lock-screen / Control Center controls, with album art | Playlists tab (shows a "coming next" note) |
| Install to Home Screen, offline opening and offline listening, iPhone fit | |


---

## Things I noticed in the code

None of these are bugs you'd see in normal use, but they matter for the phases ahead.

**Still open**

- **Sample content remains** on Listen Now, Instant Mixes, Shop, Settings and the sidebar playlists. Phase 4 (playlists, Listen Now from your real activity) and Phase 5 (Settings) deal with it.
- **Reordering a very long queue by dragging** can't scroll while you drag.
- **Opening the queue with thousands of songs queued takes a moment** (roughly half a second to a second for 2,500 on a computer, longer on a phone), because every row is built at that point. Typical queues open instantly.
- **The name tidy-up can't catch every kind of promo text.** It handles bars followed by web addresses, web addresses in brackets, dangling separators and promo-only albums. Other patterns stay as they are until there is a way to edit names (not planned yet; the originals are kept in `rawNames`).
- **Importing is one file at a time and needs the app open.** If iOS suspends the app mid-import, the songs already saved are kept and you can add the rest again (duplicates are skipped).
- **No backup yet.** The library lives only on this device; clearing the site's data or deleting the Home Screen app deletes it. Phase 5.
- **Ogg files** can't be played by iPhone, so they're refused at import there (they work on most computers). Their tags are read as text only.
- **Sidebar items that already had a `data-view` in the HTML can trigger `showView` twice** for one click (once from `app.js`, once from `ui.js`). Harmless, but wasteful.
- **Both mobile and desktop "next" buttons exist in the markup**; CSS shows one per layout.
- **Lots of inline styles** in the markup, mostly on the placeholder cards.
- **Phones in landscape get the desktop layout**, which is cramped. Phase 5.
- **Popup menus are positioned by script and don't know about the safe areas.** A menu opened right at a screen edge could sit slightly under the home bar. Low risk; revisit if it shows up on a device.
- **Detail pages have no browser Back.** A "My Library" link at the top returns you; the phone's swipe-back gesture leaves the app's page instead.

**Fixed in Phase 3, after trying it on an iPhone**

- A song with no cover picture was a different colour in the library, the mini player and the full-screen player, and plain grey in the queue: one colour rule now, and a music note in the queue too.
- The phone queue was a cramped full-width list with a tiny grey handle: now a bottom sheet with bigger rows, swipe-to-remove, a "Now playing" pill and equaliser bars on the playing song.
- Names carrying website promo or stray dashes (`|| TrendyBeatz.com`, `Oxlade –`): tidied, originals kept.
- Tapping a song in a very long list built the whole queue panel before the music could start: rows are now built only when the panel is opened.

**Fixed in Phase 3**

- Songs vanished when the app closed: now saved on the device.
- Names came only from file names and covers were generated colours: real tags and artwork are read; file-name fallback is cleaned up.
- Library, Trash and Add music were fake: all real.
- Search box did nothing: works.
- Play counts and the song menu were placeholders: real.
- Song lengths used to be read one file at a time after adding: now read once at import and stored.

**Fixed in Phase 2**

- The player bars, progress, times and queue were static placeholders: now driven by real audio.
- The queue panel showed a different song from the player: it's now the real queue.
- The queue panel opened behind the full-screen player on phones: it now sits above it.

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

No JavaScript libraries, no build tools, no package manager. Both fonts are saved by the service worker after the first online visit, so they work offline afterwards. Your songs are saved in the on-device database, not fetched from anywhere.

---

## Where the next phases plug in

| Phase | Touches |
| --- | --- |
| 1 Ship-ready shell | Done. See iPhone layout, and Offline and install |
| 2 Playback | Done. See Playback |
| 3 Library | Done. See Your library |
| 4 Playlists and mixes | A `playlists` table in `store.js` and playlist functions in `library.js`; the sample playlist screens in `ui.js` and the placeholder Playlists tab and "Add to playlist" in `library-ui.js` become real. Listen Now reads play history from the library |
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
  player.js                 playback engine
  player-ui.js              draws the engine on screen
  tags.js                   reads tags and cover art from files
  store.js                  the on-device database
  library.js                your library: import, browse, search, trash
  library-ui.js             the library screens
assets/
docs/
```

This may change as we go. The aim is to stay with plain scripts and no build step. Any new file must also be added to `SHELL_FILES` in `sw.js`.
