# Google Play Music UI Clone

> Unofficial fan project. Not affiliated with or endorsed by Google.

A responsive, front-end-only recreation of the Google Play Music web UI, built with plain HTML, CSS and JavaScript. No dependencies, no build step. It is a visual demo: there is no real playback, accounts or data.

## Run it

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Roboto and Material Icons load from Google Fonts, so you need an internet connection for fonts and icons to appear.

## Features

- **Pages:** Listen Now, My Library, Instant Mixes, Shop, playlist pages, Settings, Add music, Trash, Help & Feedback
- **Library tabs:** Playlists, Artists, Albums, Songs and Genres, with a sort dropdown
- **Dropdowns:** apps, notifications, account, song menu (with an "Add to playlist" submenu), volume and cast
- **Other UI:** queue panel, New playlist dialog, collapsible Playlists section, toast messages
- **Mobile layout:** slide-out drawer, bottom nav and a swipe-down full-screen player

## Project structure

```
index.html          page markup
css/styles.css      base layout, header, sidebar, cards, player, mobile styles
css/components.css  dropdowns, tabs, extra pages, modal, queue panel
js/app.js           view switching, sidebar drawer, full-screen player
js/ui.js            dropdowns, extra pages, library tabs, modal, queue
assets/             app icon and logo
```

Scripts are plain (non-module) files and must load in order: `app.js`, then `ui.js`, which extends `showView` from `app.js`.

## Customizing

- **Colors:** edit the CSS variables at the top of `css/styles.css` (`--primary-orange`, `--bg-color` and so on).
- **Sample content:** song names, mixes and settings are placeholder data in `js/ui.js` and `index.html`.
- **Adding a page:** create it with the `view('id', html)` helper in `js/ui.js`, add its title to `VIEW_TITLES`, and link to it with a `data-view="id"` attribute.

## Deploy to GitHub Pages

Push the repo, then go to **Settings > Pages** and publish from the `main` branch, root folder. The `.nojekyll` file is already included.

## License

Released under the [MIT License](LICENSE). The Google Play Music name and design belong to their respective owners; this project is not a Google product.
