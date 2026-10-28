# Roadmap

Goal: turn this from a visual demo into a **working music player that installs on an iPhone like an app, works offline, and plays your own music**.

Status key: ⬜ not started · 🟨 in progress · ✅ done

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Baseline and docs | ✅ |
| 1 | Ship-ready shell: Vercel, PWA, offline, iPhone safe areas | ✅ |
| 2 | Real playback engine | ✅ |
| 3 | Your library: import, store, browse | 🟨 built; waiting on your iPhone check |
| 4 | Playlists, queue and mixes | ⬜ |
| 5 | Reliability and polish | ⬜ |
| 6 | Maybe later: accounts and sync | ⬜ |

---

## How we work

- One phase at a time. Each phase ends with a full zip of the project.
- Every phase has a **Done when** list. We don't move on until it's true.
- Small, separate commits inside a phase. A plain-English commit message is given in chat each time (not stored in any file).
- The app stays plain HTML, CSS and JavaScript with **no build step**, so it deploys to Vercel as a static site.
- Desktop keeps working. iPhone-specific changes are scoped so they don't touch desktop or Android.

---

## Decisions I'm assuming (tell me if any are wrong)

1. **Music comes from files you add yourself** (MP3, AAC/M4A, FLAC where the browser supports it), stored on the device. There is no licensed catalog and no backend, so this is the only way a static Vercel site can play real music. The existing "Add music" screen is already shaped for this.
2. **The app is single-user and local-first.** Your library lives in your own browser/phone storage. Nothing is uploaded to a server.
3. **Screens that can't be real get removed or repurposed**, not left as fakes (see the table near the end).
4. **Name and branding.** "Google Play Music" and its logo belong to Google, and the service no longer exists. The README already says this is unofficial. Before sharing a public Vercel link or putting it on a home screen under that name, consider a different name and icon. This does not block Phase 1; it only changes a couple of strings and the icon files.

---

## Phase 0: Baseline and docs ✅

- Project rebuilt from the Codemini export, code untouched.
- `docs/roadmap.md` and `docs/how-it-works.md` added.

---

## Phase 1: Ship-ready shell ✅

**Goal:** the current UI deploys to Vercel, installs from Safari with "Add to Home Screen", opens full-screen with no browser bars, still opens in airplane mode, and fills the iPhone screen properly at the top and bottom.

**Status:** done. Built, tested in a desktop browser that imitates an iPhone, then deployed and checked on a real iPhone with every item in `docs/testing-on-iphone.md` passing (after one fix round for the iOS 26 bottom strip).

### What was built

- **Vercel:** `vercel.json` sets cache rules for `sw.js`, the manifest's content type, and two small security headers. `/docs` redirects to the home page so the roadmap isn't on the public site.
- **Installable app:** `manifest.webmanifest`, iOS meta tags, and new icons redrawn as vectors (`assets/icons/`): full-bleed for iOS, rounded for Android, and a maskable one.
- **Offline:** `sw.js` saves the app files and the fonts, and `js/pwa.js` registers it.
- **iPhone screen fit:** `viewport-fit=cover`, an orange strip behind the status bar, and safe-area padding on the header, bottom nav, mini player, full-screen player, drawer, queue, toast and dialogs, all in `css/ios.css`. Heights use `100dvh`.
- **iPhone only:** every rule in `ios.css` sits behind an iOS-WebKit check plus a phone-size check (see the top of that file). Desktop, iPad and Android are untouched.
- **Cleanups:** removed the dead `via.placeholder.com` URL, removed the pinch-zoom lock (and made form fields 16px on iPhone so Safari doesn't zoom when you tap them), and updated the README (Vercel steps replace GitHub Pages).

### Fix round 1: bottom strip on iOS 26 (found on a real iPhone)

The first real-device test showed the bottom nav stopping about 44pt short of the screen edge, with grey underneath. That is an open WebKit bug (iOS 26 shortens an installed app's page area by the status-bar height), not a mistake in the layout. I added three defences (see `how-it-works.md`): a full-screen `min-height` on `<html>` that has worked in the iOS 26.2 simulator, a measurement of any leftover strip so the bottom bar doesn't pad twice, and a white page background so a leftover strip looks like part of the bar. There is also a hidden diagnostic panel for reading the real numbers off a device.

Whether the full-height workaround takes effect depends on the iOS version, and I can't test on a device. The worst case is a white strip that looks like part of the bottom bar.

### Where this differs from the original plan

| Plan said | What I did | Why |
| --- | --- | --- |
| "Update available, tap to refresh" toast | The service worker is **network first**: online means newest files every time, offline means the saved copy | There is no stale-version problem to manage, and no toast needed |
| Keep `docs/` off the site with `.vercelignore` | A redirect in `vercel.json` | `.vercelignore` isn't reliably applied to deploys that come from GitHub |
| Fonts may need self-hosting | Fonts are saved automatically on first online visit | I can't download files here. Self-hosting stays an option in Phase 5 if the on-device test shows a problem |

### Checked here (desktop browser imitating an iPhone)

- [x] Desktop, tablet and Android-style phone layouts are **pixel-identical** to before.
- [x] iPhone portrait with a 47px notch and 34px home bar: header, bottom nav, mini player, drawer, full-screen player and queue all land where they should, with no gaps or overlaps (measured, 20 checks).
- [x] iPhone landscape with 47px side notches: content, header and player are clear of the notch.
- [x] Offline: with the network off, `/`, `/index.html` and `/?query` all open, every screen builds, there are no JS errors.
- [x] A changed file shows up on the next online load, and that newer copy is what opens offline afterwards.
- [x] Changing `VERSION` in `sw.js` removes the old saved copies.
- [x] A blocked or unreachable Google Fonts does not break install.
- [x] The font-saving logic works against sample Google CSS (not against the real Google servers, which I can't reach from here).

### Checked on a real iPhone

- [x] Live on a Vercel URL.
- [x] Real iPhone, **after fix round 1**: bottom bar reaches the bottom edge, or any strip under it is plain white and looks like part of the bar.
- [x] Real iPhone: Add to Home Screen works, opens full-screen, clock readable, nothing hidden by the notch or home bar.
- [x] Airplane mode, fully close and reopen: it still opens **with icons showing as pictures**.
- [x] Rotating to landscape looks right.
- [x] `/docs/roadmap.md` on the live site redirects to the home page.

### Known limits

- **Landscape on a phone** uses the desktop layout, which is cramped on a 390px-tall screen. It is safe (nothing under the notch) but not pretty. Fixing it means making the mobile layout also apply to landscape phones; I've left it out of Phase 1 and can add it in Phase 5.
- **Your first visit must be online.** Offline use starts after one online open.
- **iOS 26 bottom strip.** An open WebKit bug can leave a strip at the bottom of an installed app that no page element can reach. We work around it as far as is possible; a guaranteed fix would need a solid (non-see-through) status bar, which gives up the orange strip at the top. That is an option if the workaround isn't enough.
- **Real iPhone only.** I couldn't run Safari itself here, so iOS-specific behaviour (status bar colour, the exact insets) is checked by measurement, not by eye on a device.

## Phase 2: Real playback engine ✅

**Goal:** the player bar actually plays audio.

**Status:** done. Built and tested in a desktop browser with real audio files, then confirmed on a real iPhone: songs added from the Files app played, the queue and full-screen player worked, and the lock screen showed the song, artist, scrubber and controls (your screenshots).

### What was built

- **Engine** (`js/player.js`): one audio element for the whole app, a queue with a current-song pointer, shuffle, repeat (off, all, one), volume, seeking, error handling for files that can't be decoded, and Media Session (lock screen) integration.
- **Screens** (`js/player-ui.js`): the desktop bar, the phone mini player and the full-screen player are all driven by the engine, so their buttons, titles, times and progress always agree. Both progress bars are clickable and draggable. Shuffle and repeat show their state.
- **Queue panel:** shows the real queue with song lengths; tap to play, x to remove, drag the handle to reorder, Clear to empty. On a phone it opens above the full-screen player.
- **Add music:** a working **Choose songs** button (file picker on a phone, drag and drop on a computer) and a list of what's queued.
- **Lock screen / Control Center:** song name, artist, app icon, play, pause, previous, next and scrubber.
- **Computer extras:** keyboard shortcuts (Space, arrows, M) and a working volume slider.
- **Empty state:** with nothing queued the player says "Nothing playing", and tapping play or the player goes to Add music.
- **Honest sample rows:** tapping a fake song on the Library or playlist screens now says it's a sample instead of doing nothing.

### Where this differs from the original plan

| Plan said | What I did | Why |
| --- | --- | --- |
| Queue "supports play-from-here, remove and reorder" | Done, with drag-to-reorder using a handle | Works with mouse and touch |
| First test content: a file picker | The **Add music** screen is the picker | It already existed as a placeholder; it will be reused for the permanent library |
| Volume | Slider on computers only; hidden on phones | iPhones ignore page volume (the side buttons control it) |
| (not planned) | Phone queue now opens above the full-screen player | Otherwise the queue icon in that player opened it behind the player, unseen |
| (not planned) | Volume and repeat mode are remembered | Cheap, and expected |

### Checked here (desktop browser, real MP3/WAV/OGG files)

- [x] Add songs: audio files queued, non-audio skipped and counted, names parsed from `Artist - Title`, first song plays by itself (58 checks across transport, keyboard, shuffle/repeat, errors, queue, volume).
- [x] Seeking by click and drag; the bar, time labels and play icons stay in sync across the desktop bar, mini player and full-screen player.
- [x] Shuffle on/off never loses or duplicates a song and restores the original order; repeat off/all/one behave correctly at the end of the queue.
- [x] A corrupt file is marked "can't play", announced, and skipped; the queue keeps going.
- [x] Queue: play from a row, remove, drag-reorder (the playing song keeps playing), remove the playing song, Clear.
- [x] Phone layout (touch): full-screen player, drag-seeking by touch **without** closing the player even with downward drift, a real swipe-down still closes it, queue above the player, mini bar tap opens the player.
- [x] The iOS rule is simulated: when the browser refuses to start audio until a tap, the first song is loaded and paused, "Tap play to start" is shown, a tap starts it, and the next song then starts by itself.
- [x] Edge cases: adding songs mid-playback, removing songs before/after the current one, shuffle combined with adds and clears, wrap-around, invalid moves, memory released on removal.
- [x] Offline: with the network off the app opens and a song can be added and played.
- [x] All Phase 1 checks (safe areas, offline, iOS 26 strip logic) still pass.

### Checked on a real iPhone

- [x] Add songs from the Files app and play them (does iOS start the first one itself, or ask for a tap?).
- [x] Lock the phone: music continues, the lock screen shows title, artist and icon, and its buttons work.
- [x] Switch to another app: music continues.
- [x] Dragging the full-screen progress bar with a finger feels right.
- [x] Song lengths appear in the queue (on iPhone they may stay as a dash until played).
- [x] Phone call / interruption leaves the app showing paused.

### Known limits

- **Formats depend on the device.** iPhone normally plays MP3, M4A/AAC, WAV and FLAC, but I haven't confirmed every format on a device; a file the phone can't decode shows "can't play" and is skipped. `.ogg` files are the most likely to fail on iPhone (they work on most computers).
- **Dragging in a very long queue** can't auto-scroll while you drag.
- **The Library, playlists, thumbs and song menus are still sample content.** Phases 3 and 4.

## Phase 3: Your library 🟨

**Goal:** the library is your real music, saved on the device.

**Status:** built, and tried on a real iPhone: adding songs, the library, playback, the queue and lock-screen cover art all worked (your screenshots). The trial turned up three things, fixed below as "fix round 1". Still to confirm on the phone: the items under "Still to check".

### What was built

- **On-device database** (`js/store.js`, IndexedDB): songs' info, the audio files and the cover images are kept in three separate tables, so listing songs never loads audio. Everything survives closing the app and works offline.
- **Tag reader** (`js/tags.js`): title, artist, album, album artist, genre, year, track and disc number, and the cover art, read from MP3 (ID3v2.2/2.3/2.4 and ID3v1), M4A, FLAC, WAV and Ogg (text only). Tested against ffprobe. Damaged files can't crash it.
- **Library** (`js/library.js`): import with a "does it really play on this device" check, duplicate detection, cover re-sizing, grouping into artists / albums / genres, sorting, accent-insensitive search, trash with 30-day expiry, real play counts, and storage numbers.
- **Screens** (`js/library-ui.js`): Songs, Artists, Albums and Genres tabs with sorting; album, artist and genre pages with Play and Shuffle; search results; the Trash (Restore, Delete, Empty trash, with confirmation); the Add music screen with live import progress, a results summary and a storage panel with a Protect button.
- **Player changes:** the player now plays songs from the library (`Player.setQueue` / `addTracks`). A silent unlock inside the first tap and next-song pre-loading keep iOS from refusing audio that has to be read from the database first. Real covers appear in the mini player, the full-screen player, the queue and the lock screen.
- **Song menu:** Play next, Add to queue, Go to artist, Go to album and Remove from library all work.
- **Fix found while building:** the tab bar was being squeezed on phones; it now gets its own row.

### Fix round 1 (after the first iPhone trial)

You reported that songs with no cover picture were different colours in different places and plain grey in the queue, and asked for the phone queue to be redesigned. Looking at your screenshots I also saw website promo in many names. Done:

- **One colour rule.** The library and the players each picked a placeholder colour their own way, and the queue didn't use one. Now a single rule in `library.js` decides: a song with an album is coloured by artist + album (so an album's songs match, as real covers would); a song with no album by title + artist. Library rows, album cards, the album page, the mini player, the full-screen player and the queue all use it, and queue rows without a picture show a music note.
- **Phone queue redesigned as a bottom sheet:** slides up with a dimmed backdrop; big title with song count and total time; 64 px rows with a 48 px cover and the drag handle on the right; the playing song highlighted with moving equaliser bars and earlier songs faded; swipe a song left to remove it; drag the handle to reorder; a "Now playing" pill when the playing song is scrolled away; close by tapping outside, the close button, or dragging the top edge down; a one-time hint. The computer's panel keeps its layout.
- **Names tidied:** `|| TrendyBeatz.com`, `| val9ja.com`, a trailing dash (`Oxlade –` is now `Oxlade`, the artist is untouched), web addresses in brackets, and albums that are just a website or a social handle (`IG: @Cee_Naija`). Songs you already added are tidied once, and the original text is kept for every song, so this can be undone. Duplicate detection still uses the original text, so re-adding a file you already have is still caught.
- **Faster taps in a big library:** the queue's rows are built only when the queue is opened. Tapping a song in a 2,500-song list used to spend about 245 ms building a panel nobody could see before the music started; it now costs about 7 ms.

### Where this differs from the original plan

| Plan said | What I did | Why |
| --- | --- | --- |
| "Play next / Add to queue / Go to artist / Go to album" in Phase 4 | Done now | A library with no way to queue a song would feel broken, and the pieces were already there |
| Playlists tab | Shows a "coming next" note | Playlists are Phase 4 |
| Read tags from every format | Ogg files: text tags only, no artwork | Ogg artwork is stored in a way that is easy to get wrong; and iPhone can't play Ogg anyway |
| Files iPhone can't play | Refused at import, with a reason | Better than a library full of songs that can't play |
| "Listen Now: Recent activity" is Phase 4 | Unchanged | Still sample content until Phase 4 |

### Checked here (desktop browser, real files)

- [x] **Tag reader** (28 checks, Node, against ffprobe): every field and the cover from MP3 v2.3 (UTF-16 text, accents and Japanese), v2.4, ID3v1, M4A, FLAC, WAV and Ogg; junk, empty, cut-off and fake files return empty fields without crashing; file-name clean-up.
- [x] **Data layer** (29 checks, real browser database): import, covers re-sized to 512 px, grouping, accent-insensitive search, duplicate detection, trash / restore / purge, storage numbers, and **everything intact after a reload**.
- [x] **Screens** (68 checks): import 27 songs through the real file chooser; every tab and sort; album, artist and genre pages; Play, Shuffle all; tapping a row queues the whole sorted list; play counts counted only for songs really listened to; the song menu; search (including Escape and navigating away); Trash with confirmations; re-adding the same files adds nothing; reload; **offline reload, then playing from the database**.
- [x] **Phone layout** (17 checks, touch): every library screen fits the screen with no sideways overflow, album cards in two columns, the song menu stays on screen, the queue opens above the full-screen player.
- [x] **Stress and failure** (21 checks): with a 2,500-song library the database is read in about 25 ms, the Songs tab then opens in about 12 ms (drawing the first 120 rows), and queueing all 2,500 songs takes about 7 ms (the rows are built when the queue is opened, which takes roughly half a second to a second at that size); a full disk keeps what was saved and says so; a browser that refuses a file-backed blob is retried with a copy; a browser with no storage explains instead of crashing; a song whose audio vanished is flagged and skipped; trashing queued songs removes them from the queue.
- [x] **iOS audio rule, modelled** (6 checks): with iOS's "needs a tap" rule simulated, tapping a library song starts it, the next song follows by itself, and tapping another song works. With my unlock deliberately removed the same tap fails, so the test genuinely detects the problem. This is a model, not iOS itself.
- [x] **Fix round 1** (106 new checks): the same song or album is the identical colour in the library row, album card, album page, mini player, full-screen header, full-screen art and queue (43 checks, which also cover the whole phone queue with real touch gestures: sheet position and corners, backdrop, equaliser, the Now playing pill, swipe to remove, a short swipe that doesn't remove or start a song, handle drag, three ways to close; and the unchanged desktop panel). The name tidy-up is tested on 45 strings, including the exact ones from your screenshots, a list of real names it must leave alone, and running it twice. The migration of an older library is tested end to end (18 checks): promo and dashes removed, a clean song untouched, trashed songs tidied, originals kept, saved across a reload, run once, and **a file the old version saved is still recognised as a duplicate**.
- [x] **Everything from Phase 1 and 2 still passes** through the new library flow (safe areas 21, iOS 26 strip 20, offline and updates 16, fonts 10, playback 56 on desktop and 24 on phone, queue and shuffle edge cases 17).

### Still to check (needs you, on a real iPhone)

- [x] Add 20+ songs from the Files app (34 songs added, with covers; how long it took wasn't reported).
- [x] The first tap on a song after opening the app starts it at once (no "Tap play to start").
- [ ] A song ends **while the phone is locked** and the next one starts by itself.
- [ ] The redesigned phone queue (new section C2 in `docs/testing-library.md`): sheet, swipe to remove, handle drag, Now playing pill.
- [ ] Songs with no cover picture look the same colour in the list, both players and the queue.
- [x] Lock-screen artwork is the album cover (your lock-screen screenshot).
- [ ] Close the app, reopen: the library is there. Airplane mode, reopen: it is there and plays.
- [ ] The storage panel reports "Protected" or "Not protected yet" (and what **Protect** says).

### Known limits

- **No backup.** The library lives only on this device. Deleting the Home Screen app, or clearing the site's data, deletes it. A backup and restore is planned for Phase 5.
- **Opening the queue with thousands of songs queued takes a moment** (roughly half a second to a second for 2,500 on a computer, more on a phone). Normal queues open instantly.
- **The name tidy-up can't catch every kind of promo text,** only the patterns above. There is no way to edit a name yet; the originals are kept.
- **Importing needs the app open**, and goes one file at a time. If iOS suspends it, what was saved is kept; adding again skips duplicates.
- **Artwork needs to be inside the file** (embedded), as with most store-bought and ripped music. A separate `cover.jpg` in the same folder isn't picked up.
- **Song names for tag-less files come from the file name**, tidied but not perfect.
- **The song menu's "Add to playlist" is a placeholder** until Phase 4.
- **Listen Now, Instant Mixes, Shop, Settings and the sidebar playlists are still sample content.**

---

## Phase 4: Playlists, queue and mixes

- Create, rename and delete playlists. Add songs from the song menu. Reorder.
- Thumbs up and thumbs down saved; "Thumbs up" and "Last added" auto playlists driven by real data.
- Instant mix and "I'm feeling lucky" built from your own library (by artist, genre or random).
- Listen Now: "Recent activity" from real play history.

**Done when:** every item in the song menu does something real, and no sample playlist or Listen Now content remains.

---

## Phase 5: Reliability and polish

- Self-host fonts if the on-device offline test showed a problem.
- Use the mobile layout for phones in landscape too.
- Backup and restore: export the library info to a file and import it back.
- Handle audio interruptions (phone calls, other apps), and resume sensibly.
- Error states: unsupported file, storage full, corrupted file.
- Accessibility pass: keyboard focus, labels on icon buttons, contrast.
- Performance with a large library (virtual list if needed).
- Settings that mean something (e.g. crossfade, theme), and nothing that does nothing.

---

## Phase 6: Maybe later

Only if you want it. Needs a backend, which Vercel can host (serverless functions plus a database).

- Accounts and sync across devices.
- Cloud copy of the library.
- Casting.

---

## What happens to every demo screen

| Screen / feature | Today | Plan |
| --- | --- | --- |
| Listen Now | Fake albums and mixes | Real recent activity and mixes (Phases 3 and 4) |
| My Library | Hard-coded Daft Punk rows | Real library (Phase 3) |
| Instant Mixes | Fake tiles | Built from your music (Phase 4) |
| Shop | Fake store, fake prices | Remove (nothing to sell) |
| Playlists in sidebar | Three fixed names | Real, user-made (Phase 4) |
| Auto Playlists, Thumbs up, Last added, Free and purchased | Fake lists | Thumbs up and Last added become real. Auto Playlists is revisited in Phase 4. "Free and purchased" is removed |
| Add music | Fake upload list | Real import (Phase 3) |
| Trash | Fake rows | Real soft-delete (Phase 3) |
| Settings | Controls that do nothing | Keep only settings that work (Phase 5) |
| Help and Feedback | Fake FAQ and form | Short real help text; feedback form removed |
| Notifications, Apps grid, Account menu | Fake menus | Remove or repurpose (decided in Phase 5) |
| Cast menu | Fake devices | Removed unless Phase 6 happens |
| Search | Does nothing | Real (Phase 3) |
