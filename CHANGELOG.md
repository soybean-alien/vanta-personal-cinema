# Changelog

## 2.1.5 (2026-10-24)

- **Watch times:** details pages show when you last watched, with the time in New York time (for example "✓ Watched 10/22/2026 11:52 PM"), for movies, shows, seasons and episodes. Shows and seasons you're part-way through say when you last watched an episode. The poster grid keeps the date only.
- TV show tiles in the grid show the title centered, without the year, like movies.
- **Complete backups:** Export backup now also carries every subtitle (including ones you added), the box office and file-details caches and your Trakt sync summary, so a restore on another PC comes back exactly as it was. Older backups still restore.

## 2.1.4 (2026-10-24)

- **Box office numbers** under every movie cover in the library grid: budget - US opening weekend - worldwide gross, from Box Office Mojo, with TMDB filling gaps. Unknown numbers are left out; series folders show their films' combined worldwide gross. Hover for exact amounts and the source.
- Movie titles in the grid are centered under the numbers, without the year. Both scale with the poster size slider.

## 2.1.3 (2026-10-24)

- **Restyled details page** for movies and TV shows: gold titles, the director in cyan, a red Play button and a glowing gold edge on the cover.
- File tags are color-coded: video codec orange, audio pink, container purple, size green. The frame rate and bitrate tags are gone.
- The Video, Audio and Subtitles details are bright yellow, under bold glowing labels.
- **Missing file details filled in:** when Plex never analyzed a file, Vanta reads its tracks itself (nothing changes on the server) and remembers them. A file nothing can read is marked as possibly damaged.

## 2.1.2 (2026-10-24)

- The details page no longer shows the file name. The file's video, audio and subtitle details stay.

## 2.1.1 (2026-10-24)

- **More cast birthdays.** When TMDB has no birthday for someone, Vanta now asks Wikidata, then Trakt, then TVmaze (by exact, single name match only). Wikidata also fills in deaths TMDB hasn't recorded for anyone born before 1965. Hover a person to see where their birthday came from.

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
