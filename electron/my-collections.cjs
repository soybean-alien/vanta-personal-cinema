// Vanta by soybean_alien
// Your collections. Vanta groups nothing on its own: a collection exists only because you made it, and holds only
// the films you put in it (any number, from any library). A film is in one collection at most: putting it in
// another moves it. Kept on this PC in my-collections.json (crash-safe, with a .bak), keyed by each film's Plex guid so they survive re-scans,
// and included in backups. Nothing is written to Plex.
//   mine: { [id]: { name, films: guid[], cover? } }   cover: the poster you picked (a TMDB image URL or a Plex film poster)
const { app } = require('electron');
const path = require('path');
const { readJson, writeJson } = require('./safefile.cjs');

const FILE = () => path.join(app.getPath('userData'), 'my-collections.json');
let data = null;

const MINE = /^mine:[\w-]+$/;
const okGuid = (g) => typeof g === 'string' && g.length > 0 && g.length < 300;
const okName = (n) => String(n || '').trim().slice(0, 120);
const okCover = (c) => (typeof c === 'string' && c.length < 500 && (/^https:\/\/image\.tmdb\.org\//.test(c) || /^\/library\//.test(c)) ? c : undefined);

function load() {
  if (data) return data;
  const raw = readJson(FILE()) || {};
  data = { mine: {} };
  for (const [id, m] of Object.entries(raw.mine || {}))
    if (/^[\w-]+$/.test(id) && m?.name) {
      data.mine[id] = { name: okName(m.name), films: Array.isArray(m.films) ? m.films.filter(okGuid) : [] };
      if (okCover(m.cover)) data.mine[id].cover = m.cover;
    }
  // Before 2.1.9 a film joined a collection of yours through `assign`; choices of TMDB or Plex series are dropped,
  // since Vanta no longer groups by series.
  for (const [g, a] of Object.entries(raw.assign || {})) {
    const m = MINE.test(a?.key || '') && data.mine[a.key.slice(5)];
    if (m && okGuid(g) && !m.films.includes(g)) m.films.push(g);
  }
  oneEach();
  return data;
}
// A film is in one collection at most: where it sits twice (an older file or backup), the first collection keeps it.
function oneEach() {
  const seen = new Set();
  for (const m of Object.values(data.mine)) m.films = m.films.filter((g) => !seen.has(g) && seen.add(g));
}
const save = () => writeJson(FILE(), data);
const get = () => JSON.parse(JSON.stringify(load()));
const collection = (key) => {
  load();
  const m = MINE.test(key || '') && data.mine[key.slice(5)];
  if (!m) throw new Error('That collection is gone.');
  return m;
};

// Put a film (or several, from select mode) in a collection, taking each out of the one it was in; key null with a
// name makes a new collection (or reuses the one of that name).
function add(guid, key, name) {
  const guids = (Array.isArray(guid) ? guid : [guid]).filter(okGuid);
  if (!guids.length) throw new Error(Array.isArray(guid) ? 'None of these films has a Plex id to remember it by.' : 'This film has no Plex id to remember it by.');
  load();
  if (!key) {
    name = okName(name);
    if (!name) throw new Error('Give the new collection a name.');
    const existing = Object.entries(data.mine).find(([, m]) => m.name.toLowerCase() === name.toLowerCase());
    key = `mine:${existing ? existing[0] : Date.now().toString(36)}`;
    if (!existing) data.mine[key.slice(5)] = { name, films: [] };
  }
  const m = collection(key);
  const moving = new Set(guids);
  for (const other of Object.values(data.mine)) if (other !== m) other.films = other.films.filter((g) => !moving.has(g));
  for (const g of moving) if (!m.films.includes(g)) m.films.push(g);
  save();
  return get();
}

// Take a film out of a collection. The collection stays, even empty, until you delete it.
function drop(guid, key) {
  const m = collection(key);
  m.films = m.films.filter((g) => g !== guid);
  save();
  return get();
}

function rename(key, name) {
  const m = collection(key);
  name = okName(name);
  if (!name) throw new Error('Give the collection a name.');
  m.name = name;
  save();
  return get();
}

// Pick a collection's cover (null goes back to automatic: TMDB by name, else the first film's poster).
function setCover(key, cover) {
  const m = collection(key);
  if (cover == null) delete m.cover;
  else if (okCover(cover)) m.cover = cover;
  else throw new Error('That picture can’t be used as a cover.');
  save();
  return get();
}

// Delete a collection. Its films stay in your libraries; only the grouping goes.
function remove(key) {
  collection(key);
  delete data.mine[key.slice(5)];
  save();
  return get();
}

// Start from scratch: every collection is deleted (the previous file is kept as my-collections.json.bak).
function reset() {
  load();
  data = { mine: {} };
  save();
  return get();
}

// How many films are in collections (for the backup summary).
const count = (d) => Object.values(d?.mine || {}).reduce((s, m) => s + (m?.films?.length || 0), 0);

// From a backup: its collections are added, and its films join them unless they are in a collection here already.
function merge(b) {
  if (!b || typeof b !== 'object') return 0;
  load();
  const before = count(data);
  for (const [id, m] of Object.entries(b.mine || {})) {
    if (!/^[\w-]+$/.test(id) || !m?.name) continue;
    const here = (data.mine[id] ??= { name: okName(m.name), films: [] });
    if (!here.cover && okCover(m.cover)) here.cover = m.cover;
    const films = [...(Array.isArray(m.films) ? m.films : []), ...Object.entries(b.assign || {}).filter(([, a]) => a?.key === `mine:${id}`).map(([g]) => g)];
    const placed = new Set(Object.values(data.mine).flatMap((x) => x.films));
    for (const g of films) if (okGuid(g) && !placed.has(g)) here.films.push(g);
  }
  save();
  return count(data) - before;
}

module.exports = { get, add, drop, rename, setCover, remove, reset, merge, count };
