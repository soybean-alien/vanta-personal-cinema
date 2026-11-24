// Vanta by soybean_alien
// Talks to plex.tv (sign-in, server discovery) and to the Plex Media Server.
// The auth token never leaves the main process; it is stored encrypted with Electron safeStorage.
const { app, safeStorage, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const safefile = require('./safefile.cjs');
const posters = require('./posters.cjs');

const PRODUCT = 'Vanta';
const VERSION = require('../package.json').version;
// Optional Plex Home user to land on automatically ("preferredUser" in settings.json). Empty = stay on the signed-in account.
const preferredUser = () => (settings.preferredUser || '').trim();

let settings = {};
let session = null; // { user, server: { name, id, uri, token } }

const file = (name) => path.join(app.getPath('userData'), name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadSettings() {
  settings = safefile.readJson(file('settings.json')) || {}; // falls back to settings.json.bak if damaged
  if (!settings.clientId) {
    settings.clientId = crypto.randomUUID();
    saveSettings();
  }
}

function saveSettings() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  safefile.writeJson(file('settings.json'), settings); // crash-safe, keeps the previous version as .bak
}

const DEFAULT_PREFS = {
  player: {
    fullscreen: true,
    autoplay: true,
    countdown: 5,
    skipIntro: 'button', // off | button | auto
    audioLang: 'default',
    subLang: 'english',
    subMode: 'smart', // off | smart | always
    autoSubs: true, // find English subtitles for files without any (subtitles.cjs)
    hwdec: true,
    quality: 'default', // default | hq | sharp
    smoothMotion: false,
    shaders: '',
    extraArgs: '',
  },
  ui: {
    displayName: 'username', // username | title
    updates: 'ask', // auto | ask | manual
    badgesDuringPlayback: false, // off = hold badges for transitions / the library
    badgeSound: 'ember', // temple | dusk | hearth | lantern | harbor | ember | off
    brandLayout: 'tagline', // inline | stacked | corner | bold | tagline | gilded | seal | monogram | row
    hiddenLibs: [],
    showPlaylists: true,
    groupCollections: true, // fold each Plex collection's films into one folder poster in the movie grid
    officialCovers: true, // TMDB's main poster for every movie and show instead of Plex's (posters.cjs)
    traktAutoSync: true, // when Trakt is connected, send each watch to Trakt as it happens (trakt.cjs)
    pins: [],
  },
};

function getPrefs() {
  const p = settings.prefs || {};
  return {
    player: { ...DEFAULT_PREFS.player, ...p.player },
    ui: { ...DEFAULT_PREFS.ui, ...p.ui },
  };
}

// Small app-state values that aren't preferences (e.g. last run version for the updater).
const getMeta = (key) => settings.meta?.[key];
function setMeta(key, value) {
  settings.meta = { ...(settings.meta || {}), [key]: value };
  if (value === undefined) delete settings.meta[key];
  saveSettings();
}

function setPrefs(patch) {
  const cur = getPrefs();
  settings.prefs = {
    player: { ...cur.player, ...(patch.player || {}) },
    ui: { ...cur.ui, ...(patch.ui || {}) },
  };
  saveSettings();
  return getPrefs();
}

function saveToken(token) {
  fs.writeFileSync(file('auth.bin'), safeStorage.encryptString(token));
}

function loadToken() {
  try {
    return safeStorage.decryptString(fs.readFileSync(file('auth.bin')));
  } catch {
    return null;
  }
}

function clearToken() {
  try {
    fs.unlinkSync(file('auth.bin'));
  } catch {}
  clearSession();
}

// The last working server connection, kept encrypted in session.bin so the next start can skip the two plex.tv
// round trips (about a second) when the server still answers at the same address. plex.tv is asked afterwards.
const tokenTag = (token) => crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
function saveSession(token) {
  try {
    const data = { acct: tokenTag(token), pref: preferredUser(), session };
    fs.writeFileSync(file('session.bin'), safeStorage.encryptString(JSON.stringify(data)));
  } catch {}
}
function loadSession(token) {
  try {
    const d = JSON.parse(safeStorage.decryptString(fs.readFileSync(file('session.bin'))));
    return d.acct === tokenTag(token) && d.pref === preferredUser() && d.session?.server?.uri ? d.session : null;
  } catch {
    return null;
  }
}
function clearSession() {
  try {
    fs.unlinkSync(file('session.bin'));
  } catch {}
}

function headers(token) {
  const h = {
    Accept: 'application/json',
    'X-Plex-Product': PRODUCT,
    'X-Plex-Version': VERSION,
    'X-Plex-Client-Identifier': settings.clientId,
    'X-Plex-Platform': 'Windows',
    'X-Plex-Device': 'Windows',
    'X-Plex-Device-Name': os.hostname(),
  };
  if (token) h['X-Plex-Token'] = token;
  return h;
}

async function readJson(res, what) {
  if (!res.ok) {
    const err = new Error(`${what} -> HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function tv(method, p, token) {
  const res = await fetch('https://plex.tv' + p, {
    method,
    headers: headers(token),
    signal: AbortSignal.timeout(15000),
  });
  return readJson(res, `plex.tv ${p}`);
}

const sameUser = (u, name) =>
  [u.username, u.title, u.friendlyName].some((v) => v && v.toLowerCase() === name.toLowerCase());

// One-time sign-in: Plex PIN flow. The user approves in their browser; we never see the password.
async function signIn() {
  const pin = await tv('POST', '/api/v2/pins?strong=true');
  const q = new URLSearchParams({
    clientID: settings.clientId,
    code: pin.code,
    'context[device][product]': PRODUCT,
  });
  await shell.openExternal('https://app.plex.tv/auth#?' + q.toString());
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2000);
    const p = await tv('GET', `/api/v2/pins/${pin.id}`);
    if (p.authToken) {
      saveToken(p.authToken);
      return connect();
    }
  }
  throw new Error('Sign-in timed out. Try again.');
}

function signOut() {
  clearToken();
  session = null;
  return { state: 'signedOut' };
}

async function probe(uri, token, ms = 3000) {
  const res = await fetch(uri + '/identity', { headers: headers(token), signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`probe ${res.status}`);
  return uri;
}

// Route preference: secure LAN, plain-HTTP LAN, direct over the internet, then Plex Relay.
// Returns { uri, route } or null. The route feeds the connection-health indicator.
async function pickConnection(server) {
  const c = server.connections || [];
  const lan = c.filter((x) => x.local && !x.relay);
  const tiers = [
    ['lan', lan.map((x) => x.uri)],
    // Routers with DNS-rebinding protection refuse to resolve *.plex.direct names; the raw LAN IP over HTTP still works.
    ['lan-http', lan.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x.address || '')).map((x) => `http://${x.address}:${x.port}`)],
    ['remote', c.filter((x) => !x.local && !x.relay).map((x) => x.uri)],
    ['relay', c.filter((x) => x.relay).map((x) => x.uri)],
  ];
  for (const [route, uris] of tiers) {
    if (!uris.length) continue;
    try {
      return { uri: await Promise.any(uris.map((u) => probe(u, server.accessToken))), route };
    } catch {}
  }
  return null;
}

// Re-test every route to the current server (used when the active one stops answering).
async function reconnect() {
  if (!session) return false;
  const conn = await pickConnection(session.server.resource);
  if (!conn) return false;
  Object.assign(session.server, conn);
  return true;
}

async function connect() {
  const token = loadToken();
  if (!token) return { state: 'signedOut' };

  // Fast start: if the server still answers where it did last time, use that and check with plex.tv in the background.
  const cached = loadSession(token);
  if (cached) {
    try {
      await probe(cached.server.uri, cached.server.token, 1500);
      session = cached;
      fullConnect(token).catch((e) => console.warn('Background Plex refresh failed:', e.message));
      return { state: 'ready', user: session.user, server: { name: session.server.name } };
    } catch {}
  }
  return fullConnect(token);
}

async function fullConnect(token) {
  const accountToken = token;
  let user;
  try {
    user = await tv('GET', '/api/v2/user', token);
  } catch (e) {
    if (e.status === 401) return signOut();
    throw e;
  }

  // Plex Home: switch straight to the preferred user so there is no "who's watching" prompt.
  if (preferredUser() && !sameUser(user, preferredUser())) {
    try {
      const home = await tv('GET', '/api/v2/home/users', token);
      const target = (home.users || []).find((u) => sameUser(u, preferredUser()));
      if (target) {
        const switched = await tv('POST', `/api/v2/home/users/${target.uuid}/switch`, token);
        if (switched.authToken) {
          token = switched.authToken;
          user = switched;
        }
      }
    } catch (e) {
      console.warn('Home user switch failed, staying on account user:', e.message);
    }
  }

  const resources = await tv('GET', '/api/v2/resources?includeHttps=1&includeRelay=1', token);
  const servers = resources.filter((r) => (r.provides || '').split(',').includes('server'));
  if (!servers.length) throw new Error('No Plex Media Server found on this account.');
  const rank = (s) => (s.clientIdentifier === settings.serverId ? 2 : 0) + (s.owned ? 1 : 0);
  servers.sort((a, b) => rank(b) - rank(a));

  for (const s of servers) {
    const conn = await pickConnection(s);
    if (!conn) continue;
    session = {
      user: { name: user.title || user.username, username: user.username || user.title, thumb: user.thumb },
      server: {
        name: s.name,
        id: s.clientIdentifier,
        uri: conn.uri,
        route: conn.route,
        hasLan: (s.connections || []).some((x) => x.local && !x.relay),
        token: s.accessToken || token,
        resource: s,
      },
    };
    settings.serverId = s.clientIdentifier;
    saveSettings();
    saveSession(accountToken);
    return { state: 'ready', user: session.user, server: { name: s.name } };
  }
  throw new Error('Signed in, but your Plex server could not be reached. Is it on and on the same network?');
}

// GET/PUT a path on the connected Plex Media Server, returning parsed JSON.
async function pms(p, method = 'GET') {
  if (!session) throw new Error('Not connected to a server.');
  if (typeof p !== 'string' || !p.startsWith('/')) throw new Error('Bad server path.');
  const res = await fetch(session.server.uri + p, {
    method,
    headers: headers(session.server.token),
    signal: AbortSignal.timeout(20000),
  });
  return readJson(res, p);
}

// Resized artwork through the server's photo transcoder (served to the UI via the plximg: protocol).
function transcode(thumbPath, w, h) {
  const q = new URLSearchParams({ width: w, height: h, minSize: '1', upscale: '1', url: thumbPath });
  return fetch(`${session.server.uri}/photo/:/transcode?${q}`, { headers: headers(session.server.token) });
}

// Some selected posters and backdrops are files the server itself can no longer read (its transcoder answers 500).
// Then Vanta shows the first poster or backdrop Plex lists from an online source (TMDB and others) instead.
// Read-only: the artwork chosen in Plex is left as it is. The pick is remembered until the app restarts.
const altArt = new Map(); // thumb path -> Promise<url | null>
function altFor(id, kind) {
  return pms(`/library/metadata/${id}/${kind === 'art' ? 'arts' : 'posters'}`)
    .then((j) => (j.MediaContainer?.Metadata || []).find((p) => p.provider !== 'local' && /^https:\/\//.test(p.key || ''))?.key || null)
    .catch(() => null);
}
// TMDB serves ready-made sizes; anything else goes through the server's transcoder like normal artwork.
function fetchAlt(url, w, h) {
  if (posters.isWikimedia(url)) return posters.fetchPoster(url);
  const tmdbFile = /^https:\/\/image\.tmdb\.org\/t\/p\/[^/]+\/([^/?#]+)$/.exec(url);
  if (tmdbFile) return posters.fetchPoster(`https://image.tmdb.org/t/p/${Number(w) > 500 ? 'w780' : 'w500'}/${tmdbFile[1]}`);
  return transcode(url, w, h);
}

// Width and height of a JPEG or PNG, or null.
function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const mk = b[i + 1];
    if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += mk === 0x01 || (mk >= 0xd0 && mk <= 0xd8) ? 2 : 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

const metaOf = (id) => pms(`/library/metadata/${id}?includeGuids=1`).then((j) => j?.MediaContainer?.Metadata?.[0] || null, () => null);
// A movie or show Plex never matched has no poster, only a wide frame from the video: find a real one (posters.cjs).
async function posterFor(id) {
  const md = await metaOf(id);
  return md && (md.type === 'movie' || md.type === 'show') ? posters.findPoster(md) : null;
}
const officialArt = new Map(); // ratingKey -> Promise<url | null>

async function image(thumbPath, w, h) {
  if (/^https:\/\/image\.tmdb\.org\/t\/p\//.test(thumbPath)) return fetchAlt(thumbPath, w, h); // a TMDB collection poster
  if (!session) return new Response(null, { status: 503 });
  const known = altArt.get(thumbPath);
  if (known) {
    const url = await known;
    if (url) return fetchAlt(url, w, h);
  }
  const m = /^\/library\/metadata\/(\d+)\/(thumb|art)\//.exec(thumbPath);
  // Official release posters (Settings → Library): covers asked for in portrait slots, for movies and shows.
  const official = !known && m?.[2] === 'thumb' && Number(h) > Number(w) && getPrefs().ui.officialCovers !== false;
  if (official) {
    if (!officialArt.has(m[1])) officialArt.set(m[1], posters.official(m[1], () => metaOf(m[1])).catch(() => null));
    const url = await officialArt.get(m[1]);
    const alt = url && (await fetchAlt(url, w, h).catch(() => null));
    if (alt?.ok) return alt;
  }
  const res = await transcode(thumbPath, w, h);
  if (!m || known) return res;
  // A cover asked for in a portrait slot that comes back wide is a video frame, not a poster. Episode stills are
  // asked for in wide slots, so they never get here.
  if (res.ok) {
    if (m[2] !== 'thumb' || !(Number(h) > Number(w))) return res;
    const buf = Buffer.from(await res.arrayBuffer());
    const same = () => new Response(buf, { status: res.status, headers: res.headers });
    const size = imageSize(buf);
    if (!size || size.w <= size.h) return same();
    const pick = posterFor(m[1]).catch(() => null);
    altArt.set(thumbPath, pick);
    const url = await pick;
    const alt = url && (await fetchAlt(url, w, h).catch(() => null));
    return alt?.ok ? alt : same();
  }
  if (res.status < 500) return res;
  const pick = altFor(m[1], m[2]);
  altArt.set(thumbPath, pick);
  const url = await pick;
  if (!url) return res;
  const alt = await fetchAlt(url, w, h).catch(() => null);
  return alt?.ok ? alt : res;
}

// The signed-in user's Plex profile picture as a data: URL (badge tickets embed it; SVG-as-image can't load URLs).
let avatarCache = null;
async function avatar() {
  const thumb = session?.user?.thumb;
  if (!thumb || !/^https:\/\/([a-z0-9-]+\.)*plex\.tv\//i.test(thumb)) return null;
  if (avatarCache?.thumb === thumb) return avatarCache.data;
  const res = await fetch(thumb, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') || 'image/png';
  if (!type.startsWith('image/')) return null;
  const data = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  avatarCache = { thumb, data };
  return data;
}

// Delete a movie or episode for good: Plex removes it from the library and deletes its video files from the
// server's storage. Plex allows this only when the server's "Allow media deletion" setting is on (Settings →
// Library) and the signed-in user owns the server. Asked for from the "Are you sure?" dialog only.
async function deleteItem(ratingKey) {
  const rk = String(ratingKey || '');
  if (!/^\d+$/.test(rk)) throw new Error('Bad item.');
  const md = (await pms(`/library/metadata/${rk}`))?.MediaContainer?.Metadata?.[0];
  if (!md || (md.type !== 'movie' && md.type !== 'episode')) throw new Error('Only movies and episodes can be deleted.');
  try {
    await pms(`/library/metadata/${rk}`, 'DELETE');
  } catch (e) {
    if (e.status === 401 || e.status === 403)
      throw new Error('The Plex server refused. Turn on "Allow media deletion" in the server\'s Settings → Library (signed in as the server owner), then try again.');
    throw e;
  }
  return { ok: true };
}

// Whether the server allows deleting media (its "Allow media deletion" setting), or null when it can't be read.
async function canDelete() {
  const s = (await pms('/:/prefs').catch(() => null))?.MediaContainer?.Setting || [];
  const p = s.find((x) => x.id === 'allowMediaDeletion');
  return p ? p.value === true || p.value === '1' || p.value === 1 : null;
}

module.exports = {
  deleteItem,
  canDelete,
  loadSettings,
  avatar,
  signIn,
  signOut,
  connect,
  reconnect,
  pms,
  image,
  headers,
  getPrefs,
  getMeta,
  setMeta,
  setPrefs,
  getSession: () => session,
  // For backups (backup.cjs): the sign-in and the settings that make a new install match this one.
  // The device id (clientId) stays per install, so two PCs are never mistaken for one by Plex.
  backupState: () => ({ token: loadToken(), serverId: settings.serverId || null, preferredUser: settings.preferredUser || '' }),
  restoreState(s) {
    if (s?.token && typeof s.token === 'string') saveToken(s.token);
    if (s?.serverId) settings.serverId = s.serverId;
    if (s?.preferredUser) settings.preferredUser = s.preferredUser;
    saveSettings();
  },
};
