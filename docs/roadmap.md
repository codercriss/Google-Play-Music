# Roadmap

Goal: turn this from a visual demo into a **working music player that installs on an iPhone like an app, works offline, and plays your own music**.

Status key: ⬜ not started · 🟨 in progress · ✅ done

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Baseline and docs | ✅ |
| 1 | Ship-ready shell: Vercel, PWA, offline, iPhone safe areas | 🟨 built; waiting on your iPhone check |
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

## Phase 1: Ship-ready shell 🟨

**Goal:** the current UI deploys to Vercel, installs from Safari with "Add to Home Screen", opens full-screen with no browser bars, still opens in airplane mode, and fills the iPhone screen properly at the top and bottom.

**Status:** all code is written and tested in a desktop browser that imitates an iPhone. It is not finished until you deploy it and run `docs/testing-on-iphone.md` on a real iPhone.

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

### Still to check (needs you)

- [ ] Live on a Vercel URL.
- [ ] Real iPhone, **after fix round 1**: bottom bar reaches the bottom edge, or any strip under it is plain white and looks like part of the bar.
- [ ] Real iPhone: Add to Home Screen works, opens full-screen, clock readable, nothing hidden by the notch or home bar.
- [ ] Airplane mode, fully close and reopen: it still opens **with icons showing as pictures**.
- [ ] Rotating to landscape looks right.
- [ ] `/docs/roadmap.md` on the live site redirects to the home page.

### Known limits

- **Landscape on a phone** uses the desktop layout, which is cramped on a 390px-tall screen. It is safe (nothing under the notch) but not pretty. Fixing it means making the mobile layout also apply to landscape phones; I've left it out of Phase 1 and can add it in Phase 5.
- **Your first visit must be online.** Offline use starts after one online open.
- **iOS 26 bottom strip.** An open WebKit bug can leave a strip at the bottom of an installed app that no page element can reach. We work around it as far as is possible; a guaranteed fix would need a solid (non-see-through) status bar, which gives up the orange strip at the top. That is an option if the workaround isn't enough.
- **Real iPhone only.** I couldn't run Safari itself here, so iOS-specific behaviour (status bar colour, the exact insets) is checked by measurement, not by eye on a device.

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
