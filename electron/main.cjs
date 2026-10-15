// Vanta by soybean_alien
const { app, BrowserWindow, ipcMain, powerMonitor, protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const plex = require('./plex.cjs');
const player = require('./player.cjs');
const health = require('./health.cjs');
const updater = require('./updater.cjs');
const badges = require('./badges.cjs');

// Newly earned badges wait here until nothing is playing; the UI then takes them and shows the toasts.
const pendingBadges = [];
function queueBadges(ids) {
  if (!ids?.length) return;
  pendingBadges.push(...ids);
  if (!player.isPlaying() && win && !win.isDestroyed()) win.webContents.send('badges:earned');
}

// One-time carry-over from before the PlexClient → Vanta rename, so login, pins, settings and
// per-library filters survive (the userData folder is named after the package).
(function migrateFromPlexClient() {
  const oldDir = path.join(app.getPath('appData'), 'plexclient');
  const newDir = app.getPath('userData');
  if (fs.existsSync(path.join(newDir, 'auth.bin')) || !fs.existsSync(path.join(oldDir, 'auth.bin'))) return;
  try {
    fs.mkdirSync(newDir, { recursive: true });
    for (const name of ['settings.json', 'auth.bin', 'Local Storage']) {
      const from = path.join(oldDir, name);
      if (!fs.existsSync(from)) continue;
      if (fs.statSync(from).isDirectory()) fs.cpSync(from, path.join(newDir, name), { recursive: true, force: true });
      else fs.copyFileSync(from, path.join(newDir, name));
    }
  } catch (e) {
    console.warn('Could not migrate PlexClient data:', e.message);
  }
})();

protocol.registerSchemesAsPrivileged([
  { scheme: 'plximg', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let win;

// --demo: sample library instead of a Plex account, at the README screenshot size (1270x840).
const DEMO = process.argv.includes('--demo');
// --record: an invisible, click-through, unfocusable window while tools/demo/record.mjs captures it over CDP, so nothing on the
// desktop can disturb the recording. (A hidden window stops painting, and an off-screen one gets the wrong size.)
const RECORD = process.argv.includes('--record');

function createWindow() {
  win = new BrowserWindow({
    width: DEMO ? 1270 : 1400,
    height: DEMO ? 840 : 900,
    useContentSize: DEMO,
    ...(RECORD ? { x: 40, y: 40, opacity: 0, focusable: false, skipTaskbar: true } : {}),
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    title: 'Vanta',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: !RECORD,
    },
  });
  if (RECORD) win.setIgnoreMouseEvents(true);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), DEMO ? { query: { demo: '1' } } : undefined);
}

// Wrap handlers so errors reach the UI as { error } instead of a rejected IPC call with a noisy stack.
const handle = (channel, fn) =>
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      return { error: e.message || String(e) };
    }
  });

app.whenReady().then(() => {
  plex.loadSettings();

  // plximg://img/?u=<thumb path>&w=<width>&h=<height>
  protocol.handle('plximg', (req) => {
    const u = new URL(req.url);
    const thumb = u.searchParams.get('u');
    if (!thumb || !thumb.startsWith('/')) return new Response(null, { status: 400 });
    return plex.image(thumb, u.searchParams.get('w') || '300', u.searchParams.get('h') || '450');
  });

  // Connection health runs once a server session exists and pushes every change to the sidebar.
  let healthStarted = false;
  const startHealth = (r) => {
    if (r?.state === 'ready' && !healthStarted) {
      healthStarted = true;
      health.start((h) => win && !win.isDestroyed() && win.webContents.send('health', h));
      powerMonitor.on('resume', () => health.now());
    }
    return r;
  };
  handle('auth:connect', () => plex.connect().then(startHealth));
  handle('auth:signIn', () => plex.signIn().then(startHealth));
  handle('health:get', () => health.latest());
  handle('health:check', () => health.now());
  // Dev builds only: force a state to preview the yellow/red designs.
  if (!app.isPackaged) handle('health:simulate', (level) => health.simulate(level));
  handle('auth:signOut', () => plex.signOut());
  handle('pms:get', (p) => plex.pms(p));
  handle('prefs:get', () => plex.getPrefs());
  handle('prefs:set', (patch) => {
    const prefs = plex.setPrefs(patch);
    updater.configure(); // the update mode may have changed
    return prefs;
  });
  handle('badges:get', () => badges.state());
  handle('badges:take', () => (player.isPlaying() ? [] : pendingBadges.splice(0)));
  handle('badges:setFavorites', (ids) => badges.setFavorites(ids));
  handle('update:get', () => updater.get());
  handle('update:check', () => updater.check().then(updater.get));
  handle('update:download', () => updater.download().then(updater.get));
  handle('update:install', () => updater.install());
  handle('player:stop', () => player.stop());
  handle('player:play', (ratingKey, opts) =>
    player.play(String(ratingKey), opts || {}, {
      onSession: async (session) => {
        try {
          // Season size from Plex, for the 'finish a whole season' badge.
          let seasonSize;
          if (session.meta.type === 'episode' && session.meta.parentRatingKey) {
            const r = await plex.pms(`/library/metadata/${session.meta.parentRatingKey}`).catch(() => null);
            seasonSize = r?.MediaContainer?.Metadata?.[0]?.leafCount;
          }
          queueBadges(badges.record({ ...session, seasonSize }));
        } catch (e) {
          console.warn('badge session failed:', e.message);
        }
      },
      onState: (s) => {
        if (!win || win.isDestroyed()) return;
        win.webContents.send('player:state', s);
        if (!s.playing && pendingBadges.length) win.webContents.send('badges:earned');
        // Hand focus back to the app when mpv closes so keyboard/controller navigation continues.
        if (!s.playing) win.focus();
      },
    }),
  );
  handle('window:toggleFullscreen', () => win.setFullScreen(!win.isFullScreen()));

  createWindow();
  if (!DEMO) queueBadges(badges.init());
  if (!DEMO) updater.start({ onChange: (s) => win && !win.isDestroyed() && win.webContents.send('update', updater.get()), isBusy: player.isPlaying });
});

app.on('window-all-closed', () => {
  player.stop();
  app.quit();
});
