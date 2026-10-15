// Vanta by soybean_alien
// Badges: earned by watching in Vanta (never retroactive from Plex history). One profile per install,
// stored in %APPDATA%\vanta\badges.json. The catalog is data; each badge names a rule that the engine evaluates
// after every watch session.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// The catalog is plain data shared with the UI (electron/badge-catalog.json).
// rarity is DESIGNED (not rolled): it states how much effort a badge takes. Guide when adding badges:
//   common    easy and farmable; nearly every viewer gets these
//   uncommon  sustained effort (hours, a director's run, a genre streak); roughly 1 in 5 viewers
//   rare      dedicated viewing; roughly 1 in 10
//   epic      much harder, real commitment; roughly 3 in 100
//   legendary the elite few; roughly 1 in 100 (exception: First Light, everyone's onboarding gift)
// Each badge exists once and can't be earned twice. Secret badges are ALWAYS epic (user rule; the engine test enforces it).
// rule.type 'grant' is never evaluated automatically; such badges are granted explicitly (Patron: donations,
// dev builds only until a donation backend exists). unreleased: hidden from normal builds unless already earned.
// special (foiled, full-color ticket) is reserved for Patron alone: golden while pledging, purple as Previous Patron.
// No other badge may use it (the UI refuses, and the engine test fails if the catalog tries).
// emblem: art key drawn by the UI; secret: only `hint` shows until earned; rule: evaluated by RULES below.
const CATALOG = require('./badge-catalog.json');

const FILE = () => path.join(app.getPath('userData'), 'badges.json');
let store = null;

function load() {
  try {
    store = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    store = {};
  }
  store.earned ??= {}; // id -> { at }
  store.favorites ??= []; // ids shown in the sidebar showcase, in order
  store.sessions ??= []; // finished/partial watch sessions recorded by Vanta
  store.minutes ??= 0; // total real watch time
  // real watch time per kind ('movie', 'episode'); older stores are rebuilt from their sessions
  store.kindMinutes ??= store.sessions.reduce((m, s) => ((m[s.kind] = (m[s.kind] || 0) + (s.min || 0)), m), {});
  store.seasonSizes ??= {}; // season ratingKey -> episode count (from Plex)
  store.patron ??= null; // { status: 'active' | 'lapsed', at } once Patron is earned
}

function save() {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(store));
}

const localDay = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Finished sessions of kind (optionally the same show as show) in the hours before end, one per title
// (rewatching a title inside the window doesn't count twice).
function inWindow(sessions, { kind, hours, sameShow }, end, show) {
  const from = end - hours * 3600e3;
  return sessions.filter((x) => x.done && x.at > from && x.at <= end && (!kind || x.kind === kind) && (!sameShow || x.show === show));
}
const distinct = (list) => new Set(list.map((x) => x.rk)).size;

// Rule evaluators: (rule, ctx) -> boolean. ctx = { store, session?, event }.
// No time limit unless a rule says so: totals (minutes, finished) accumulate forever; finishedWithin is a
// rolling window (e.g. 24 hours) ending at the session that just finished.
const RULES = {
  launch: (_r, c) => c.event === 'launch',
  minutes: (r, c) => (r.kind ? c.store.kindMinutes[r.kind] || 0 : c.store.minutes) >= r.total,
  finished: (r, c) => distinct(done(c).filter((s) => !r.kind || s.kind === r.kind)) >= r.count, // distinct titles
  finishedWithin: (r, c) => {
    const s = c.session;
    if (!s?.done || (r.kind && s.kind !== r.kind)) return false;
    return distinct(inWindow(c.store.sessions, r, s.at, s.show)) >= r.count;
  },
  finishedBeforeYear: (r, c) => !!c.session?.done && c.session.kind === 'movie' && c.session.year > 0 && c.session.year < r.year,
  finishedBetweenHours: (r, c) => {
    if (!c.session?.done) return false;
    const h = new Date(c.session.at).getHours();
    return h >= r.from && h < r.to;
  },
  distinctGenres: (r, c) => new Set(done(c).filter((x) => x.kind === 'movie').flatMap((x) => x.genres)).size >= r.count,
  seasonComplete: (_r, c) => {
    const s = c.session;
    if (!s?.done || s.kind !== 'episode' || !s.season) return false;
    const size = c.store.seasonSizes[s.season];
    if (!size) return false;
    const eps = new Set(done(c).filter((x) => x.season === s.season).map((x) => x.rk));
    return eps.size >= size;
  },
};
const done = (c) => c.store.sessions.filter((s) => s.done);

// Progress toward an unearned badge, for the Badges page ('1/10 days' style). null = nothing to measure.
const PROGRESS = {
  minutes: (r, s) => ({ cur: Math.floor(r.kind ? s.kindMinutes[r.kind] || 0 : s.minutes), max: r.total, unit: 'min' }),
  finished: (r, s) => ({ cur: Math.min(r.count, distinct(s.sessions.filter((x) => x.done && (!r.kind || x.kind === r.kind)))), max: r.count, unit: r.kind === 'movie' ? 'movies' : 'titles' }),
  // The best run inside the window ending now (per show when the rule needs the same show).
  finishedWithin: (r, s) => {
    const hits = inWindow(s.sessions, { ...r, sameShow: false }, Date.now());
    const byShow = {};
    for (const x of hits) (byShow[x.show || ''] ??= []).push(x);
    const groups = r.sameShow ? Object.values(byShow) : [hits];
    const cur = Math.max(0, ...groups.map(distinct));
    return { cur: Math.min(cur, r.count), max: r.count, unit: `${r.kind === 'episode' ? 'episodes' : 'movies'} in ${r.hours} hrs` };
  },
  distinctGenres: (r, s) => ({ cur: new Set(s.sessions.filter((x) => x.done && x.kind === 'movie').flatMap((x) => x.genres)).size, max: r.count, unit: 'genres' }),
  seasonComplete: (_r, s) => {
    let best = null;
    for (const [season, size] of Object.entries(s.seasonSizes)) {
      const cur = new Set(s.sessions.filter((x) => x.done && x.season === season).map((x) => x.rk)).size;
      if (!best || cur / size > best.cur / best.max) best = { cur, max: size, unit: 'episodes' };
    }
    return best;
  },
};

// A badge as the viewer sees it right now: Patron shows its 'lapsed' variant (Previous Patron, Epic, purple)
// when the pledge isn't current. Rules and variant tables never leave the main process.
function resolve(b) {
  const { rule, variants, ...out } = b;
  if (b.id === 'patron' && store.patron?.status === 'lapsed' && variants?.lapsed) return { ...out, ...variants.lapsed, variant: 'lapsed' };
  return out;
}

function evaluate(event, session) {
  const fresh = [];
  for (const b of CATALOG) {
    if (store.earned[b.id]) continue;
    const rule = RULES[b.rule.type];
    if (rule && rule(b.rule, { store, session, event })) {
      store.earned[b.id] = { at: Date.now() };
      fresh.push(b.id);
    }
  }
  if (fresh.length) save();
  return fresh;
}

module.exports = {
  init() {
    load();
    return evaluate('launch');
  },
  // A watch session from the player. `watchedSec` is real playback time (seeks don't count).
  record({ meta, watchedSec, done: finished, seasonSize }) {
    const at = Date.now();
    store.minutes += Math.max(0, watchedSec) / 60;
    store.kindMinutes[meta.type] = (store.kindMinutes[meta.type] || 0) + Math.max(0, watchedSec) / 60;
    if (meta.type === 'episode' && meta.parentRatingKey && seasonSize) store.seasonSizes[meta.parentRatingKey] = seasonSize;
    const session = {
      rk: String(meta.ratingKey),
      kind: meta.type,
      year: meta.year || 0,
      genres: (meta.Genre || []).map((g) => g.tag),
      show: meta.grandparentRatingKey ? String(meta.grandparentRatingKey) : undefined,
      season: meta.parentRatingKey ? String(meta.parentRatingKey) : undefined,
      min: Math.round(watchedSec / 60),
      done: !!finished,
      at,
      day: localDay(at),
    };
    store.sessions.push(session);
    if (store.sessions.length > 5000) store.sessions = store.sessions.slice(-5000);
    save();
    return evaluate('session', session);
  },
  state() {
    const dev = !app.isPackaged;
    return {
      dev,
      // unreleased badges stay invisible in normal builds unless the viewer already has them
      catalog: CATALOG.filter((b) => dev || !b.unreleased || store.earned[b.id]).map(resolve),
      earned: store.earned,
      favorites: store.favorites,
      progress: Object.fromEntries(
        CATALOG.filter((b) => !store.earned[b.id] && PROGRESS[b.rule.type])
          .map((b) => [b.id, PROGRESS[b.rule.type](b.rule, store)])
          .filter(([, p]) => p),
      ),
      minutes: Math.round(store.minutes),
    };
  },
  setFavorites(ids) {
    store.favorites = ids.filter((id) => store.earned[id]).slice(0, 6);
    save();
    return this.state();
  },
  // Explicitly granted badges (rule 'grant', e.g. Patron). Callers decide who may grant; see main.cjs.
  // Patron re-granted while lapsed becomes active (golden) again and returns the id so the toast shows.
  grant(id) {
    const b = CATALOG.find((x) => x.id === id);
    if (!b || b.rule.type !== 'grant') return [];
    if (store.earned[id]) {
      if (id !== 'patron' || store.patron?.status !== 'lapsed') return [];
      store.patron = { status: 'active', at: Date.now() };
      save();
      return [id];
    }
    store.earned[id] = { at: Date.now() };
    if (id === 'patron') store.patron = { status: 'active', at: Date.now() };
    save();
    return [id];
  },
  // A pledge that isn't renewed: Patron stays earned (and favoritable) but shows as Epic 'Previous Patron'.
  // Silent on purpose: no toast for lapsing.
  setPatronStatus(status) {
    if (!store.earned.patron || !['active', 'lapsed'].includes(status)) return false;
    store.patron = { status, at: Date.now() };
    save();
    return true;
  },
};
