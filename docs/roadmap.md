# Roadmap

Goal: turn this from a visual demo into a **working music player that installs on an iPhone like an app, works offline, and plays your own music**.

Status key: ⬜ not started · 🟨 in progress · ✅ done

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Baseline and docs | ✅ |
| 1 | Ship-ready shell: Vercel, PWA, offline, iPhone safe areas | ⬜ |
| 2 | Real playback engine | ⬜ |
| 3 | Your library: import, store, browse | ⬜ |
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

## Phase 1: Ship-ready shell

**Goal:** the current UI deploys to Vercel, installs from Safari with "Add to Home Screen", opens full-screen with no browser bars, still opens in airplane mode, and fills the iPhone screen properly at the top and bottom.

### 1a. Vercel deploy
- Static site, no framework, no build command.
- `vercel.json` with response headers:
  - `sw.js` is never cached by the browser, so updates are picked up.
  - Correct content type for the web manifest.
- Exclude `docs/` from the deploy so the roadmap isn't public (`.vercelignore`).
- If the repo has the project inside a `google-play-music/` folder, Vercel's **Root Directory** must point at it so `index.html` is at the deploy root.

### 1b. Installable app (PWA)
- `manifest.webmanifest`: name, short name, `display: standalone`, theme and background colour, icons.
- Icons made properly for iOS. The current icon has transparent corners, which iOS renders with a black background, so we need full-bleed versions (180, 192, 512, plus a maskable one). The 256 px source is too small to scale up cleanly to 512, so I'll redraw it as a vector and export from that.
- iOS meta tags: `apple-mobile-web-app-capable`, status bar style, `apple-touch-icon`, app title.

### 1c. Offline
- Service worker (`sw.js`) at the site root that:
  - pre-caches the app shell (HTML, CSS, JS, icons)
  - serves the shell from cache when offline
  - caches fonts the first time they load (see risk below)
  - updates in the background and shows an "Update available, tap to refresh" toast
- Remove the dead `via.placeholder.com` avatar URL, which would fail offline (and ui.js already replaces it with a letter).
- A small offline indicator in the UI is optional; we'll decide when we get there.

### 1d. iPhone safe areas, top and bottom
- `viewport-fit=cover` so the app draws under the status bar/notch/Dynamic Island and the home indicator.
- Apply `env(safe-area-inset-*)` padding to: the header (top), the bottom nav, the mini player, the full-screen player and its control bar, the queue panel, the toast, and the slide-out drawer.
- Replace `100vh` with `100dvh` so heights are right when Safari's toolbar shows and hides.
- **iPhone only:** the rules are wrapped so they apply only to iOS WebKit at phone width (`@supports (-webkit-touch-callout: none)` combined with the existing 768 px mobile breakpoint). Desktop and Android layouts are not changed.
- Landscape: left/right insets handled so controls don't sit under the notch.

### 1e. Small fixes found while reading the code
- README mentions a `.nojekyll` file that isn't in the project. It isn't needed for Vercel; update the README to match.
- Decide whether to keep `user-scalable=no` in the viewport tag. It gives an app-like feel but blocks pinch-zoom, which is an accessibility problem.

### Done when
- Live on a Vercel URL.
- On a real iPhone: Add to Home Screen works, the app opens full-screen, the header clears the status bar, and the bottom nav and mini player clear the home indicator.
- Turn on airplane mode, fully close and reopen the app: it still loads and navigates.
- Rotating to landscape doesn't put controls under the notch.
- Desktop browser layout looks identical to before.
- Lighthouse PWA/installability check passes.

### Risks
- **Fonts offline.** Roboto and Material Icons currently load from Google Fonts. Phase 1 caches them the first time they load, so offline works after one online visit. For first-ever-load-offline reliability the font files should be self-hosted. My working environment can't download files, so this needs the font files to be added to the project (I'll give exact steps) and is the one item that may slip to Phase 5.
- **Forgetting to bump the cache version** leaves users on old files. The update toast and a clear version constant in `sw.js` reduce this.
- **iOS behaviour differs from desktop.** Everything in this phase needs checking on a real iPhone, not just a desktop browser's phone emulator.

---

## Phase 2: Real playback engine

**Goal:** the player bar actually plays audio.

- One shared audio element and one player state object (current track, queue, playing, position, volume, shuffle, repeat).
- Working controls in all three places: desktop player bar, mobile mini player, and the full-screen player. Play/pause, previous/next, seek, volume, shuffle, repeat.
- Progress bars and times driven by the real track, replacing the static 1:12 / 3:45.
- Queue panel shows the real queue, supports play-from-here, remove and reorder.
- Lock-screen and Control Center controls and artwork through the Media Session API.
- Keyboard shortcuts on desktop (space, arrows).
- First test content: a file picker for a few songs, before the full library exists.

**Done when:** you can pick songs, play them, skip, seek, shuffle and repeat, and control playback from the iPhone lock screen.

**Risk:** iOS only allows audio to start from a tap, and has its own rules for background audio. Needs real-device testing.

---

## Phase 3: Your library

**Goal:** the library is your real music, saved on the device.

- Storage in IndexedDB: audio files as blobs, track info in a separate store.
- Add music via the file picker (works on iPhone) and drag-and-drop (desktop).
- Read tags (title, artist, album, genre, track number, duration) and embedded artwork from the files. Fall back to the filename when tags are missing.
- Ask the browser for persistent storage and show how much space the library uses.
- Songs, Artists, Albums and Genres tabs built from real data, with working sort.
- Search box works.
- Play counts are recorded for real.
- Remove sends a song to Trash; Restore and Delete forever work.

**Done when:** add 20+ songs, close the app, reopen offline, and everything is still there and playable.

**Risk:** iOS storage limits and eviction rules. We request persistent storage and test with a large library.

---

## Phase 4: Playlists, queue and mixes

- Create, rename and delete playlists. Add songs from the song menu. Reorder.
- Thumbs up and thumbs down saved; "Thumbs up" and "Last added" auto playlists driven by real data.
- "Play next" and "Add to queue" from the song menu.
- Instant mix and "I'm feeling lucky" built from your own library (by artist, genre or random).
- Go to artist / Go to album from the song menu.
- Listen Now: "Recent activity" from real play history.

**Done when:** every item in the song menu does something real.

---

## Phase 5: Reliability and polish

- Self-host fonts if not already done.
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
