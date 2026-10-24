// Vanta by soybean_alien
// Trakt: sign in once with "Connect Trakt" and Vanta keeps your Trakt history in step with what you watch.
//  - Sign-in is Trakt's device sign-in (a short code you enter at trakt.tv/activate) with PKCE: Vanta's Trakt app
//    has no client secret at all (Trakt issues PKCE-only apps), so nothing secret ships in Vanta and nobody pastes a key.
//  - The only thing kept on this PC is the sign-in Trakt hands back (access + refresh token), encrypted with
//    safeStorage in trakt-auth.bin, so you stay signed in. Disconnect revokes it and deletes the file.
//  - Live: whatever Vanta marks watched (80% in the player, or Mark watched) is added to your Trakt history; Mark
//    unwatched removes it. "Sync now" sends your Plex watch history to Trakt and copies Trakt's dates into Vanta's
//    watch log (history.cjs). It never changes watched status in Plex.
// The same public client id also powers the Trakt score on the details page, with no key needed.
const { app, safeStorage, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const plex = require('./plex.cjs');
const history = require('./history.cjs');

// Vanta's Trakt app (trakt.tv/oauth/applications). A client id is public by design, like an app's username.
// Empty until the app is registered; Trakt features stay hidden while it is.
const CLIENT_ID = 'XWsBInrMHwndwazVO9LHp9Ze7zAP77EpjVJCy2StJy0';
// The https redirect registered with the app. Device sign-in never uses it, but token refreshes send it.
const REDIRECT = 'https://github.com/soybean-alien/vanta-personal-cinema';
const API = 'https://api.trakt.tv';
// Trakt's firewall turns away requests without a User-Agent naming the app.
const JSON_HEADERS = { 'Content-Type': 'application/json', 'User-Agent': `Vanta/${app.getVersion()} (+https://github.com/soybean-alien/vanta-personal-cinema)` };

const file = () => path.join(app.getPath('userData'), 'trakt-auth.bin');
let auth; // { access, refresh, expires, user: { username, name } }

function load() {
  if (auth === undefined) {
    try {
      auth = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
    } catch {
      auth = null;
    }
  }
  return auth;
}
function save() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(auth)));
}

const available = () => !!CLIENT_ID;
const status = () => ({ available: available(), connected: !!load()?.refresh, user: load()?.user || null, autoSync: plex.getPrefs().ui.traktAutoSync !== false, lastSync: plex.getMeta('traktLastSync') || null });

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function tokenRequest(body) {
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ client_id: CLIENT_ID, redirect_uri: REDIRECT, ...body }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.error || `Trakt sign-in failed (${res.status}).`);
  auth = { ...(auth || {}), access: j.access_token, refresh: j.refresh_token || auth?.refresh, expires: Date.now() + (j.expires_in - 300) * 1000 };
  save();
}

// A Trakt API call. Public calls (scores) need only the client id; signed-in calls refresh the token as needed.
async function call(p, { method = 'GET', body, signedIn = true } = {}) {
  if (!available()) throw new Error('Trakt isn’t set up in this version of Vanta.');
  const headers = { ...JSON_HEADERS, 'trakt-api-version': '2', 'trakt-api-key': CLIENT_ID };
  if (signedIn) {
    if (!load()?.refresh) throw new Error('Connect Trakt first (Settings → Trakt).');
    if (!auth.access || Date.now() > auth.expires) await tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refresh });
    headers.Authorization = `Bearer ${auth.access}`;
  }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * Number(res.headers.get('retry-after') || attempt + 1)));
      continue;
    }
    if (res.status === 401 && signedIn) throw new Error('Trakt signed you out. Connect Trakt again in Settings.');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Trakt error ${res.status}`);
    return res.status === 204 ? {} : res.json();
  }
}

// Device sign-in, like on a TV: Vanta asks Trakt for a short code, you enter it at trakt.tv/activate, and Vanta
// polls until you approve. PKCE (code_challenge here, code_verifier when polling) stands in for a client secret.
// No redirect address and nothing listening on this PC (Trakt only accepts https redirects).
let device = null; // { code, verifier, interval, until }
async function startConnect() {
  if (!available()) throw new Error('Trakt isn’t set up in this version of Vanta.');
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const res = await fetch(`${API}/oauth/device/code`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ client_id: CLIENT_ID, code_challenge: challenge, code_challenge_method: 'S256' }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.device_code) throw new Error(j.error_description || `Trakt couldn’t start sign-in (${res.status}).`);
  device = { code: j.device_code, verifier, interval: (j.interval || 5) * 1000, until: Date.now() + (j.expires_in || 600) * 1000 };
  const url = j.verification_url || 'https://trakt.tv/activate';
  shell.openExternal(url);
  return { userCode: j.user_code, url, expiresIn: j.expires_in || 600 };
}

// Waits for the code to be approved. Trakt answers 400 while it's pending, 429 to slow down, 418 when denied,
// 410 when it expired and 409 when it was already used.
async function waitConnect() {
  const d = device;
  if (!d) throw new Error('Click Connect Trakt to get a code first.');
  while (device === d && Date.now() < d.until) {
    await new Promise((r) => setTimeout(r, d.interval));
    if (device !== d) break;
    const res = await fetch(`${API}/oauth/device/token`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ code: d.code, client_id: CLIENT_ID, code_verifier: d.verifier }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!res || res.status === 400) continue;
    if (res.status === 429) {
      d.interval += 2000;
      continue;
    }
    device = null;
    if (res.status === 418) throw new Error('Sign-in was declined on Trakt.');
    if (res.status === 410 || res.status === 404) throw new Error('That code expired. Click Connect Trakt for a new one.');
    if (res.status === 409) throw new Error('That code was already used. Click Connect Trakt for a new one.');
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) throw new Error(`Trakt sign-in failed (${res.status}).`);
    auth = { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in - 300) * 1000 };
    save();
    const me = await call('/users/settings');
    auth.user = { username: me?.user?.username, name: me?.user?.name || me?.user?.username };
    save();
    return status();
  }
  const cancelled = device !== d;
  if (!cancelled) device = null;
  throw new Error(cancelled ? 'Sign-in was cancelled.' : 'That code expired. Click Connect Trakt for a new one.');
}

const cancelConnect = () => {
  device = null;
  return status();
};
async function disconnect() {
  if (load()?.access && available()) {
    await fetch(`${API}/oauth/revoke`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ token: auth.access, client_id: CLIENT_ID }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  }
  auth = null;
  fs.rmSync(file(), { force: true });
  return status();
}

// --- ids --------------------------------------------------------------------------------------------------------

// Plex's Guid list -> Trakt ids. Episodes carry their own imdb/tmdb/tvdb ids in the new Plex agent.
function idsOf(m) {
  const out = {};
  for (const g of m?.Guid || []) {
    const [, kind, id] = String(g.id).match(/^(imdb|tmdb|tvdb):\/\/(.+)$/) || [];
    if (kind) out[kind] = kind === 'imdb' ? id : Number(id);
  }
  return out;
}

// --- live updates -----------------------------------------------------------------------------------------------

const live = () => available() && !!load()?.refresh && plex.getPrefs().ui.traktAutoSync !== false;

// A title Vanta just marked watched: add it to Trakt's history (best effort, never blocks playback).
async function watched(m, at = Date.now()) {
  if (!live() || !m) return { skipped: !m ? 'no item' : 'not connected or turned off' };
  const ids = idsOf(m);
  if (!Object.keys(ids).length) return { skipped: 'no IMDb/TMDB/TVDB id' };
  const entry = { watched_at: new Date(at).toISOString(), ids };
  const body = m.type === 'episode' ? { episodes: [entry] } : m.type === 'movie' ? { movies: [entry] } : null;
  // Never throws (playback must not care), but returns what happened for the UI and for testing.
  if (body) return call('/sync/history', { method: 'POST', body }).catch((e) => ({ error: e.message }));
}

// Mark unwatched: take it out of Trakt's history too.
async function unwatched(m) {
  if (!live() || !m) return { skipped: !m ? 'no item' : 'not connected or turned off' };
  const ids = idsOf(m);
  if (!Object.keys(ids).length) return { skipped: 'no IMDb/TMDB/TVDB id' };
  const body = m.type === 'episode' ? { episodes: [{ ids }] } : m.type === 'movie' ? { movies: [{ ids }] } : null;
  if (body) return call('/sync/history/remove', { method: 'POST', body }).catch((e) => ({ error: e.message }));
}

// --- full sync --------------------------------------------------------------------------------------------------

let syncing = null;
function sync() {
  if (!syncing) syncing = runSync().finally(() => (syncing = null));
  return syncing;
}

async function runSync() {
  const key = (ids) => ['imdb', 'tmdb', 'tvdb'].filter((k) => ids[k] != null).map((k) => `${k}:${ids[k]}`);
  const sections = (await plex.pms('/library/sections')).MediaContainer.Directory || [];
  const movies = [];
  const shows = [];
  const episodes = [];
  for (const s of sections) {
    const get = (type) => plex.pms(`/library/sections/${s.key}/all?type=${type}&includeGuids=1`).then((r) => r.MediaContainer.Metadata || []);
    if (s.type === 'movie') movies.push(...(await get(1)));
    if (s.type === 'show') {
      shows.push(...(await get(2)));
      episodes.push(...(await get(4)));
    }
  }

  // Indexes from Trakt-style ids to Plex items.
  const movieBy = new Map();
  for (const m of movies) for (const k of key(idsOf(m))) movieBy.set(k, m);
  const showBy = new Map();
  for (const s of shows) for (const k of key(idsOf(s))) showBy.set(k, s);
  const epBy = new Map(); // `${showRatingKey}:${season}:${episode}` -> episode
  for (const e of episodes) epBy.set(`${e.grandparentRatingKey}:${e.parentIndex}:${e.index}`, e);

  // 1. Pull: Trakt's watched movies and episodes -> Vanta's watch log (newer dates win).
  const fromTrakt = {};
  const onTrakt = new Set(); // Plex ratingKeys Trakt already has as watched (not pushed again)
  let pulled = 0;
  const tm = (await call('/sync/watched/movies')) || [];
  for (const w of tm) {
    const m = key(w.movie?.ids || {}).map((k) => movieBy.get(k)).find(Boolean);
    if (m) onTrakt.add(m.ratingKey);
    if (!m?.guid || !w.last_watched_at) continue;
    fromTrakt[m.guid] = { at: Date.parse(w.last_watched_at), title: m.title, type: 'movie' };
    pulled++;
  }
  const ts = (await call('/sync/watched/shows')) || [];
  for (const w of ts) {
    const show = key(w.show?.ids || {}).map((k) => showBy.get(k)).find(Boolean);
    if (!show) continue;
    for (const season of w.seasons || [])
      for (const ep of season.episodes || []) {
        const e = epBy.get(`${show.ratingKey}:${season.number}:${ep.number}`);
        if (!e) continue;
        onTrakt.add(e.ratingKey);
        if (e.guid && ep.last_watched_at) {
          fromTrakt[e.guid] = { at: Date.parse(ep.last_watched_at), title: e.title, type: 'episode' };
          pulled++;
        }
      }
  }
  history.merge(fromTrakt);

  // 2. Push: what Plex says you've watched that Trakt doesn't have yet, with Plex's own dates.
  const entry = (i) => ({ watched_at: new Date((i.lastViewedAt || Date.now() / 1000) * 1000).toISOString(), ids: idsOf(i) });
  const pushMovies = movies.filter((m) => m.viewCount && !onTrakt.has(m.ratingKey) && Object.keys(idsOf(m)).length).map(entry);
  const pushEpisodes = episodes.filter((e) => e.viewCount && !onTrakt.has(e.ratingKey) && Object.keys(idsOf(e)).length).map(entry);
  let pushed = 0;
  let notFound = 0;
  for (let i = 0; i < Math.max(pushMovies.length, pushEpisodes.length); i += 200) {
    const r = await call('/sync/history', { method: 'POST', body: { movies: pushMovies.slice(i, i + 200), episodes: pushEpisodes.slice(i, i + 200) } });
    pushed += (r?.added?.movies || 0) + (r?.added?.episodes || 0);
    notFound += (r?.not_found?.movies?.length || 0) + (r?.not_found?.episodes?.length || 0);
    await new Promise((res) => setTimeout(res, 1100)); // Trakt allows about one write a second
  }
  const result = { pulled, pushed, notFound, at: Date.now() };
  plex.setMeta('traktLastSync', result);
  return result;
}

// --- public score (details page) --------------------------------------------------------------------------------

async function rating(kind, imdb) {
  if (!available() || !imdb) return null;
  const r = await call(`/${kind === 'show' ? 'shows' : 'movies'}/${encodeURIComponent(imdb)}/ratings`, { signedIn: false });
  return r?.votes ? { value: r.rating, votes: r.votes } : null;
}

// For backups: the sign-in, so Trakt is connected on a new install too.
const backupState = () => (load()?.refresh ? { ...auth } : null);
function restoreState(s) {
  if (!s?.refresh) return;
  auth = { access: s.access || null, refresh: s.refresh, expires: s.expires || 0, user: s.user || null };
  save();
}

module.exports = { status, startConnect, waitConnect, cancelConnect, disconnect, sync, watched, unwatched, rating, available, backupState, restoreState };
