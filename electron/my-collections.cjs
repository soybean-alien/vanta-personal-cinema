// Vanta by soybean_alien
// Your own collection choices: "put this film in that series" for the films TMDB or Plex missed. Kept on this PC
// in my-collections.json (crash-safe, with a .bak), keyed by the film's Plex guid so they survive re-scans, and
// included in backups. Nothing is written to Plex. A target is a folder key:
//   'plex:<collection ratingKey>' | 'tmdb:<collection id>' | 'mine:<id>' (a collection you made in Vanta)
const { app } = require('electron');
const path = require('path');
const { readJson, writeJson } = require('./safefile.cjs');

const FILE = () => path.join(app.getPath('userData'), 'my-collections.json');
let data = null; // { assign: { [guid]: { key, name } }, mine: { [id]: { name } } }

function load() {
  if (!data) data = readJson(FILE()) || {};
  data.assign ??= {};
  data.mine ??= {};
  return data;
}
const save = () => writeJson(FILE(), data);
const get = () => JSON.parse(JSON.stringify(load()));

const okGuid = (g) => typeof g === 'string' && g.length > 0 && g.length < 300;

// key = an existing folder, or null with `name` to make a new collection of your own.
function assign(guid, key, name) {
  if (!okGuid(guid)) throw new Error('This film has no Plex id to remember it by.');
  load();
  name = String(name || '').trim().slice(0, 120);
  if (!key) {
    if (!name) throw new Error('Give the new collection a name.');
    const existing = Object.entries(data.mine).find(([, m]) => m.name.toLowerCase() === name.toLowerCase());
    key = `mine:${existing ? existing[0] : Date.now().toString(36)}`;
    if (!existing) data.mine[key.slice(5)] = { name };
  }
  if (!/^(plex|tmdb|mine):[\w-]+$/.test(key)) throw new Error('Bad collection.');
  data.assign[guid] = { key, name };
  save();
  return get();
}

function unassign(guid) {
  load();
  delete data.assign[guid];
  // A collection of your own with no films left is removed too.
  const used = new Set(Object.values(data.assign).map((a) => a.key));
  for (const id of Object.keys(data.mine)) if (!used.has(`mine:${id}`)) delete data.mine[id];
  save();
  return get();
}

// From a backup: your choices there are added; choices made here since stay as they are.
function merge(b) {
  if (!b || typeof b !== 'object') return 0;
  load();
  let n = 0;
  for (const [id, m] of Object.entries(b.mine || {})) if (!data.mine[id] && m?.name) data.mine[id] = { name: String(m.name) };
  for (const [g, a] of Object.entries(b.assign || {}))
    if (okGuid(g) && !data.assign[g] && /^(plex|tmdb|mine):[\w-]+$/.test(a?.key || '')) {
      data.assign[g] = { key: a.key, name: String(a.name || '') };
      n++;
    }
  save();
  return n;
}

module.exports = { get, assign, unassign, merge };
