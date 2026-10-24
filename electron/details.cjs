// Vanta by soybean_alien
// Extra facts for the details page, all optional and read-only:
//  - live scores: TMDB (the TMDB key from Library settings), Trakt (a Trakt client ID) and IMDb, Rotten Tomatoes and
//    Metacritic through OMDb (an OMDb key). Without a key, the page uses the scores Plex already has.
//  - the cast's birthdays and deaths, from TMDB's people records.
// Only a film's or show's TMDB/IMDb id and TMDB person ids are sent. Answers are cached on this PC (scores for 12 h,
// people for 30 days so deaths show up); the Trakt and OMDb keys are kept encrypted like the TMDB one.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const tmdb = require('./tmdb.cjs');
const traktApp = require('./trakt.cjs');

const file = (name) => path.join(app.getPath('userData'), name);
const SCORES_TTL = 12 * 3600 * 1000;
const PEOPLE_TTL = 30 * 24 * 3600 * 1000;
const CREDITS_TTL = 7 * 24 * 3600 * 1000;

// --- keys -------------------------------------------------------------------------------------------------------

const KEY_FILES = { trakt: 'trakt.bin', omdb: 'omdb.bin' };
const keys = {};
function loadKey(service) {
  if (keys[service] === undefined) {
    try {
      keys[service] = safeStorage.decryptString(fs.readFileSync(file(KEY_FILES[service])));
    } catch {
      keys[service] = null;
    }
  }
  return keys[service];
}

const status = () => ({ tmdb: tmdb.hasKey(), trakt: !!loadKey('trakt'), traktBuiltIn: traktApp.available(), omdb: !!loadKey('omdb') });

// Checks a key against its service before saving it. An empty key removes it.
async function setKey(service, k) {
  if (!KEY_FILES[service]) throw new Error('Unknown service.');
  k = (k || '').trim();
  if (!k) {
    try {
      fs.unlinkSync(file(KEY_FILES[service]));
    } catch {}
    keys[service] = null;
    return status();
  }
  // Probe with a well-known film (The Matrix).
  if (service === 'trakt') await trakt('/movies/tt0133093/ratings', k);
  else await omdb('tt0133093', k);
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(file(KEY_FILES[service]), safeStorage.encryptString(k));
  keys[service] = k;
  scores = {}; // re-ask with the new key
  return status();
}

// --- caches -----------------------------------------------------------------------------------------------------

function jsonCache(name) {
  let data;
  let timer;
  return {
    get() {
      if (!data) {
        try {
          data = JSON.parse(fs.readFileSync(file(name), 'utf8'));
        } catch {
          data = {};
        }
      }
      return data;
    },
    save() {
      clearTimeout(timer);
      timer = setTimeout(() => fs.writeFile(file(name), JSON.stringify(data), () => {}), 500);
    },
  };
}
const peopleCache = jsonCache('people-cache.json'); // { [tmdbPersonId]: { p: {...}, at } }
const creditsCache = jsonCache('credits-cache.json'); // { ['movie:603']: { cast: [...], crew: [...], at } }
let scores = {}; // in memory: { [key]: { v, at } }

// --- services ---------------------------------------------------------------------------------------------------

async function trakt(p, k = loadKey('trakt')) {
  const res = await fetch('https://api.trakt.tv' + p, {
    headers: { 'Content-Type': 'application/json', 'User-Agent': `Vanta/${app.getVersion()}`, 'trakt-api-version': '2', 'trakt-api-key': k },
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 401 || res.status === 403) throw new Error('Trakt rejected the client ID.');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Trakt error ${res.status}`);
  return res.json();
}

async function omdb(imdbId, k = loadKey('omdb')) {
  const res = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(k)}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 401) throw new Error('OMDb rejected the key.');
  if (!res.ok) throw new Error(`OMDb error ${res.status}`);
  const j = await res.json();
  if (j.Response === 'False') {
    if (/invalid api key|limit/i.test(j.Error || '')) throw new Error(`OMDb: ${j.Error}`);
    return null;
  }
  return j;
}

const num = (s) => {
  const n = parseFloat(String(s || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

// ids: { kind: 'movie' | 'show', imdb?: 'tt…', tmdb?: '603' }
// -> { tmdb?: {value, votes}, trakt?: {value, votes}, imdb?: {value, votes}, rt?: {value}, metacritic?: {value}, at }
// Each source is optional and independent: one failing never hides the others.
async function liveScores(ids) {
  const key = `${ids.kind}:${ids.imdb || ''}:${ids.tmdb || ''}`;
  const hit = scores[key];
  if (hit && Date.now() - hit.at < SCORES_TTL) return hit.v;
  const out = { errors: [] };
  const jobs = [];
  if (ids.tmdb && tmdb.hasKey())
    jobs.push(
      tmdb.call(`/${ids.kind === 'show' ? 'tv' : 'movie'}/${encodeURIComponent(ids.tmdb)}`).then((m) => {
        if (m?.vote_count) out.tmdb = { value: m.vote_average, votes: m.vote_count };
      }),
    );
  // Trakt takes an IMDb id in place of its own slug.
  // Vanta's built-in Trakt app id needs no key; an older pasted Client ID still works when it isn't set.
  if (ids.imdb && traktApp.available())
    jobs.push(
      traktApp.rating(ids.kind, ids.imdb).then((r) => {
        if (r) out.trakt = r;
      }),
    );
  else if (ids.imdb && loadKey('trakt'))
    jobs.push(
      trakt(`/${ids.kind === 'show' ? 'shows' : 'movies'}/${encodeURIComponent(ids.imdb)}/ratings`).then((r) => {
        if (r?.votes) out.trakt = { value: r.rating, votes: r.votes };
      }),
    );
  if (ids.imdb && loadKey('omdb'))
    jobs.push(
      omdb(ids.imdb).then((j) => {
        if (!j) return;
        if (num(j.imdbRating) !== undefined) out.imdb = { value: num(j.imdbRating), votes: num(j.imdbVotes) };
        for (const r of j.Ratings || []) {
          if (r.Source === 'Rotten Tomatoes') out.rt = { value: num(r.Value) };
          if (r.Source === 'Metacritic') out.metacritic = { value: num(r.Value) };
        }
        if (!out.metacritic && num(j.Metascore) !== undefined) out.metacritic = { value: num(j.Metascore) };
      }),
    );
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === 'rejected') out.errors.push(r.reason?.message || String(r.reason));
  out.at = Date.now();
  if (!out.errors.length) scores[key] = { v: out, at: out.at };
  return out;
}

// --- cast -------------------------------------------------------------------------------------------------------

async function credits(kind, id) {
  const ref = `${kind}:${id}`;
  const c = creditsCache.get();
  if (c[ref] && Date.now() - c[ref].at < CREDITS_TTL) return c[ref];
  const r = await tmdb.call(kind === 'show' ? `/tv/${encodeURIComponent(id)}/aggregate_credits` : `/movie/${encodeURIComponent(id)}/credits`);
  const cast = (r?.cast || []).map((p) => ({ id: p.id, name: p.name, character: p.character ?? p.roles?.[0]?.character }));
  const crew = (r?.crew || []).map((p) => ({ id: p.id, name: p.name, job: p.job ?? p.jobs?.[0]?.job }));
  c[ref] = { cast, crew, at: Date.now() };
  creditsCache.save();
  return c[ref];
}

// --- more sources for birthdays and deaths -----------------------------------------------------------------------
// TMDB has no birthday for many supporting and bit-part actors. When it's missing, Vanta asks, in order:
//  1. Wikidata, by the person's Wikidata id or IMDb id (both from TMDB): exact, never a guess by name.
//  2. Trakt's people records, by TMDB id (Vanta's public Trakt app id; no sign-in needed).
//  3. TVmaze, by name, but only when exactly one person there has that exact name (a wrong birthday is worse than
//     none).
// Wikidata also fills in deaths TMDB hasn't recorded, for anyone born before 1965. Only exact days are accepted.
const UA = { 'User-Agent': `Vanta/${app.getVersion()} (+https://github.com/soybean-alien/vanta-personal-cinema)` };
const day = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10) : null);

async function wikidataLife(wikidataId, imdbId) {
  let qid = /^Q\d+$/.test(wikidataId || '') ? wikidataId : null;
  if (!qid && /^nm\d+$/.test(imdbId || '')) {
    const s = await fetch(`https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P345=${imdbId}&format=json`, {
      headers: UA,
      signal: AbortSignal.timeout(15000),
    }).then((r) => (r.ok ? r.json() : null));
    qid = s?.query?.search?.length === 1 ? s.query.search[0].title : null;
  }
  if (!qid) return null;
  const e = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`, {
    headers: UA,
    signal: AbortSignal.timeout(15000),
  }).then((r) => (r.ok ? r.json() : null));
  const claims = e?.entities?.[qid]?.claims || {};
  // The preferred statement if there is one, else the first; day precision (11) only.
  const date = (prop) => {
    const list = (claims[prop] || []).filter((c) => c.rank !== 'deprecated');
    const v = (list.find((c) => c.rank === 'preferred') || list[0])?.mainsnak?.datavalue?.value;
    return v?.precision === 11 ? day(String(v.time).replace(/^\+/, '')) : null;
  };
  return { birthday: date('P569'), deathday: date('P570') };
}

// TVmaze allows about 20 requests per 10 seconds: one at a time, spaced out.
let tvmazeChain = Promise.resolve();
function tvmazeLife(name) {
  const job = tvmazeChain.then(async () => {
    await new Promise((r) => setTimeout(r, 550));
    const list = await fetch(`https://api.tvmaze.com/search/people?q=${encodeURIComponent(name)}`, { headers: UA, signal: AbortSignal.timeout(15000) }).then((r) =>
      r.ok ? r.json() : [],
    );
    const same = (list || []).map((x) => x.person).filter((p) => p && norm(p.name) === norm(name));
    return same.length === 1 && day(same[0].birthday) ? { birthday: day(same[0].birthday), deathday: day(same[0].deathday) } : null;
  });
  tvmazeChain = job.catch(() => {});
  return job;
}

async function person(id, name) {
  const c = peopleCache.get();
  const e = c[id];
  // Birthdays don't change; only the living are re-checked (for a death) once the entry is a month old.
  // Entries from before the extra sources (no `v`) and still missing a birthday are looked up again once.
  // Older entries' birthdays all came from TMDB.
  if (e && (e.p.v || e.p.birthday) && (e.p.deathday || Date.now() - e.at < PEOPLE_TTL)) return e.p.v ? e.p : { ...e.p, src: e.p.birthday ? 'TMDB' : null };
  const r = await tmdb.call(`/person/${encodeURIComponent(id)}?append_to_response=external_ids`);
  const p = { birthday: r?.birthday || null, deathday: r?.deathday || null, place: r?.place_of_birth || null, src: r?.birthday ? 'TMDB' : null, v: 2 };
  const ext = r?.external_ids || {};
  const fill = (life, src) => {
    if (!life) return false;
    if (!p.birthday && life.birthday) {
      p.birthday = life.birthday;
      p.src = src;
    }
    if (!p.deathday && life.deathday && p.birthday) {
      p.deathday = life.deathday;
      p.deathSrc = src;
    }
    return !!p.birthday;
  };
  const born = Number((p.birthday || '').slice(0, 4));
  if (!p.birthday || (!p.deathday && born && born < 1965)) fill(await wikidataLife(ext.wikidata_id, ext.imdb_id || r?.imdb_id).catch(() => null), 'Wikidata');
  if (!p.birthday) fill(await traktApp.personLife(id).catch(() => null), 'Trakt');
  if (!p.birthday && (name || r?.name)) fill(await tvmazeLife(name || r.name).catch(() => null), 'TVmaze');
  c[id] = { p, at: Date.now() };
  peopleCache.save();
  return p;
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// req: { kind: 'movie' | 'show', tmdb: '840326', names: ['Jorma Tommila', ...] }
// -> { people: { [name]: { id, birthday, deathday, place } } } for the names TMDB's credits know.
async function cast(req) {
  if (!tmdb.hasKey()) return { people: {}, noKey: true };
  if (!req?.tmdb) return { people: {} };
  const cr = await credits(req.kind, req.tmdb);
  const byName = new Map();
  for (const p of [...cr.cast, ...cr.crew]) if (!byName.has(norm(p.name))) byName.set(norm(p.name), p.id);
  const wanted = (req.names || []).map((n) => [n, byName.get(norm(n))]).filter(([, id]) => id);
  const people = {};
  let i = 0;
  const worker = async () => {
    while (i < wanted.length) {
      const [name, id] = wanted[i++];
      try {
        people[name] = { id, ...(await person(id, name)) };
      } catch (e) {
        if (e.message === 'TMDB rejected the key.') throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, wanted.length) }, worker));
  return { people };
}

// For backups: the Trakt and OMDb keys, and the cast caches.
const backupKeys = () => ({ trakt: loadKey('trakt'), omdb: loadKey('omdb') });
function restoreKeys(k) {
  for (const s of Object.keys(KEY_FILES))
    if (k?.[s] && typeof k[s] === 'string') {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
      fs.writeFileSync(file(KEY_FILES[s]), safeStorage.encryptString(k[s]));
      keys[s] = k[s];
    }
}
const backupCaches = () => ({ people: peopleCache.get(), credits: creditsCache.get() });
function restoreCaches(c) {
  if (c?.people) Object.assign(peopleCache.get(), { ...c.people, ...peopleCache.get() }), peopleCache.save();
  if (c?.credits) Object.assign(creditsCache.get(), { ...c.credits, ...creditsCache.get() }), creditsCache.save();
}

module.exports = { status, setKey, liveScores, cast, backupKeys, restoreKeys, backupCaches, restoreCaches };
