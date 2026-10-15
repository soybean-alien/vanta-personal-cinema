// Vanta by soybean_alien
// In-app updates from GitHub Releases (electron-updater + the NSIS installer's differential download).
// Modes (Settings → Updates): 'auto' downloads in the background and installs on the next restart,
// 'ask' (default) shows an "Update available" pill and waits for a click, 'manual' only checks when asked.
// Pre-releases are never offered, so unreleased work can't reach users through the updater.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const plex = require('./plex.cjs');

const FIRST_CHECK_MS = 8000;
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

let state = { state: 'idle' };
let listener = () => {};
let canInstall = () => true;
let downloadRequested = false;

const mode = () => plex.getPrefs().ui.updates || 'ask';
const publish = (patch) => {
  state = { ...state, ...patch, current: app.getVersion() };
  listener(state);
  return state;
};

// GitHub release notes arrive as HTML; the UI shows them as plain text.
function notesText(notes) {
  const html = Array.isArray(notes) ? notes.map((n) => n.note || '').join('\n') : notes || '';
  return html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function configure() {
  const m = mode();
  autoUpdater.autoDownload = m === 'auto';
  // Ask mode installs on quit only once the user has chosen to download.
  autoUpdater.autoInstallOnAppQuit = m === 'auto' || downloadRequested;
}

async function check() {
  if (!app.isPackaged && !process.env.VANTA_UPDATE_URL) return publish({ state: 'dev' });
  if (state.state === 'downloading' || state.state === 'ready') return state;
  try {
    configure();
    await autoUpdater.checkForUpdates();
  } catch (e) {
    publish({ state: 'error', error: friendly(e) });
  }
  return state;
}

function friendly(e) {
  const msg = String(e?.message || e);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::|getaddrinfo/i.test(msg)) return 'Couldn’t reach GitHub. Check your internet connection.';
  if (/404/.test(msg)) return 'No release information found yet.';
  return msg.split('\n')[0].slice(0, 160);
}

async function download() {
  if (state.state !== 'available') return state;
  downloadRequested = true;
  configure();
  publish({ state: 'downloading', percent: 0 });
  try {
    await autoUpdater.downloadUpdate();
  } catch (e) {
    publish({ state: 'error', error: friendly(e) });
  }
  return state;
}

function install() {
  if (state.state !== 'ready') return { error: 'No update is ready to install yet.' };
  if (!canInstall()) return { error: 'Stop playback first, then restart to update.' };
  // Silent NSIS install, then relaunch Vanta.
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return { ok: true };
}

function start({ onChange, isBusy }) {
  listener = onChange;
  canInstall = () => !isBusy();

  const log = path.join(app.getPath('userData'), 'updater.log');
  const write = (lvl) => (...a) => {
    try {
      fs.appendFileSync(log, `${new Date().toISOString()} ${lvl} ${a.join(' ')}\n`);
    } catch {}
  };
  autoUpdater.logger = { info: write('info'), warn: write('warn'), error: write('error'), debug: () => {} };
  write('info')(`Vanta ${app.getVersion()} starting${process.argv.includes('--updated') ? ' (just updated)' : ''}`);
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  // Testing hook: point the updater at a local feed (a folder with latest.yml + installer) instead of GitHub.
  if (process.env.VANTA_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.VANTA_UPDATE_URL });

  autoUpdater.on('checking-for-update', () => publish({ state: 'checking', error: undefined }));
  autoUpdater.on('update-not-available', () => publish({ state: 'none', checkedAt: Date.now() }));
  autoUpdater.on('update-available', (info) =>
    publish({ state: autoUpdater.autoDownload ? 'downloading' : 'available', version: info.version, notes: notesText(info.releaseNotes), percent: 0, checkedAt: Date.now() }),
  );
  autoUpdater.on('download-progress', (p) => publish({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => {
    // Remember what's new so the next launch can say "Updated to x".
    plex.setMeta('pendingUpdate', { version: info.version, notes: notesText(info.releaseNotes) });
    publish({ state: 'ready', version: info.version, percent: 100 });
  });
  autoUpdater.on('error', (e) => publish({ state: 'error', error: friendly(e) }));

  // First launch after an update: report it once.
  try {
    const last = plex.getMeta('lastVersion');
    const pending = plex.getMeta('pendingUpdate');
    if ((last && last !== app.getVersion()) || process.argv.includes('--updated')) {
      state.justUpdated = { version: app.getVersion(), notes: pending?.version === app.getVersion() ? pending.notes : '' };
    }
    plex.setMeta('lastVersion', app.getVersion());
    plex.setMeta('pendingUpdate', undefined);
  } catch (e) {
    write('error')('could not record version:', e.message);
  }

  publish({});
  setTimeout(() => mode() !== 'manual' && check(), FIRST_CHECK_MS);
  setInterval(() => mode() !== 'manual' && check(), CHECK_EVERY_MS);
}

module.exports = {
  start,
  check,
  download,
  install,
  configure,
  get: () => ({ ...state, current: app.getVersion(), mode: mode(), packaged: app.isPackaged }),
};
