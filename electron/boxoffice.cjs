// Vanta by soybean_alien
// https://github.com/soybean-alien/vanta-personal-cinema · GPL-3.0
//
// Box office numbers for the movie grid: budget, domestic (US) opening weekend and worldwide gross.
//  1. Box Office Mojo's title page, by the film's IMDb id: all three numbers when it has them.
//  2. TMDB (with the TMDB key) fills in a missing budget or worldwide gross.
// Answers are cached on this PC: a week for films from the last two years (still earning), 90 days for older ones.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const plex = require('./plex.cjs');
const tmdb = require('./tmdb.cjs');

const CACHE = path.join(app.getPath('userData'), 'boxoffice-cache.json');
const UA = { 'User-Agent': `Vanta/${app.getVersion()} (+https://github.com/soybean-alien/vanta-personal-cinema)` };
const DAY = 24 * 3600 * 1000;

let cache;
let saveTimer;
const load = () => {
  if (!cache) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    } catch {
      cache = {};
    }
  }
  return cache;
};
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFile(CACHE, JSON.stringify(cache), () => {}), 1000);
};

const dollars = (s) => (s ? Number(String(s).replace(/[^0-9]/g, '')) || null : null);

// The three numbers from a Box Office Mojo title page (null when it has no page for the film).
async function mojo(imdb) {
  const r = await fetch(`https://www.boxofficemojo.com/title/${imdb}/`, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Box Office Mojo answered ${r.status}`);
  const html = (await r.text()).replace(/\s+/g, ' ');
  const after = (re) => dollars((re.exec(html) || [])[1]);
  // "Worldwide" in the All Releases summary table; the opening and budget rows in the details list.
  const summary = (/mojo-performance-summary-table(.*?)Cast information/.exec(html) || [])[1] || '';
  return {
    worldwide: dollars((/Worldwide.*?class="money">(\$[\d,]+)/.exec(summary) || [])[1]),
    opening: after(/Domestic Opening<\/span>.*?class="money">(\$[\d,]+)/),
    budget: after(/Budget<\/span>.*?class="money">(\$[\d,]+)/),
  };
}

// Box Office Mojo is asked about at most three films at a time; TMDB has its own limits in tmdb.cjs.
const LANES = 3;
let busy = 0;
const waiting = [];
const politely = (fn) =>
  new Promise((resolve, reject) => {
    const run = () => {
      busy++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          busy--;
          waiting.shift()?.();
        });
    };
    if (busy < LANES) run();
    else waiting.push(run);
  });

const running = new Map();

async function lookup(ratingKey) {
  const c = load();
  const hit = c[`rk:${ratingKey}`];
  if (hit && Date.now() - hit.at < hit.ttl) return hit.n;
  const meta = await plex.pms(`/library/metadata/${encodeURIComponent(ratingKey)}?includeGuids=1`);
  const m = meta?.MediaContainer?.Metadata?.[0];
  if (!m || m.type !== 'movie') return null;
  const guid = (p) => (m.Guid || []).map((g) => g.id).find((g) => g.startsWith(p))?.slice(p.length);
  const imdb = guid('imdb://');
  const tmdbId = guid('tmdb://');
  const n = { budget: null, opening: null, worldwide: null, src: [] };
  if (imdb) {
    const b = await politely(() => mojo(imdb)).catch(() => null);
    if (b) {
      Object.assign(n, { budget: b.budget, opening: b.opening, worldwide: b.worldwide });
      if (b.budget || b.opening || b.worldwide) n.src.push('Box Office Mojo');
    }
  }
  if ((!n.budget || !n.worldwide) && tmdbId && tmdb.hasKey()) {
    const t = await tmdb.call(`/movie/${encodeURIComponent(tmdbId)}`).catch(() => null);
    let used = false;
    if (!n.budget && t?.budget) (n.budget = t.budget), (used = true);
    if (!n.worldwide && t?.revenue) (n.worldwide = t.revenue), (used = true);
    if (used) n.src.push('TMDB');
  }
  const recent = (m.year || 0) >= new Date().getFullYear() - 1;
  c[`rk:${ratingKey}`] = { n, at: Date.now(), ttl: recent ? 7 * DAY : 90 * DAY };
  save();
  return n;
}

function boxOffice(ratingKey) {
  const k = String(ratingKey);
  if (!running.has(k)) running.set(k, lookup(k).finally(() => running.delete(k)));
  return running.get(k);
}

// For backups. On restore, the newer answer for each film wins.
const backupCache = () => load();
function restoreCache(c) {
  if (!c || typeof c !== 'object') return;
  const cur = load();
  for (const [k, v] of Object.entries(c)) if (!cur[k] || (v?.at || 0) > (cur[k].at || 0)) cur[k] = v;
  fs.writeFileSync(CACHE, JSON.stringify(cur));
}

module.exports = { boxOffice, backupCache, restoreCache };
