# Testing playback on a real iPhone (Phase 2)

Playback was tested in a desktop browser with real audio files (MP3, WAV, OGG, plus a corrupt file and a non-audio file). Four things can only be confirmed on an iPhone: how iOS treats audio, the lock screen, background playback, and the file picker. Run these in order.

**You need:** the live Vercel link, and 3 or more songs on the phone in the **Files** app (MP3 or M4A work best). If you have none: email yourself a couple, or save some into iCloud Drive or "On My iPhone", then check they appear in Files.

**Before you start:** open the app from the Home Screen icon (not Safari). Fully close and reopen it once after the update so you have the newest version.

## A. Adding and starting songs

- [ ] Open the menu, then **Add music**, then tap **Choose songs**. The iPhone file picker opens.
- [ ] Select 3 or more songs. The app says "Added N songs to your queue".
- [ ] **Either** the first song starts by itself, **or** it shows paused with the message "Tap play to start". Both are fine (iOS sometimes refuses to start sound that wasn't triggered by a tap). If you see the message, tap play and it should start. Note which one happened.
- [ ] The mini player shows the song name and the artist (from the file name), and a coloured cover.
- [ ] Add one more song while one is playing: the music does not stop or restart.
- [ ] Choose a non-audio file too (for example a photo): it is skipped, and the message says so.

## B. Controls

- [ ] Play and pause work, and the icon changes in both the mini player and the full-screen player.
- [ ] Tap the mini player to open the full-screen player. The title, artist, time and bar are real.
- [ ] **Drag the progress bar** with your finger. The time follows your finger and the song jumps to where you let go. The full-screen player does **not** close while you drag, even if your finger drifts downward.
- [ ] Next and previous work. Previous within 3 seconds goes back; later than that it restarts the song.
- [ ] Shuffle: the icon turns orange, and the queue order changes. Turn it off and the order comes back.
- [ ] Repeat: tap three times to cycle off, all (orange), one (orange, with a 1). With "one", a song loops.
- [ ] Let a song finish: the next one **starts by itself**.
- [ ] Let the **last** song finish with repeat off: it stops, and the button goes back to "play".

## C. Queue

- [ ] In the full-screen player, tap the queue icon (top right). The queue opens **on top** of the player.
- [ ] Tap a song in the queue: it plays.
- [ ] Tap the x on a song: it is removed.
- [ ] Drag the three-line handle to move a song up or down. The playing song keeps playing.
- [ ] **Clear** empties it, and the player goes back to "Nothing playing".

## D. Lock screen and background (the important ones)

- [ ] With a song playing, press the side button to **lock the phone**. The music keeps playing.
- [ ] Wake the screen. The lock screen shows the **song name, artist and the app icon**, with play/pause, next and previous.
- [ ] Pause and play from the lock screen. Then reopen the app: its buttons match what you did.
- [ ] Use next/previous on the lock screen: the song changes (and the app shows the new song).
- [ ] Drag the lock-screen scrubber: the song jumps.
- [ ] Go to the Home Screen or another app with music playing: it **keeps playing**.
- [ ] Control Center (swipe down from the top right) shows the same song info and controls.

## E. Interruptions and odd cases

- [ ] Start a song, then get a call or play a video in another app. The song pauses, and when you come back the app shows **paused** (not "playing").
- [ ] Put a file the phone can't play in the mix (for example an .ogg file, or a renamed text file). It shows "can't play" in the queue, with a message, and playback moves on.
- [ ] Airplane mode: your songs still play (they are on the phone).
- [ ] Close and reopen the app: the queue is **empty**. This is expected for now (saving is Phase 3).

## If something is wrong

Tell me the letter and item (for example "D, third item"), what you expected, what happened, your iPhone model and iOS version, and the song's file type if relevant. For layout problems, the hidden diagnostics panel from `testing-on-iphone.md` still works (tap the menu title 5 times).
