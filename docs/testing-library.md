# Testing your library on a real iPhone (Phase 3)

The data layer, the screens and every failure case were tested in a desktop browser with real audio files, including a 2,500-song library, a full disk, a missing file and offline use. What only an iPhone can confirm: how iOS handles saving many songs, whether a tapped song starts instantly, how the lock screen behaves between songs, and whether the library survives closing the app.

**You need:** the live Vercel link and **20 or more songs** in the **Files** app. Mix them if you can: some with proper tags (downloaded from a store or ripped from CDs), and some without (downloaded from YouTube or similar). Optionally one `.ogg` file, to see the "can't play" message.

**Before you start:** fully close the app and reopen it from the Home Screen so you have the newest version. (Your songs from earlier tests were never saved, so the library starts empty.)

## A. Adding songs

- [ ] Menu, then **Add music**, then **Choose songs**. Select 20 or more songs. Note how many you chose.
- [ ] A progress panel shows "3 of 24", the current file name, and a moving bar. **Roughly how long did it take for the whole batch?** (Please tell me: it decides whether adding needs a speed-up.)
- [ ] When it finishes, the panel says "Added N songs" with a size, and a toast appears.
- [ ] The **Your library** panel shows the number of songs, the space used, and the space free.
- [ ] It says either **Protected** or **Not protected yet**. Note which. If "Not protected", tap **Protect** and tell me what the message says.
- [ ] Choose the **same songs again**: nothing is added, and it says they are already in your library.
- [ ] If you have an `.ogg` (or damaged) file: it is refused with a reason, and the rest are still added.

## B. How your songs look

- [ ] Open **My Library**, then **Songs**. Your songs are listed with real titles and artists.
- [ ] Songs that have artwork show a cover; others show a colour square.
- [ ] Songs without tags have cleaned-up names (no "(Official Music Video)" and similar), and "Unknown artist" if the name has no artist.
- [ ] Sort (the small menu under the tabs): Recently added, A to Z, Artist, Most played, Duration. Each reorders the list.
- [ ] **Artists** tab: one card per artist with a picture and a song count. **Albums** tab: one card per album with its cover. **Genres** tab: one card per genre.
- [ ] Tap an album: its page opens with the cover, the songs in track order, and **Play** / **Shuffle**. Tap the artist link, then **My Library** to go back.
- [ ] Scroll a long Songs list quickly: it should stay smooth and never show a blank gap for long.
- [ ] **Names:** songs that used to show "|| TrendyBeatz.com" or "| val9ja.com" after the title now show just the title, and "Oxlade –" is now "Oxlade". Anything that still looks wrong: tell me exactly what it says.
- [ ] **Colours:** pick a song that has no cover picture. Its colour square is **the same** in the Songs list, the mini player, the full-screen player and the queue. Two songs from the same album share a colour.

## C. Playing (the important part)

- [ ] **Fully close the app and reopen it.** Go straight to Songs and tap one song. **It should start at once**, with no "Tap play to start" message. (Tell me if you see that message.)
- [ ] The mini player shows the song's cover. Open the full-screen player: the big cover shows too.
- [ ] Tap a different song while one plays: it switches.
- [ ] Let a short song finish: the next song **starts by itself**.
- [ ] Tap **Play** on an album, and **Shuffle all** on Songs: both work.

## C2. The queue (phone)

- [ ] Open the full-screen player and tap the queue icon (top right). The queue **slides up as a sheet** with rounded corners; the page behind it is dimmed.
- [ ] The title says "Queue" with the number of songs and total time. The playing song is highlighted, with little moving bars on its cover (still while paused). Songs already played are faded.
- [ ] It opens scrolled to the playing song. Scroll far away: a **"Now playing" button** appears. Tap it: it takes you back.
- [ ] Songs with no picture show a colour with a music note (not grey).
- [ ] **Swipe a song to the left**: a red "Remove" appears and the song goes. A short swipe springs back and does **not** start the song.
- [ ] **Hold the handle** on the right (three lines) and drag a song up or down to reorder it. The playing song keeps playing.
- [ ] Close the queue three ways: tap the dimmed area above it, tap the round close button, or drag the top edge down.
- [ ] **Clear** empties it.

## D. Lock screen and background

- [ ] With a song playing, lock the phone. The music continues, and the lock screen shows the title, artist and **the album cover** (not the orange app icon, if the song has a cover).
- [ ] **Let a song end while the phone is locked.** The next song should start by itself. This is the moment iOS is strictest, so please test it with a short song if you can. Tell me what happens.
- [ ] Use next/previous and pause/play from the lock screen.
- [ ] Switch to another app: the music continues.

## E. Search

- [ ] Type part of a song, artist or album name in the search box at the top. Results appear grouped as Artists, Albums, Songs.
- [ ] Try a name with an accent, typed without it (for example "beyonce" for Beyoncé).
- [ ] Tap a result: it plays. Clear the search: you return to where you were.

## F. Song menu and Trash

- [ ] Tap the three dots on a song: **Play next**, **Add to queue**, **Go to artist**, **Go to album** all work. Open the queue to see them.
- [ ] **Remove from library** moves it to the Trash (menu, then **Trash**). **Restore** brings it back. **Delete** removes it for good after asking.
- [ ] Remove the song that is currently playing: it leaves the queue and the music carries on with the next one.
- [ ] After a song has played for about half its length (or 30 seconds), its play count goes up by one in the list.

## G. Keeping everything (the main goal)

- [ ] **Fully close the app** (swipe it away), reopen it: your library is all still there.
- [ ] Turn on **Airplane Mode**, fully close the app and reopen it. Everything is still there, and **tapping a song plays it**, with covers.
- [ ] Come back tomorrow (still offline or online): the library is still there. (If songs ever disappear, tell me exactly what you did before.)

## H. Awkward situations (optional)

- [ ] Start adding 30 or more songs and switch to another app halfway. Come back and tell me what you see: the songs saved so far are kept, and adding the rest again skips what is already there.
- [ ] Add one very large file (a 100 MB or longer one, if you have it).
- [ ] Add songs while music is playing: playback should not stutter or stop.

## What to send me if something is wrong

The letter and item (for example "D, second item"), what you expected, what happened, your iPhone model and iOS version, and a screenshot. For layout problems, the hidden diagnostics panel still works (open the menu, then tap the title 5 times).
