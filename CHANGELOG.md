# Changelog

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
