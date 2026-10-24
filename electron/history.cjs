// Vanta by soybean_alien
// Vanta's own watch log: when each title was last watched, kept on this PC in watch-history.json, so the
// "last watched" dates survive a Plex database reset, a library re-scan or a server move. Keyed by Plex's guid
// ('plex://movie/5d77...'), which stays the same when a film is re-added or the library is rebuilt, unlike ratingKey.
// Fed by Vanta's player (80% watched), Mark watched, and the dates Plex already has (copied in as libraries load).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { readJson, writeJson } = require('./safefile.cjs');

const FILE = () => path.join(app.getPath('userData'), 'watch-history.json');
let log = null; // { [guid]: { at: ms, title, type } }

function load() {
  if (!log) log = readJson(FILE()) || {};
  return log;
}
let timer;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE()), { recursive: true });
    writeJson(FILE(), log);
  }, 300);
}
// Flush right away on quit so nothing waits in the timer.
app.on('will-quit', () => {
  if (timer) {
    clearTimeout(timer);
    writeJson(FILE(), log);
  }
});

const ok = (guid) => typeof guid === 'string' && guid.length > 0 && guid.length < 300;

// A title was just watched (player at 80%+, or Mark watched).
function record(meta) {
  if (!ok(meta?.guid)) return;
  load()[meta.guid] = { at: Date.now(), title: meta.title, type: meta.type };
  save();
}

// Mark unwatched: the viewer said it wasn't watched, so its date goes too.
function forget(guid) {
  if (!ok(guid) || !load()[guid]) return;
  delete log[guid];
  save();
}

// Dates Plex already has: { [guid]: { at, title, type } }. Only newer dates replace what's logged.
function merge(entries) {
  load();
  let changed = false;
  for (const [guid, e] of Object.entries(entries || {})) {
    if (!ok(guid) || !Number.isFinite(e?.at)) continue;
    if (!log[guid] || log[guid].at < e.at) {
      log[guid] = { at: e.at, title: e.title, type: e.type };
      changed = true;
    }
  }
  if (changed) save();
}

// guid -> last watched (ms) for the UI.
const all = () => Object.fromEntries(Object.entries(load()).map(([g, e]) => [g, e.at]));

module.exports = { record, forget, merge, all, entries: () => JSON.parse(JSON.stringify(load())) };
