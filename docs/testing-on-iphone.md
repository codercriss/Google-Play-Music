# Testing on a real iPhone

The layout and offline behaviour were measured in a desktop browser that imitates an iPhone, but only a real iPhone can confirm how it looks and feels. Run these in order. Tick each one or note what you saw.

You need: the live Vercel link, and an iPhone with Safari.

## A. In Safari (normal browser tab)

- [ ] The page loads and looks like before.
- [ ] Scrolling is smooth, and the page doesn't jump when Safari's bars slide away.
- [ ] Tap the search box: the page does **not** zoom in.
- [ ] Pinch to zoom works (it was blocked before on purpose; now allowed).

## B. Install it

- [ ] Share, then **Add to Home Screen**. The icon is full orange with no black corners, and the name reads "Play Music".
- [ ] Open it from the Home Screen: it is full-screen with no Safari address bar.

## C. Fit to the screen (Home Screen app, portrait)

- [ ] The orange header sits **below** the clock and battery, and the clock text is readable (white on orange).
- [ ] The white bottom navigation (Listen Now / Library / Mixes / Shop) runs all the way to the bottom of the screen, with the labels clear of the home bar. **If you see a grey band under it, that is the iOS 26 bug: see "If something is still wrong at the bottom" below.** A white band under it is acceptable (it is the best fallback).
- [ ] The mini player sits directly above the bottom navigation with no gap.
- [ ] Tap the mini player: the full-screen player opens. Its top row is below the clock, and its controls at the bottom are above the home bar.
- [ ] Swipe down on the full-screen player: it closes.
- [ ] Open the menu (three lines, top left): the drawer's top is below the clock, and its last item is reachable at the bottom.
- [ ] Open the queue: its top is below the header and its list scrolls to the end.
- [ ] Create a playlist (the plus next to Playlists): the dialog is fully on screen.

### If something is still wrong at the bottom

1. Fully close the app (swipe it away) and reopen it. iOS only re-reads the colour under the bottom bar when the app starts.
2. Open the menu and tap the **"Google Play music"** title **5 times quickly**. A dark panel with green text appears.
3. Take a screenshot with the panel showing, and tell me your iOS version (Settings, General, About, "iOS Version"). Tap the panel to close it.

## D. Offline

- [ ] With Wi-Fi on, open the Home Screen app once and tap through a few screens.
- [ ] Fully close the app (swipe it away in the app switcher).
- [ ] Turn on **Airplane Mode**.
- [ ] Open the app again: it loads, the **icons show as pictures** (not words like "play_arrow"), and text uses the normal font.
- [ ] Switch between Listen Now, Library and Settings: all work.

If the icons show as words offline, tell me: it means the icon font wasn't saved, and the fix is to put the font files in the project.

## E. Rotate (landscape)

- [ ] Turn the phone sideways: nothing important is hidden under the notch or Dynamic Island on either side.
- [ ] The bottom player isn't covered by the home bar.
- [ ] (Known, not a bug: sideways uses the desktop layout and is cramped. See the roadmap.)

## F. Other devices still fine

- [ ] A desktop browser looks the same as before.
- [ ] An Android phone, if you have one, looks the same as before.

## What to send me if something is wrong

The letter and item (for example "C, third item"), a screenshot, and your iPhone model and iOS version (Settings, General, About).
