# Play Music (Google Play Music UI clone)

> Unofficial fan project. Not affiliated with or endorsed by Google.

A responsive, front-end-only recreation of the Google Play Music web UI, built with plain HTML, CSS and JavaScript. No dependencies, no build step. It installs on an iPhone like an app and opens offline. It **keeps and plays your own music**: add songs from your phone or computer and they are saved on the device, with their real titles, artists, albums and cover art, ready to play with no internet. Browse by song, artist, album and genre, search, use the queue, and tidy up with the Trash. Playlists, Listen Now, Instant Mixes and Settings are still sample content (see `docs/roadmap.md`).

## Run it locally

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Opening `index.html` directly also works, but the offline features only switch on over `https://` or `http://localhost`.

Roboto and Material Icons load from Google Fonts. The first time you open the app online, they are saved so they also work offline.

## Features

- **Your library:** Songs, Artists, Albums and Genres tabs with sorting, album / artist / genre pages, search (ignores accents), play counts, and a Trash that keeps removed songs for 30 days
- **Adding music:** choose songs on your phone or computer (or drag them in on a computer); tags and cover art are read from the files, duplicates are skipped, and storage use is shown
- **Playback:** play, pause, skip, seek, shuffle and repeat, a queue panel with drag-to-reorder, lock-screen / Control Center controls with the album cover, keyboard shortcuts on a computer
- **Installable and offline:** add it to your iPhone Home Screen; it opens full-screen, and your songs play even in airplane mode
- **iPhone screen fit:** the app fills the screen under the status bar and home indicator, with content kept clear of the notch

## Install on an iPhone

1. Open the Vercel link in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open it from the Home Screen icon. Open it once while online first so everything is saved.

## Deploy to Vercel

1. Push this project to a GitHub repo.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, then **Add New... > Project** and pick the repo.
3. Settings:
   - **Framework Preset:** Other
   - **Build Command** and **Output Directory:** leave empty
   - **Root Directory:** the folder that contains `index.html`. If your repo has this project inside a `google-play-music/` folder, choose that folder here.
4. Click **Deploy**. Every push to `main` redeploys automatically.

`vercel.json` sets the cache rules for the service worker and keeps `/docs` off the public site.

## Project structure

```
index.html              page markup
manifest.webmanifest    install info (name, icons, colours)
sw.js                   service worker: makes the app open offline
vercel.json             Vercel headers and redirects
css/styles.css          base layout, header, sidebar, cards, player, mobile styles
css/components.css      dropdowns, tabs, extra pages, modal, queue panel
css/ios.css             iPhone-only fixes: safe areas, screen height
js/app.js               view switching, sidebar drawer, full-screen player
js/ui.js                dropdowns, sample screens, modal, toast
js/tags.js              reads song info and cover art from files
js/store.js             the on-device database (IndexedDB)
js/library.js           your library: import, browse, search, trash, play counts
js/library-ui.js        the library screens, search, Trash, Add music
js/player.js            playback engine: audio, queue, shuffle/repeat, lock screen
js/player-ui.js         draws the player and queue; keyboard shortcuts
js/pwa.js               registers the service worker, iPhone layout helpers, hidden diagnostics
assets/                 app icon and logo
assets/icons/           home-screen and install icons (+ SVG sources)
docs/                   roadmap, how it works, iPhone test checklist
```

Scripts are plain (non-module) files and must load in order: `app.js`, `ui.js` (extends `showView` from `app.js`), `tags.js`, `store.js`, `library.js`, `player.js`, `player-ui.js`, `library-ui.js` (extends `showView` again), then `pwa.js`.

## Customizing

- **Colors:** edit the CSS variables at the top of `css/styles.css` (`--primary-orange`, `--bg-color` and so on). If you change the orange, also update `theme-color` in `index.html` and `manifest.webmanifest`.
- **App name on the Home Screen:** `apple-mobile-web-app-title` in `index.html`, and `name` / `short_name` in `manifest.webmanifest`.
- **Sample content:** Listen Now, Instant Mixes, Shop, Settings and the sidebar playlists are placeholder data in `js/ui.js` and `index.html`. Your real songs only come from Add music.
- **Keyboard shortcuts (computer):** Space play/pause, Left/Right seek 5 seconds, Shift+Left/Right previous/next, M mute.
- **Adding a page:** create it with the `view('id', html)` helper in `js/ui.js`, add its title to `VIEW_TITLES`, and link to it with a `data-view="id"` attribute.
- **Adding a new file to the app** (a script, stylesheet or image): add its path to `SHELL_FILES` in `sw.js` and change `VERSION` there (for example `'v1'` to `'v2'`), so the file is saved for offline use.

## Docs

- [`docs/roadmap.md`](docs/roadmap.md): where this is going, phase by phase
- [`docs/how-it-works.md`](docs/how-it-works.md): how the code fits together
- [`docs/testing-on-iphone.md`](docs/testing-on-iphone.md): Phase 1 checklist (install, offline, screen fit)
- [`docs/testing-playback.md`](docs/testing-playback.md): Phase 2 checklist (playback, lock screen)
- [`docs/testing-library.md`](docs/testing-library.md): Phase 3 checklist (adding songs, library, offline, storage)

## License

Released under the [MIT License](LICENSE). The Google Play Music name and design belong to their respective owners; this project is not a Google product.
