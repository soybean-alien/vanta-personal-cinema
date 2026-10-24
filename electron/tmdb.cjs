// Vanta by soybean_alien
// Optional franchise lookup on The Movie Database (TMDB), for the movie grid's collection folders.
// Read-only towards Plex: it only reads each movie's TMDB/IMDb id from Plex and asks TMDB which collection
// ("The Matrix Collection") the film belongs to. Answers are cached on this PC in tmdb-cache.json; the key the
// user pastes in Settings is stored encrypted (safeStorage) in tmdb.bin and never leaves the main process.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const file = (name) => path.join(app.getPath('userData'), name);
const API = 'https://api.themoviedb.org/3';
const RECHECK_NONE = 30 * 24 * 3600 * 1000; // films with no collection are asked again after 30 days (sequels get made)

let key;
let cache; // { [ref]: { c: { id, name } | null, at } }, ref = 'tmdb:603' | 'imdb:tt0133093'

function loadKey() {
  if (key === undefined) {
    try {
      key = safeStorage.decryptString(fs.readFileSync(file('tmdb.bin')));
    } catch {
      key = null;
    }
  }
  return key;
}

function loadCache() {
  if (!cache) {
    try {
      cache = JSON.parse(fs.readFileSync(file('tmdb-cache.json'), 'utf8'));
    } catch {
      cache = {};
    }
  }
  return cache;
}
const saveCache = () => fs.writeFileSync(file('tmdb-cache.json'), JSON.stringify(cache));

// TMDB hands out two credentials: a short v3 "API key" (query string) and a long v4 "read access token" (Bearer).
async function call(p, k = loadKey()) {
  if (!k) throw new Error('No TMDB key set.');
  const bearer = k.length > 40;
  const url = API + p + (bearer ? '' : `${p.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(k)}`);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${k}` } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (res.status === 401) throw new Error('TMDB rejected the key.');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  }
}

function status() {
  return { hasKey: !!loadKey(), cached: Object.keys(loadCache()).length };
}

// Checks the key against TMDB before saving it. An empty key removes it (the cache stays).
async function setKey(k) {
  k = (k || '').trim();
  if (!k) {
    try {
      fs.unlinkSync(file('tmdb.bin'));
    } catch {}
    key = null;
    return status();
  }
  await call('/configuration', k);
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(file('tmdb.bin'), safeStorage.encryptString(k));
  key = k;
  return status();
}

async function lookupOne(ref) {
  const [kind, id] = ref.split(':');
  let tmdbId = id;
  if (kind === 'imdb') {
    const found = await call(`/find/${encodeURIComponent(id)}?external_source=imdb_id`);
    tmdbId = found?.movie_results?.[0]?.id;
    if (!tmdbId) return null;
  }
  const m = await call(`/movie/${encodeURIComponent(tmdbId)}`);
  const c = m?.belongs_to_collection;
  return c ? { id: c.id, name: c.name } : null;
}

// refs: { [ratingKey]: ref } -> { [ratingKey]: { id, name } } for films that belong to a TMDB collection.
// Uncached refs are looked up 8 at a time; the cache is saved as it goes so an interrupted run isn't lost.
async function collections(refs) {
  loadCache();
  const now = Date.now();
  const stale = (e) => !e || (!e.c && now - e.at > RECHECK_NONE);
  // Without a key, only what's already cached is used.
  const todo = loadKey() ? [...new Set(Object.values(refs).filter((r) => stale(cache[r])))] : [];
  let i = 0;
  let failed = 0;
  let sinceSave = 0;
  const worker = async () => {
    while (i < todo.length) {
      const ref = todo[i++];
      try {
        cache[ref] = { c: await lookupOne(ref), at: Date.now() };
        if (++sinceSave >= 25) {
          sinceSave = 0;
          saveCache();
        }
      } catch (e) {
        if (e.message === 'TMDB rejected the key.') throw e;
        failed++;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(8, todo.length) }, worker));
  } finally {
    if (todo.length) saveCache();
  }
  const out = {};
  for (const [rk, ref] of Object.entries(refs)) if (cache[ref]?.c) out[rk] = cache[ref].c;
  return { byFilm: out, looked: todo.length, failed };
}

// For backups: the key and the cache come back on a new install without asking TMDB again.
function restore(k, c) {
  if (k && typeof k === 'string') {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(file('tmdb.bin'), safeStorage.encryptString(k));
    key = k;
  }
  if (c && typeof c === 'object') {
    cache = { ...c, ...loadCache() };
    saveCache();
  }
}

module.exports = { status, setKey, collections, call, hasKey: () => !!loadKey(), backupKey: () => loadKey(), backupCache: () => loadCache(), restore };
