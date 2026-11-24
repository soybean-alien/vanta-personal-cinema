// Vanta by soybean_alien
// The Movie Database (TMDB), optional: the key the user pastes in Settings is stored encrypted (safeStorage) in
// tmdb.bin and never leaves the main process. Other modules call TMDB through call() (official posters, details, box
// office). Here: cover art for your collections, found by the collection's name. TMDB never decides which films
// are in a collection; that is only ever you (my-collections.cjs). Answers are cached in tmdb-cache.json.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const file = (name) => path.join(app.getPath('userData'), name);
const API = 'https://api.themoviedb.org/3';

let key;
let rejected = false; // TMDB answered 401 for the saved key: stop asking until a new key is set
let cache; // { ['colname:<name>']: { p: poster path | null, at } } (older installs also hold per-film series answers)

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
  const saved = k === loadKey();
  if (saved && rejected) throw new Error('TMDB rejected the key.');
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
    if (res.status === 401) {
      if (saved) rejected = true;
      throw new Error('TMDB rejected the key.');
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  }
}

function status() {
  return { hasKey: !!loadKey(), rejected, cached: Object.keys(loadCache()).length };
}

// Checks the key against TMDB before saving it. An empty key removes it (the cache stays).
async function setKey(k) {
  k = (k || '').trim();
  if (!k) {
    try {
      fs.unlinkSync(file('tmdb.bin'));
    } catch {}
    key = null;
    rejected = false;
    return status();
  }
  await call('/configuration', k);
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(file('tmdb.bin'), safeStorage.encryptString(k));
  key = k;
  rejected = false;
  return status();
}

// For backups: the key and the cache come back on a new install without asking TMDB again.
function restore(k, c) {
  if (k && typeof k === 'string') {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(file('tmdb.bin'), safeStorage.encryptString(k));
    key = k;
    rejected = false;
  }
  if (c && typeof c === 'object') {
    cache = { ...c, ...loadCache() };
    saveCache();
  }
}

// A collection's official poster by its name ("Saw", "The Saw Collection"): only an exact name match on TMDB counts.
// Found posters are kept 30 days, misses 3. -> full image URL or null.
const DAY = 24 * 3600 * 1000;
const colName = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/\b(the|collection|series|trilogy|saga|films?|movies?)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
const posterUrl = (p) => (p ? `https://image.tmdb.org/t/p/w500${p}` : null);
async function collectionPoster(name) {
  const n = colName(name);
  if (!n) return null;
  loadCache();
  const k = `colname:${n}`;
  const e = cache[k];
  if ((e && Date.now() - e.at < (e.p ? 30 : 3) * DAY) || !loadKey()) return posterUrl(e?.p);
  try {
    const r = await call(`/search/collection?query=${encodeURIComponent(name)}&language=en-US`);
    const hit = (r?.results || []).find((x) => x.poster_path && colName(x.name) === n);
    cache[k] = { p: hit?.poster_path || null, at: Date.now() };
    saveCache();
    return posterUrl(cache[k].p);
  } catch {
    return posterUrl(e?.p); // TMDB unreachable: keep what was known
  }
}

// Cover choices for one of your collections, art only (nothing here decides what is in a collection): the TMDB
// collections its films belong to, whatever TMDB calls them ("House of 1000 Corpses" sits in a collection of another
// name), each with its alternative posters, plus TMDB collections found by text. Lookups are kept 30 days.
//   films: [{ title, year }], query: text -> { choices: [{ name, poster }] } or { error }
async function cached(k, get) {
  const e = cache[k];
  if (e && Date.now() - e.at < 30 * DAY) return e.v;
  const v = await get();
  cache[k] = { v, at: Date.now() };
  return v;
}
async function coverChoices(films, query) {
  if (!loadKey()) return { error: 'Add your TMDB key in Settings to pick official covers. Film posters still work.' };
  loadCache();
  const found = new Map();
  try {
    for (const f of (Array.isArray(films) ? films : []).slice(0, 20)) {
      const title = String(f?.title || '').slice(0, 200);
      const year = /^\d{4}$/.test(String(f?.year)) ? f.year : '';
      if (!title) continue;
      const c = await cached(`belongs:${title.toLowerCase()}|${year}`, async () => {
        const r = await call(`/search/movie?query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}&language=en-US`);
        const id = r?.results?.[0]?.id;
        const m = id ? await call(`/movie/${id}?language=en-US`) : null;
        const b = m?.belongs_to_collection;
        return b ? { id: b.id, name: b.name, poster_path: b.poster_path } : null;
      });
      if (c && !found.has(c.id)) found.set(c.id, c);
    }
    const q = String(query || '').trim().slice(0, 100);
    if (q) {
      const r = await cached(`colsearch:${q.toLowerCase()}`, async () =>
        ((await call(`/search/collection?query=${encodeURIComponent(q)}&language=en-US`))?.results || [])
          .slice(0, 10)
          .map((c) => ({ id: c.id, name: c.name, poster_path: c.poster_path })),
      );
      for (const c of r) if (!found.has(c.id)) found.set(c.id, c);
    }
    const choices = [];
    const seen = new Set();
    const push = (name, p) => p && !seen.has(p) && (seen.add(p), choices.push({ name, poster: posterUrl(p) }));
    for (const c of found.values()) {
      push(c.name, c.poster_path);
      const more = await cached(`colposters:${c.id}`, async () =>
        ((await call(`/collection/${c.id}/images?include_image_language=en,null`))?.posters || []).slice(0, 8).map((x) => x.file_path),
      );
      for (const p of more) push(c.name, p);
    }
    saveCache();
    return { choices };
  } catch (e) {
    saveCache();
    return { error: e.message };
  }
}

module.exports = { status, setKey, collectionPoster, coverChoices, call, hasKey: () => !!loadKey(), keyRejected: () => rejected, backupKey: () => loadKey(), backupCache: () => loadCache(), restore };
