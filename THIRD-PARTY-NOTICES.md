# Third-party notices

Vanta is licensed under the GNU GPL v3.0 (see [LICENSE](LICENSE)). It is built on, and its installer ships with, the
following open-source software. Each component keeps its own license.

| Component | Used for | License | Source |
|---|---|---|---|
| [mpv](https://mpv.io) (Windows build by shinchiro) | Video playback. A copy of `mpv.exe` is bundled in the installer under `resources\mpv`. | GPL v2 or later (this build includes GPL components) | [mpv-player/mpv](https://github.com/mpv-player/mpv), build scripts at [shinchiro/mpv-winbuild-cmake](https://github.com/shinchiro/mpv-winbuild-cmake) |
| [Electron](https://www.electronjs.org) | Desktop app shell (includes Chromium and Node.js) | MIT (Chromium: BSD-3-Clause and others) | [electron/electron](https://github.com/electron/electron) |
| [React](https://react.dev) | User interface | MIT | [facebook/react](https://github.com/facebook/react) |
| [electron-updater](https://www.electron.build/auto-update) | In-app updates from GitHub Releases | MIT | [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) |
| [Jost](https://indestructibletype.com/Jost.html) by Indestructible Type, via [Fontsource](https://fontsource.org) | Brand typeface | SIL Open Font License 1.1 | [indestructible-type/Jost](https://github.com/indestructible-type/Jost) |

Build-time only (not shipped in the app): [Vite](https://github.com/vitejs/vite) (MIT), [TypeScript](https://github.com/microsoft/TypeScript) (Apache-2.0),
[electron-builder](https://github.com/electron-userland/electron-builder) (MIT), and for re-recording the README media,
[gifenc](https://github.com/mattdesl/gifenc) (MIT) and [pngjs](https://github.com/pngjs/pngjs) (MIT).

Plex is a trademark of Plex, Inc. Vanta is an unofficial client. It talks to Plex Media Server and plex.tv through
their public web API and isn't affiliated with or endorsed by Plex, Inc.

The sample library in demo mode (`npm run demo`) and the README media use public-domain films and their theatrical
posters. Each poster is marked public domain on its Wikimedia Commons file page (checked per file); sources are listed
in [demo/posters/CREDITS.md](demo/posters/CREDITS.md). The posters are bundled with the app only for demo mode.
