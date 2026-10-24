// Vanta by soybean_alien
// Full backups: everything Vanta keeps, in one file, so a second PC (or a reinstall) comes back exactly as it was
// with no setup at all. Restore is offered in Settings → Your data and on the sign-in screen of a fresh install.
//
// What's in it:
//   badges (and the watch sessions behind them), the watch log (last-watched dates), your own collections,
//   every preference, each library's saved sort and filters (the UI's local storage), the TMDB / cast caches,
//   and, protected by a password you choose, the secrets: Plex sign-in, TMDB, Trakt and OMDb keys, Spotify sign-in.
// Secrets are encrypted with AES-256-GCM under a key derived from the password with scrypt; without a password
// the backup holds everything else and the secrets are left out. Restoring never deletes anything: badges, dates
// and collections are combined with what's already here.
const { app, dialog } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const badges = require('./badges.cjs');
const history = require('./history.cjs');
const plex = require('./plex.cjs');
const tmdb = require('./tmdb.cjs');
const details = require('./details.cjs');
const spotify = require('./spotify.cjs');
const myCollections = require('./my-collections.cjs');

const KIND = 'vanta-backup';
const VERSION = 2;

function seal(obj, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { alg: 'aes-256-gcm+scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function open(box, password) {
  try {
    const key = crypto.scryptSync(password, Buffer.from(box.salt, 'base64'), 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8'));
  } catch {
    throw new Error('Wrong backup password.');
  }
}

// opts: { password?: string, uiStorage?: { [key]: string } } (the UI's local storage: per-library filters)
async function exportTo(win, opts = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Vanta backup',
    defaultPath: `Vanta backup ${day}.json`,
    filters: [{ name: 'Vanta backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  const secrets = { plex: plex.backupState(), tmdb: tmdb.backupKey(), ...details.backupKeys(), spotify: spotify.backupState() };
  const data = {
    kind: KIND,
    version: VERSION,
    app: app.getVersion(),
    exportedAt: new Date().toISOString(),
    badges: badges.snapshot(),
    watchHistory: history.entries(),
    myCollections: myCollections.get(),
    prefs: plex.getPrefs(),
    uiStorage: opts.uiStorage && typeof opts.uiStorage === 'object' ? opts.uiStorage : {},
    caches: { tmdb: tmdb.backupCache(), ...details.backupCaches() },
    secrets: opts.password ? seal(secrets, opts.password) : null,
  };
  // Written next to the target first, then renamed, so a full disk never leaves a half-written backup.
  fs.writeFileSync(filePath + '.tmp', JSON.stringify(data));
  fs.renameSync(filePath + '.tmp', filePath);
  return {
    file: filePath,
    badges: Object.keys(data.badges.earned || {}).length,
    watched: Object.keys(data.watchHistory).length,
    collections: Object.keys(data.myCollections.assign || {}).length,
    secrets: !!data.secrets,
  };
}

// Step 1 picks the file (remembered here, not taken from the UI); step 2 restores it, with the password when the
// file holds secrets. Returns { needsPassword } when it needs one.
let picked = null;
async function importFrom(win, opts = {}) {
  if (!opts.again || !picked) {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Restore a Vanta backup',
      properties: ['openFile'],
      filters: [{ name: 'Vanta backup', extensions: ['json'] }],
    });
    if (canceled || !filePaths?.[0]) return { canceled: true };
    picked = filePaths[0];
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(picked, 'utf8'));
  } catch {
    throw new Error("That file isn't a readable Vanta backup.");
  }
  if (data?.kind !== KIND) throw new Error("That file isn't a Vanta backup.");
  let secrets = null;
  if (data.secrets) {
    if (!opts.password) return { needsPassword: true, file: picked };
    secrets = open(data.secrets, opts.password); // throws on a wrong password, before anything is changed
  }

  const added = badges.restore(data.badges);
  const before = Object.keys(history.entries()).length;
  history.merge(data.watchHistory);
  const watched = Object.keys(history.entries()).length - before;
  const collections = myCollections.merge(data.myCollections);
  tmdb.restore(secrets?.tmdb, data.caches?.tmdb);
  details.restoreCaches(data.caches);
  if (secrets) {
    details.restoreKeys(secrets);
    spotify.restoreState(secrets.spotify);
    plex.restoreState(secrets.plex);
  }
  // Preferences come back as they were, except pinned views, which are added to the ones already here.
  if (data.prefs?.ui || data.prefs?.player) {
    const cur = plex.getPrefs();
    const pins = [...cur.ui.pins, ...(data.prefs.ui?.pins || []).filter((p) => !cur.ui.pins.some((q) => q.id === p.id))];
    plex.setPrefs({ player: data.prefs.player || {}, ui: { ...(data.prefs.ui || {}), pins } });
  }
  const file = picked;
  picked = null;
  return {
    file,
    badgesAdded: added,
    watchedAdded: watched,
    collectionsAdded: collections,
    secrets: !!secrets,
    uiStorage: data.uiStorage || {},
    from: data.exportedAt,
  };
}

// After a restore, everything (sign-in, keys, caches) is reloaded by starting Vanta again.
function restart() {
  app.relaunch();
  app.exit(0);
}

module.exports = { exportTo, importFrom, restart };
