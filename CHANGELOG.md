# Changelog

## 2.1.0 (2026-10-24)

- **Trakt sync.** Settings → Trakt → Connect Trakt shows a short code to enter at trakt.tv/activate; there are no keys to paste and no secret built into Vanta (device sign-in with PKCE).
- Everything Vanta marks watched (80% in the player, or Mark watched) is added to your Trakt history right away; Mark unwatched removes it. A switch turns this off.
- **Sync now** sends your Plex watch history (movies and episodes, with Plex's dates) to Trakt and copies Trakt's watch dates into Vanta's watch log. Plex's watched status is never changed.
- Trakt scores on the details page now work for everyone, with no key.
- Backups carry the Trakt sign-in (inside the password-protected part).
## 2.0.1 (2026-10-24)

- Fixed: on the details page, the separator between audio and subtitle tracks showed as "Â·" instead of a dot.

## 2.0.0 (2026-10-23)

The biggest update yet.

- **Details page:** live scores (IMDb, Rotten Tomatoes critics and audience, Metacritic, TMDB, Trakt), the file's real video, audio and subtitle data, director and writers, tagline, certificate and an "Ends at" time.
- **Cast & Crew:** birthdays, age today, age in this film, and the date of death for those who have passed. Click a person to see every title in your library with them, with their age in each.
- **Automatic English subtitles** for files that have none: exact-file matches by fingerprint first, then the closest release; fetched in the background and at Play, ads removed, kept on your PC. Add your own .srt from the item menu.
- **Music (Spotify):** playlists, saved albums and recently played, played on your Spotify devices, with a large now-playing view (cover, song, artist, album, year, playlist). Connected in Settings → Music.
- **Backup and restore:** one file with badges, watch dates, collections, every setting, per-library filters and caches; with a password, also your Plex sign-in and keys (AES-256). Restore from the sign-in screen of a fresh install for zero setup.
- **Crash-safe data:** every data file is written atomically with a last-good backup copy.
- **Last watched:** a neon-green MM/DD/YYYY date on watched posters and details pages, kept in Vanta's own watch log.
- **Watched at 80%:** stopping at 80% or later marks a title watched; earlier stays in Continue Watching.
- **Continue Watching** is now its own sidebar page covering every library; the row is gone from the library pages.
- **Add to collection:** put any film into a series folder or a new collection; the Collections page now summarises every series (Plex, TMDB and yours).
- **Themes:** nine color themes.
- **Cover size slider** in every library header, live.
- **Sidebar order** is yours to set in Settings → Sidebar.
- **Badge showcase** holds up to nine.
- The unwatched corner flag is larger.
- Badges: development has slowed for now; the roadmap is TBD.
## 1.6.0 (2026-10-23)

- **Series folders.** In movie libraries, a series and its sequels fold into one folder poster with the first film's cover, stacked cards and a film count. A folder sits where its first film would in your current sort and filters.
- Open a folder for every film in release order, with **Play all** and **Shuffle** (also in the right-click / Y menu).
- Series come from your Plex collections and, optionally, The Movie Database: add a free TMDB key in **Settings → Library**. Answers are cached on your PC, and nothing is written to Plex or your files.
- **Settings → Library** has a switch to turn folders off.
- Plex collections now open and play in release order, with the first film's poster as the cover.

## 1.0.1 (2026-10-15)

- **Vanta now updates itself.** It checks this repository's releases and installs new versions silently, keeping your sign-in, settings and progress. Choose *Install automatically*, *Ask me first* (default) or *Only when I check* in Settings → Updates.
- An **Update available** / **Restart to update** note in the sidebar, with release notes, and an **Updated** note after an update.
- Updates download only what changed and never interrupt playback.
- Settings → Updates shows your current version and has a **Check now** button.
- 1.0.0 can't update itself, so install 1.0.1 once by hand; later versions arrive automatically.

## 1.0.0 (2026-10-15)

First public release.

- Your Plex movie and TV libraries in a clean sidebar. Discover, Live TV, Watchlist, Downloads, social features, music and photos are left out.
- Direct playback in mpv: resume points and watched status sync back to Plex, the next episode auto-plays in the same window, and intro skip works (prompt or automatic).
- Continue Watching, sort and filter (genre, decade, unwatched, rating, recently added), Random pick, global search, collections, playlists and pinned views.
- Right-click (or Y) item menu: play, resume, play from the beginning, details, go to the show or season, mark watched or unwatched.
- Keyboard and Xbox controller navigation throughout, with an on-screen keyboard for search.
- Connection status under the logo (green, yellow or red) with a diagnostics panel; it switches to a working route automatically.
- One-time Plex sign-in in the browser, then automatic login. The token is stored encrypted with Windows DPAPI.
- Playback settings: full screen, audio and subtitle languages, smart subtitles, hardware decoding, upscaling presets, smooth motion, custom shaders and extra mpv options.
- Windows installer with Start Menu and Desktop shortcuts; mpv is included.
