// Vanta by soybean_alien
// Talks to plex.tv (sign-in, server discovery) and to the Plex Media Server.
// The auth token never leaves the main process; it is stored encrypted with Electron safeStorage.
const { app, safeStorage, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const safefile = require('./safefile.cjs');

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

async function probe(uri, token) {
  const res = await fetch(uri + '/identity', { headers: headers(token), signal: AbortSignal.timeout(3000) });
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
  let token = loadToken();
  if (!token) return { state: 'signedOut' };

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
async function image(thumbPath, w, h) {
  if (!session) return new Response(null, { status: 503 });
  const q = new URLSearchParams({ width: w, height: h, minSize: '1', upscale: '1', url: thumbPath });
  return fetch(`${session.server.uri}/photo/:/transcode?${q}`, { headers: headers(session.server.token) });
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

module.exports = {
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
