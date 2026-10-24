// Vanta by soybean_alien
// Spotify, for the Music page. Sign-in is Spotify's own page in the browser (OAuth 2 Authorization Code with PKCE,
// so no client secret exists anywhere): Vanta listens once on http://127.0.0.1:43821/callback for the answer.
// The viewer brings a free Client ID from developer.spotify.com (Spotify requires each app to register one).
// Spotify doesn't let other apps stream its audio, so Vanta browses your music and plays it on one of your Spotify
// devices (the desktop app, a phone, a speaker) through Spotify Connect, which needs Spotify Premium.
// The Client ID and tokens are stored encrypted with safeStorage in spotify.bin and never reach the UI.
const { app, safeStorage, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = 43821;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  'user-read-private',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-recently-played',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

const file = () => path.join(app.getPath('userData'), 'spotify.bin');
let state; // { clientId, access, refresh, expires, user: { name, product } }

function load() {
  if (state === undefined) {
    try {
      state = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
    } catch {
      state = {};
    }
  }
  return state;
}
function save() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(state)));
}

const status = () => {
  const s = load();
  return { hasClientId: !!s.clientId, connected: !!s.refresh, user: s.user || null, redirect: REDIRECT };
};

function setClientId(id) {
  id = (id || '').trim();
  if (id && !/^[0-9a-f]{32}$/i.test(id)) throw new Error('A Spotify Client ID is 32 letters and numbers (Dashboard → your app → Settings).');
  load();
  // A new Client ID means a new app on Spotify's side, so the old sign-in no longer applies.
  state = id ? { clientId: id } : {};
  save();
  return status();
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: state.clientId, ...params }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.error || `Spotify sign-in failed (${res.status}).`);
  state.access = j.access_token;
  state.expires = Date.now() + (j.expires_in - 60) * 1000;
  if (j.refresh_token) state.refresh = j.refresh_token;
  save();
}

// Opens Spotify's sign-in page and waits (up to 5 minutes) for it to send the browser back to Vanta.
let pending = null;
function connect() {
  load();
  if (!state.clientId) throw new Error('Add your Spotify Client ID first.');
  if (pending) return pending;
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const nonce = b64url(crypto.randomBytes(16));
  pending = new Promise((resolve, reject) => {
    const page = (msg) =>
      `<!doctype html><meta charset="utf-8"><title>Vanta</title><body style="background:#0f1115;color:#e8eaee;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0"><div><h2 style="color:#e5a00d">Vanta</h2><p>${msg}</p></div>`;
    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/callback') return res.writeHead(404).end();
      const done = (ok, msg) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page(msg));
        server.close();
        clearTimeout(timer);
        ok ? resolve(status()) : reject(new Error(msg));
      };
      if (u.searchParams.get('state') !== nonce) return done(false, 'This sign-in link is out of date. Try Connect again in Vanta.');
      if (u.searchParams.get('error')) return done(false, `Spotify said: ${u.searchParams.get('error')}. You can close this tab.`);
      try {
        await token({ grant_type: 'authorization_code', code: u.searchParams.get('code'), redirect_uri: REDIRECT, code_verifier: verifier });
        const me = await api('/me');
        state.user = { name: me.display_name || me.id, product: me.product };
        save();
        done(true, 'Spotify is connected. You can close this tab and go back to Vanta.');
      } catch (e) {
        done(false, e.message);
      }
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Spotify sign-in timed out. Try Connect again.'));
    }, 5 * 60 * 1000);
    server.on('error', (e) => reject(new Error(e.code === 'EADDRINUSE' ? `Port ${PORT} is busy; close whatever uses it and try again.` : e.message)));
    server.listen(PORT, '127.0.0.1', () => {
      const q = new URLSearchParams({
        client_id: state.clientId,
        response_type: 'code',
        redirect_uri: REDIRECT,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        scope: SCOPES,
        state: nonce,
      });
      shell.openExternal(`https://accounts.spotify.com/authorize?${q}`);
    });
  }).finally(() => (pending = null));
  return pending;
}

function disconnect() {
  load();
  state = state.clientId ? { clientId: state.clientId } : {};
  save();
  return status();
}

// A Web API call with the saved sign-in, refreshing the access token when it runs out.
async function api(p, method = 'GET', body) {
  load();
  if (!state.refresh && !state.access) throw new Error('Spotify isn\'t connected. Connect it in Settings → Music.');
  if (!state.access || Date.now() > state.expires) await token({ grant_type: 'refresh_token', refresh_token: state.refresh });
  if (!/^\/(me|playlists|albums|browse)\b/.test(p)) throw new Error('Bad Spotify path.');
  const res = await fetch('https://api.spotify.com/v1' + p, {
    method,
    headers: { Authorization: `Bearer ${state.access}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 204 || res.status === 202) return {};
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) {
    state.access = null;
    save();
  }
  if (!res.ok) {
    const reason = j.error?.reason;
    if (reason === 'PREMIUM_REQUIRED') throw new Error('Playing on your devices needs Spotify Premium.');
    if (reason === 'NO_ACTIVE_DEVICE' || res.status === 404) throw new Error('No Spotify device is open. Open Spotify on this PC or your phone, then try again.');
    throw new Error(j.error?.message || `Spotify error ${res.status}`);
  }
  return j;
}

// What the Music page shows: your playlists, saved albums and recently played tracks.
async function library() {
  const [playlists, albums, recent] = await Promise.all([
    api('/me/playlists?limit=50'),
    api('/me/albums?limit=50'),
    api('/me/player/recently-played?limit=30').catch(() => ({ items: [] })),
  ]);
  const pic = (imgs) => imgs?.[1]?.url || imgs?.[0]?.url || null;
  const seen = new Set();
  return {
    playlists: (playlists.items || []).filter(Boolean).map((p) => ({ uri: p.uri, id: p.id, name: p.name, by: p.owner?.display_name, count: p.tracks?.total, image: pic(p.images) })),
    albums: (albums.items || []).map(({ album: a }) => ({ uri: a.uri, id: a.id, name: a.name, by: a.artists?.map((x) => x.name).join(', '), year: a.release_date?.slice(0, 4), image: pic(a.images) })),
    recent: (recent.items || [])
      .map(({ track: t }) => t)
      .filter((t) => t && !seen.has(t.id) && seen.add(t.id))
      .map((t) => ({ uri: t.uri, name: t.name, by: t.artists?.map((x) => x.name).join(', '), image: pic(t.album?.images), ms: t.duration_ms })),
  };
}

// Playlist names by id, so the player can say which playlist a song is playing from without asking every 5 s.
const playlistNames = new Map();
async function playlistName(uri) {
  const id = uri?.match(/^spotify:playlist:([A-Za-z0-9]+)$/)?.[1];
  if (!id) return null;
  if (!playlistNames.has(id)) {
    const p = await api(`/playlists/${id}?fields=name`).catch(() => null);
    if (!p?.name) return null;
    playlistNames.set(id, p.name);
  }
  return playlistNames.get(id);
}

async function nowPlaying() {
  const r = await api('/me/player');
  if (!r?.item) return { playing: false, device: r?.device?.name || null };
  const t = r.item;
  return {
    playing: !!r.is_playing,
    device: r.device?.name || null,
    name: t.name,
    by: t.artists?.map((x) => x.name).join(', '),
    album: t.album?.name,
    year: t.album?.release_date?.slice(0, 4) || null,
    image: t.album?.images?.[0]?.url || null,
    // Only when the song is playing as part of a playlist; an album, artist or single track has none.
    playlist: r.context?.type === 'playlist' ? await playlistName(r.context.uri) : null,
    progress: r.progress_ms,
    duration: t.duration_ms,
    at: Date.now(),
  };
}

const devices = () => api('/me/player/devices').then((r) => (r.devices || []).map((d) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active })));

// Plays a playlist/album (context) or a single track on the active device, or the first one found.
async function playUri(uri, deviceId) {
  if (!/^spotify:(playlist|album|track|artist):[A-Za-z0-9]+$/.test(uri || '')) throw new Error('Bad Spotify item.');
  if (!deviceId) {
    const list = await devices();
    deviceId = (list.find((d) => d.active) || list[0])?.id;
    if (!deviceId) throw new Error('No Spotify device is open. Open Spotify on this PC or your phone, then try again.');
  }
  const body = uri.startsWith('spotify:track:') ? { uris: [uri] } : { context_uri: uri };
  await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, 'PUT', body);
  return { ok: true };
}

async function control(action) {
  if (action === 'pause') await api('/me/player/pause', 'PUT');
  else if (action === 'resume') await api('/me/player/play', 'PUT');
  else if (action === 'next') await api('/me/player/next', 'POST');
  else if (action === 'previous') await api('/me/player/previous', 'POST');
  else throw new Error('Unknown action.');
  return { ok: true };
}

// For backups: the Client ID and the sign-in, so Spotify is connected on a new install too.
const backupState = () => (load().clientId ? { clientId: state.clientId, refresh: state.refresh || null, user: state.user || null } : null);
function restoreState(s) {
  if (!s?.clientId || !/^[0-9a-f]{32}$/i.test(s.clientId)) return;
  state = { clientId: s.clientId, ...(s.refresh ? { refresh: s.refresh } : {}), ...(s.user ? { user: s.user } : {}) };
  save();
}

module.exports = { status, setClientId, connect, disconnect, library, nowPlaying, devices, playUri, control, backupState, restoreState };
