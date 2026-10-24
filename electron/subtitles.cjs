// Vanta by soybean_alien
// English subtitles that find themselves. When a film or episode has no English subtitle track, Vanta looks one up,
// keeps it on this PC (%APPDATA%\vanta\subs, never on the server) and mpv loads it automatically. No accounts:
//  1. OpenSubtitles' public REST search by file fingerprint (the "OSDb hash" of the first and last 64 KB, read from
//     the server with two small range requests). A fingerprint match was made for this exact file, so it's in sync.
//  2. The same search by IMDb id (or show + season + episode), ranked against the file's own name: resolution,
//     source (BluRay, WEB-DL...), release group, codec and frame rate.
//  3. YTS-Subs, for movies.
// Ad cues the sites insert are removed. A background queue fills in a library slowly (one title every few seconds);
// anything with no match is asked again after a week. You can also add your own .srt from the item menu.
const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const plex = require('./plex.cjs');
const { readJson, writeJson } = require('./safefile.cjs');

const DIR = () => path.join(app.getPath('userData'), 'subs');
const INDEX = () => path.join(app.getPath('userData'), 'subs.json');
const RETRY_NONE = 7 * 24 * 3600 * 1000;
const GAP_MS = 4000; // between background lookups
const UA = 'TemporaryUserAgent'; // what OpenSubtitles' public REST search expects from apps without a key

let index = null; // { [guid]: { file, release, source, score, at } | { none: true, at } }
function load() {
  if (!index) index = readJson(INDEX()) || {};
  return index;
}
const save = () => writeJson(INDEX(), index);
const safeName = (guid) => guid.replace(/[^a-z0-9]+/gi, '_').slice(0, 120);

// --- what a file needs ------------------------------------------------------------------------------------------

const isEnglish = (s) => /^(en|eng)$/i.test(s.languageCode || s.languageTag || '') || /^english/i.test(s.language || '');
const partOf = (m) => m?.Media?.[0]?.Part?.[0];
// Only full English subtitles count: a file with just forced (foreign-parts) English subs still gets a full set.
const hasEnglish = (m) => (partOf(m)?.Stream || []).some((s) => s.streamType === 3 && isEnglish(s) && !s.forced);

// --- matching ---------------------------------------------------------------------------------------------------

// OpenSubtitles' fingerprint: file size + the 64-bit little-endian sum of the first and last 64 KB.
async function osdbHash(m) {
  const part = partOf(m);
  const size = part?.size;
  if (!size || size < 131072) return null;
  const { uri, token } = plex.getSession().server;
  const chunk = async (from) => {
    const r = await fetch(uri + part.key, { headers: { 'X-Plex-Token': token, Range: `bytes=${from}-${from + 65535}` }, signal: AbortSignal.timeout(20000) });
    if (r.status !== 206) throw new Error('no range support');
    return Buffer.from(await r.arrayBuffer());
  };
  const [head, tail] = await Promise.all([chunk(0), chunk(size - 65536)]);
  let h = BigInt(size);
  for (const b of [head, tail]) for (let i = 0; i + 8 <= b.length; i += 8) h = (h + b.readBigUInt64LE(i)) & 0xffffffffffffffffn;
  return { hash: h.toString(16).padStart(16, '0'), size };
}

const tokens = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\.(srt|mkv|mp4|m4v|avi)$/i, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const SOURCE = ['bluray', 'bdrip', 'brrip', 'remux', 'web', 'webrip', 'webdl', 'dl', 'hdtv', 'dvdrip', 'amzn', 'nf', 'dsnp', 'hmax', 'atvp', 'itunes'];
const RES = ['2160p', '1080p', '720p', '480p', '4k', 'uhd'];

// How well a subtitle's release name fits this file's name.
function scoreRelease(subName, fileName, fps, subFps) {
  const s = new Set(tokens(subName));
  const f = tokens(fileName);
  let score = 0;
  for (const t of f) {
    if (!s.has(t)) continue;
    score += RES.includes(t) ? 6 : SOURCE.includes(t) ? 10 : /^\d{4}$/.test(t) ? 1 : 3;
  }
  // The release group (after the last '-') is the strongest sign of the same encode.
  const group = String(fileName || '').replace(/\.[a-z0-9]{2,4}$/i, '').split('-').pop()?.toLowerCase();
  if (group && group.length > 1 && s.has(group)) score += 25;
  if (fps && subFps && Math.abs(fps - subFps) < 0.05) score += 12;
  else if (fps && subFps && subFps > 1) score -= 20; // a different frame rate drifts out of sync
  return score;
}

async function osSearch(q) {
  const r = await fetch(`https://rest.opensubtitles.org/search/${q}/sublanguageid-eng`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`OpenSubtitles ${r.status}`);
  const list = await r.json().catch(() => []);
  return Array.isArray(list) ? list.filter((x) => x.SubFormat === 'srt' && x.SubBad !== '1' && x.SubForeignPartsOnly !== '1' && x.SubAutoTranslation !== '1') : [];
}

// Lines the sites insert to advertise themselves.
const AD = /osdb\.link|opensubtitles|yts\.|yify|subscene|advertise your product|become vip|support us and become|api\.os|subtitles by|www\.[a-z0-9-]+\.(com|org|net|link|mx)/i;
function clean(srt) {
  const blocks = srt.replace(/^﻿/, '').replace(/\r/g, '').split(/\n{2,}/);
  const kept = blocks.filter((b) => !AD.test(b));
  return kept.map((b, i) => b.replace(/^\d+\n/, `${i + 1}\n`)).join('\n\n').trim() + '\n';
}

async function osDownload(x) {
  const r = await fetch(x.SubDownloadLink, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  let text;
  try {
    text = zlib.gunzipSync(buf).toString('utf8');
  } catch {
    text = buf.toString('utf8');
  }
  return clean(text);
}

// The smallest zip reader that works for one-file subtitle zips (stored or deflated).
function unzipFirstSrt(buf) {
  let i = 0;
  while (i + 30 < buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const csize = buf.readUInt32LE(i + 18);
    const nlen = buf.readUInt16LE(i + 26);
    const xlen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nlen).toString('utf8');
    const start = i + 30 + nlen + xlen;
    const data = buf.slice(start, start + csize);
    if (/\.srt$/i.test(name)) return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    i = start + csize;
  }
  return null;
}

async function ytsFind(imdb, fileName) {
  const page = await fetch(`https://yts-subs.com/movie-imdb/${imdb}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!page.ok) return null;
  const html = await page.text();
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]).filter((t) => />\s*English\s*</i.test(t));
  const cands = rows
    .map((t) => ({ href: t.match(/href="(\/subtitles\/[^"]+)"/)?.[1], name: t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }))
    .filter((c) => c.href)
    .map((c) => ({ ...c, score: scoreRelease(c.name, fileName) }))
    .sort((a, b) => b.score - a.score);
  if (!cands.length) return null;
  const best = cands[0];
  const zip = await fetch(`https://yts-subs.com${best.href.replace('/subtitles/', '/subtitle/')}.zip`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!zip.ok) return null;
  const text = unzipFirstSrt(Buffer.from(await zip.arrayBuffer()));
  return text ? { text: clean(text), release: best.name.slice(0, 160), score: best.score, source: 'yts-subs' } : null;
}

// Finds the best English subtitle for one item's metadata (with streams). Returns { text, release, score, source }.
async function findBest(m, show) {
  const fileName = path.basename(partOf(m)?.file || '');
  const v = (partOf(m)?.Stream || []).find((s) => s.streamType === 1);
  const fps = v?.frameRate;
  const ids = [...(m.Guid || []).map((g) => g.id)];
  const imdb = ids.map((id) => id.match(/^imdb:\/\/(tt\d+)/)?.[1]).find(Boolean);
  const showImdb = show && [...(show.Guid || []).map((g) => g.id)].map((id) => id.match(/^imdb:\/\/(tt\d+)/)?.[1]).find(Boolean);

  // 1. exact file fingerprint
  try {
    const h = await osdbHash(m);
    if (h) {
      const hits = (await osSearch(`moviebytesize-${h.size}/moviehash-${h.hash}`)).filter((x) => x.MatchedBy === 'moviehash');
      if (hits.length) {
        const best = hits.sort((a, b) => Number(a.SubHearingImpaired) - Number(b.SubHearingImpaired) || Number(b.SubDownloadsCnt) - Number(a.SubDownloadsCnt))[0];
        return { text: await osDownload(best), release: best.SubFileName, score: 1000, source: 'opensubtitles (exact file)' };
      }
    }
  } catch {}

  // 2. by id, ranked against the file name
  let list = [];
  if (m.type === 'episode') {
    if (imdb) list = await osSearch(`imdbid-${imdb.slice(2)}`).catch(() => []);
    if (!list.length && showImdb) list = await osSearch(`episode-${m.index}/imdbid-${showImdb.slice(2)}/season-${m.parentIndex}`).catch(() => []);
  } else if (imdb) list = await osSearch(`imdbid-${imdb.slice(2)}`).catch(() => []);
  if (list.length) {
    const ranked = list
      .map((x) => ({
        x,
        score:
          scoreRelease(x.SubFileName || x.MovieReleaseName, fileName, fps, Number(x.MovieFPS)) -
          (x.SubHearingImpaired === '1' ? 4 : 0) +
          Math.min(8, Math.log10(Number(x.SubDownloadsCnt) + 1) * 2) +
          (x.SubFromTrusted === '1' ? 3 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    return { text: await osDownload(best.x), release: best.x.SubFileName, score: Math.round(best.score), source: 'opensubtitles' };
  }

  // 3. movies: YTS-Subs
  if (m.type === 'movie' && imdb) return ytsFind(imdb, fileName).catch(() => null);
  return null;
}

// --- store ------------------------------------------------------------------------------------------------------

function storeText(guid, text, info) {
  fs.mkdirSync(DIR(), { recursive: true });
  const file = path.join(DIR(), `${safeName(guid)}.en.srt`);
  fs.writeFileSync(file + '.tmp', text);
  fs.renameSync(file + '.tmp', file);
  load()[guid] = { file: path.basename(file), ...info, at: Date.now() };
  save();
  return file;
}

// The subtitle file mpv should load for this item, or null.
function localFor(guid) {
  const e = guid && load()[guid];
  if (!e?.file) return null;
  const f = path.join(DIR(), e.file);
  return fs.existsSync(f) ? f : null;
}

const enabled = () => plex.getPrefs().player.autoSubs !== false;

// Makes sure one item has English subtitles if it can (used before playback and by the queue). Returns the file.
async function ensure(m) {
  if (!m?.guid || !['movie', 'episode'].includes(m.type)) return null;
  const have = localFor(m.guid);
  if (have || hasEnglish(m) || !enabled()) return have;
  const e = load()[m.guid];
  if (e?.none && Date.now() - e.at < RETRY_NONE) return null;
  let show = null;
  if (m.type === 'episode' && m.grandparentRatingKey) show = (await plex.pms(`/library/metadata/${m.grandparentRatingKey}?includeGuids=1`).catch(() => null))?.MediaContainer?.Metadata?.[0];
  const best = await findBest(m, show).catch(() => null);
  if (!best?.text || best.text.length < 200) {
    index[m.guid] = { none: true, at: Date.now() };
    save();
    return null;
  }
  return storeText(m.guid, best.text, { release: best.release, source: best.source, score: best.score, title: m.title });
}

// Background queue: ratingKeys from a library the viewer opened. Each is checked against Plex (one metadata call)
// and looked up only when it has no English subtitles and none are stored yet.
const queue = [];
const queued = new Set();
let running = false;
function enqueue(ratingKeys) {
  if (!enabled()) return { queued: 0 };
  for (const rk of ratingKeys || []) {
    const k = String(rk);
    if (!queued.has(k)) {
      queued.add(k);
      queue.push(k);
    }
  }
  run();
  return { queued: queue.length };
}
async function run() {
  if (running) return;
  running = true;
  try {
    while (queue.length && enabled()) {
      const rk = queue.shift();
      try {
        const r = await plex.pms(`/library/metadata/${rk}?includeGuids=1`);
        const m = r?.MediaContainer?.Metadata?.[0];
        const e = m?.guid && load()[m.guid];
        const skip = !m || localFor(m.guid) || hasEnglish(m) || (e?.none && Date.now() - e.at < RETRY_NONE);
        if (!skip) {
          await ensure(m);
          await new Promise((res) => setTimeout(res, GAP_MS));
        }
      } catch {}
    }
  } finally {
    running = false;
  }
}

// Item menu → "Add subtitle file…": your own .srt for this title (it replaces any found one).
async function importFor(win, meta) {
  if (!meta?.guid) throw new Error('This title has no Plex id to keep a subtitle for.');
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: `Subtitle file for ${meta.title}`,
    properties: ['openFile'],
    filters: [{ name: 'Subtitles', extensions: ['srt'] }],
  });
  if (canceled || !filePaths?.[0]) return { canceled: true };
  const text = fs.readFileSync(filePaths[0], 'utf8');
  if (!/-->/.test(text)) throw new Error("That file doesn't look like an .srt subtitle.");
  storeText(meta.guid, clean(text), { release: path.basename(filePaths[0]), source: 'your file', score: 1000, title: meta.title });
  return { ok: true, name: path.basename(filePaths[0]) };
}

// For the item menu and Settings.
function info(guid) {
  const e = guid && load()[guid];
  return e?.file ? { release: e.release, source: e.source, at: e.at } : null;
}
function status() {
  const all = Object.values(load());
  return { found: all.filter((e) => e.file).length, none: all.filter((e) => e.none).length, queued: queue.length, enabled: enabled() };
}
// Removes a stored subtitle so it's looked up again (for "Find another subtitle").
function forget(guid) {
  const e = load()[guid];
  if (e?.file) fs.rmSync(path.join(DIR(), e.file), { force: true });
  delete index[guid];
  save();
}

module.exports = { ensure, localFor, enqueue, importFor, info, status, forget, hasEnglish };
