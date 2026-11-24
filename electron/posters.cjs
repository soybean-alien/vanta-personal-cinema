// Covers that match the real release.
//
// official(): with Settings → Library → "Official release posters" on (the default) and a TMDB key set, every movie
// and show shows TMDB's main English poster instead of whatever Plex has (often fan art from poster files next to
// the media). Found by the title's own TMDB or IMDb id, but only when TMDB's title or year agrees with Plex's: a title
// Plex matched to the wrong entry is searched by its title instead. Nothing found = Plex's own cover.
//
// findPoster(): for titles whose cover in Plex is only a frame grabbed from the video (Plex never matched them), in
// either setting: TMDB search by title and year, then Wikipedia's infobox image (no key needed; smaller).
//
// A wrong poster is worse than none: only exact title matches are taken, with the year when one is known.
// Read-only: nothing is written to Plex.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const UA = { 'User-Agent': `Vanta/${app.getVersion()} (+https://github.com/soybean-alien/vanta-personal-cinema)` };
const DAY = 24 * 3600 * 1000;
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
const tmdb = () => require('./tmdb.cjs');
const tmdbUrl = (p) => (p ? `https://image.tmdb.org/t/p/w500${p}` : null);

// The year from Plex, else from the file name ("A Serbian Film (2010).mkv", "Movie.2010.1080p.mkv").
function yearOf(md) {
  if (md.year) return Number(md.year);
  const file = md.Media?.[0]?.Part?.[0]?.file || '';
  const m = /(?:^|[\s.([_-])((?:19|20)\d{2})(?=$|[\s.)\]_-])/.exec(file.split(/[\\/]/).pop() || '');
  return m ? Number(m[1]) : null;
}
const yearIn = (x) => Number((x.release_date || x.first_air_date || '').slice(0, 4)) || null;
const titlesOf = (x) => [x.title, x.original_title, x.name, x.original_name].filter(Boolean);

async function searchTmdb(title, year, kind) {
  if (!tmdb().hasKey()) return null;
  const q = new URLSearchParams({ query: title, language: 'en-US' });
  const r = await tmdb().call(`/search/${kind === 'show' ? 'tv' : 'movie'}?${q}`);
  const want = norm(title);
  const same = (r?.results || []).filter((x) => x.poster_path && titlesOf(x).some((t) => norm(t) === want));
  const pick = year ? same.find((x) => yearIn(x) && Math.abs(yearIn(x) - year) <= 1) : same.length === 1 ? same[0] : null;
  return tmdbUrl(pick?.poster_path);
}

async function fromWikipedia(title, year, kind) {
  const word = kind === 'show' ? 'series' : 'film';
  const pages = [...(year ? [`${title} (${year} ${word})`] : []), `${title} (${word})`, title];
  const q = new URLSearchParams({ action: 'query', format: 'json', redirects: '1', prop: 'pageimages|description', piprop: 'original', pilicense: 'any', titles: pages.join('|') });
  const j = await fetch(`https://en.wikipedia.org/w/api.php?${q}`, { headers: UA, signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.json() : null));
  const found = Object.values(j?.query?.pages || {});
  // The articles in the order asked (most specific first), following redirects to their real titles.
  const real = (t) => {
    const n = j?.query?.normalized?.find((x) => x.from === t)?.to || t;
    return j?.query?.redirects?.find((x) => x.from === n)?.to || n;
  };
  for (const t of pages) {
    const p = found.find((x) => x.title === real(t));
    const img = p?.original;
    if (!img?.source || img.width >= img.height) continue; // posters are portrait
    const d = p.description || '';
    if (!new RegExp(kind === 'show' ? 'series|show' : 'film|movie', 'i').test(d)) continue;
    if (year && /\b(19|20)\d{2}\b/.test(d) && ![year - 1, year, year + 1].some((y) => d.includes(String(y)))) continue;
    return img.source.replace(/\?.*$/, '');
  }
  return null;
}

const kindOf = (md) => (md.type === 'show' ? 'show' : 'movie');

// md: the title's Plex metadata. -> a poster URL for a title Plex has no poster for, or null.
async function findPoster(md) {
  const title = String(md.title || '').trim();
  if (!title) return null;
  const year = yearOf(md);
  return (await searchTmdb(title, year, kindOf(md)).catch(() => null)) || (await fromWikipedia(title, year, kindOf(md)).catch(() => null));
}

// --- official release posters -------------------------------------------------------------------------------------

const CACHE = () => path.join(app.getPath('userData'), 'poster-cache.json');
let cache;
let timer;
const loadCache = () => {
  if (!cache) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE(), 'utf8'));
    } catch {
      cache = {};
    }
  }
  return cache;
};
const saveCache = () => {
  clearTimeout(timer);
  timer = setTimeout(() => fs.writeFile(CACHE(), JSON.stringify(cache), () => {}), 1000);
};

// Plex and TMDB name the same title: same title (any of TMDB's), or same year.
function agrees(md, x) {
  const plex = [md.title, md.originalTitle].filter(Boolean).map(norm);
  if (titlesOf(x).some((t) => plex.includes(norm(t)))) return true;
  const y = yearOf(md);
  return !!(y && yearIn(x) && Math.abs(yearIn(x) - y) <= 1);
}

async function lookupOfficial(md) {
  const kind = kindOf(md);
  const type = kind === 'show' ? 'tv' : 'movie';
  const ids = Object.fromEntries((md.Guid || []).map((g) => String(g.id).split('://')).filter((p) => p.length === 2));
  let x = null;
  // TMDB answers null for an unknown id; any other failure is thrown, so a miss isn't remembered while TMDB is down.
  if (ids.tmdb) x = await tmdb().call(`/${type}/${encodeURIComponent(ids.tmdb)}?language=en-US`);
  if (!x && ids.imdb) {
    const f = await tmdb().call(`/find/${encodeURIComponent(ids.imdb)}?external_source=imdb_id&language=en-US`);
    x = (kind === 'show' ? f?.tv_results : f?.movie_results)?.[0] || null;
  }
  if (x?.poster_path && agrees(md, x)) return tmdbUrl(x.poster_path);
  return md.title ? searchTmdb(String(md.title).trim(), yearOf(md), kind) : null;
}

// id: the Plex ratingKey; getMd: () => Promise<metadata with Guids>. -> poster URL or null. Found posters are kept for
// 30 days, misses for 3 (so a title matched in Plex later gets its poster).
async function official(id, getMd) {
  if (!tmdb().hasKey()) return null;
  const c = loadCache();
  const e = c[id];
  if (e && Date.now() - e.at < (e.u ? 30 : 3) * DAY) return e.u;
  const md = await getMd();
  if (!md || (md.type !== 'movie' && md.type !== 'show')) return null;
  const u = await lookupOfficial(md).catch(() => undefined);
  if (u === undefined) return e?.u ?? null; // TMDB unreachable: keep what was known
  c[id] = { u, at: Date.now() };
  saveCache();
  return u;
}

// Poster images from TMDB and Wikipedia are kept on disk, so covers show as fast as Plex's own after the first time.
const IMG_DIR = () => path.join(app.getPath('userData'), 'poster-images');
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
async function fetchPoster(url) {
  const name = require('crypto').createHash('sha1').update(url).digest('hex').slice(0, 24);
  const ext = (/\.(jpe?g|png|webp)$/i.exec(url)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const f = path.join(IMG_DIR(), `${name}.${ext}`);
  const headers = { 'Content-Type': TYPES[ext] };
  try {
    return new Response(await fs.promises.readFile(f), { headers });
  } catch {}
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return res;
  const buf = Buffer.from(await res.arrayBuffer());
  fs.promises.mkdir(IMG_DIR(), { recursive: true }).then(() => fs.promises.writeFile(f, buf)).catch(() => {});
  return new Response(buf, { headers });
}
const isWikimedia = (url) => /^https:\/\/upload\.wikimedia\.org\//.test(url);

module.exports = { official, findPoster, isWikimedia, fetchPoster };
