// Vanta by soybean_alien
// Connection health: is there a network, does the server answer (and how fast, over which route), is the internet up.
// Produces { level: 'good' | 'warn' | 'bad', title, detail, checks[] } for the sidebar status line.
const os = require('os');
const { execFile } = require('child_process');
const plex = require('./plex.cjs');

const POLL_MS = 15000;
const POLL_BAD_MS = 5000; // check faster while something is wrong, so recovery shows up quickly
const SLOW_MS = 250; // a LAN round trip slower than this is worth flagging
const HISTORY = 6;

// Adapters that stay "up" even with the cable pulled or Wi-Fi off, so they can't count as a real network.
const VIRTUAL = /vEthernet|VirtualBox|VMware|Hyper-V|WSL|Loopback|Bluetooth|Npcap|TAP-|Docker/i;

function adapters() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const a of addrs || []) {
      // 169.254.x.x is Windows' self-assigned address: the adapter is up but never got a real network.
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push({ name, address: a.address });
    }
  }
  return out;
}

function wifi() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) =>
    execFile('netsh', ['wlan', 'show', 'interfaces'], { timeout: 4000, windowsHide: true }, (err, out) => {
      if (err || !out) return resolve(null);
      const state = /^\s*State\s*:\s*(.+)$/im.exec(out)?.[1]?.trim();
      if (!state) return resolve(null);
      resolve({
        connected: /^connected/i.test(state),
        name: /^\s*Name\s*:\s*(.+)$/im.exec(out)?.[1]?.trim(),
        ssid: /^\s*SSID\s*:\s*(.+)$/im.exec(out)?.[1]?.trim(),
        signal: Number(/^\s*Signal\s*:\s*(\d+)%/im.exec(out)?.[1]) || null,
      });
    }),
  );
}

async function timed(url, headers, ms) {
  const t = performance.now();
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Math.round(performance.now() - t);
}

// Any HTTP answer from plex.tv means the internet works; only network errors count as down.
async function internetUp() {
  try {
    await fetch('https://plex.tv/api/v2/ping', { signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

const ROUTES = {
  lan: 'Local network (secure)',
  'lan-http': 'Local network (unencrypted)',
  remote: 'Over the internet',
  relay: 'Plex Relay',
};

let history = []; // recent server probe results (true = answered)
let latest = { level: 'warn', title: 'Checking connection…', detail: '', checks: [] };
let timer = null;
let listener = () => {};
let simulate = null; // dev-only override for screenshots/tests

async function check() {
  if (simulate) return publish(simulate);
  const s = plex.getSession();
  const [net, w, internet] = [adapters(), await wifi(), await internetUp()];
  const onWifi = !!w?.connected;
  // Adapters can be renamed (e.g. after a NIC brand), so anything real that isn't the Wi-Fi adapter counts as wired.
  const wired = net.some((a) => a.name !== w?.name && !/wi-?fi|wlan|wireless/i.test(a.name));

  let ms = null;
  if (s) {
    try {
      ms = await timed(s.server.uri + '/identity', plex.headers(s.server.token), 4000);
    } catch {
      // The active route stopped answering: try every route again before declaring it down.
      if (net.length && (await plex.reconnect().catch(() => false))) {
        try {
          ms = await timed(s.server.uri + '/identity', plex.headers(s.server.token), 4000);
        } catch {}
      }
    }
  }
  history = [...history, ms != null].slice(-HISTORY);
  const drops = history.filter((ok) => !ok).length;
  const route = s?.server.route;

  const checks = [];
  const warn = [];
  const bad = [];

  // Network
  if (!net.length) {
    checks.push({ label: 'Network', value: 'None', level: 'bad' });
    bad.push(['No network', 'No Wi-Fi or Ethernet connection. Check the cable or Wi-Fi.']);
  } else {
    // Windows routes over the wired link when both are up, so Ethernet wins.
    const kind = wired ? 'Ethernet' : onWifi ? `Wi-Fi${w.ssid ? ` · ${w.ssid}` : ''}${w.signal ? ` · ${w.signal}%` : ''}` : 'Connected';
    const weak = !wired && onWifi && w.signal != null && w.signal < 50;
    checks.push({ label: 'Network', value: kind, level: weak ? 'warn' : 'good' });
    if (weak) warn.push(['Weak Wi-Fi', `Wi-Fi signal is ${w.signal}%. Move closer to the router or use Ethernet.`]);
  }

  // Server
  if (ms == null) {
    checks.push({ label: 'Server', value: s ? `${s.server.name} · not responding` : 'Not connected', level: 'bad' });
    if (net.length)
      bad.push(
        internet
          ? ['Server offline', 'Your network is fine, but the Plex server isn’t answering. Is the server PC on and awake?']
          : ['No connection', 'Can’t reach the server or the internet. Check the router or Wi-Fi.'],
      );
  } else {
    const slow = ms > SLOW_MS && (route === 'lan' || route === 'lan-http');
    checks.push({ label: 'Server', value: `${s.server.name} · ${ms} ms`, level: slow ? 'warn' : 'good' });
    if (slow) warn.push(['Slow responses', `The server took ${ms} ms to answer over your LAN. The network or server is busy.`]);

    // Route
    const routeLevel = route === 'lan' ? 'good' : 'warn';
    checks.push({ label: 'Route', value: ROUTES[route] || route, level: routeLevel });
    if (route === 'lan-http')
      warn.push(['DNS blocked', 'Your router’s DNS blocks Plex’s secure addresses (DNS rebinding protection), so Vanta fell back to plain HTTP on your LAN.']);
    if (route === 'remote')
      warn.push([
        'Not using LAN',
        s.server.hasLan
          ? 'The server is being reached over the internet instead of your LAN. A firewall or a different subnet may be blocking the local path.'
          : 'The server is being reached over the internet.',
      ]);
    if (route === 'relay')
      warn.push(['Using Plex Relay', 'Direct routes are blocked (firewall or router), so traffic goes through Plex’s relay. Expect lower quality.']);

    // Stability
    checks.push({ label: 'Stability', value: `${history.length - drops}/${history.length} recent checks OK`, level: drops ? 'warn' : 'good' });
    if (drops) warn.push(['Unstable', `The server missed ${drops} of the last ${history.length} checks. The connection is dropping.`]);
  }

  // Internet
  checks.push({ label: 'Internet', value: internet ? 'Reachable' : 'Unreachable', level: internet ? 'good' : ms != null ? 'warn' : 'bad' });
  if (!internet && ms != null) warn.push(['Internet down', 'Local playback still works, but sign-in and plex.tv features may not.']);

  let h;
  if (bad.length) h = { level: 'bad', title: bad[0][0], detail: bad[0][1] };
  else if (warn.length) h = { level: 'warn', title: 'Connection degraded', detail: warn.map((x) => x[1]).join(' '), reason: warn[0][0] };
  else h = { level: 'good', title: 'Connected to Server', detail: `${ROUTES[route]} · ${ms} ms`, reason: `${route === 'lan' ? 'LAN' : ROUTES[route]} · ${ms} ms` };
  publish({ ...h, checks, at: Date.now() });
}

function publish(h) {
  latest = h;
  listener(h);
  clearTimeout(timer);
  timer = setTimeout(() => check().catch(() => {}), h.level === 'bad' ? POLL_BAD_MS : POLL_MS);
  return h;
}

module.exports = {
  start(onChange) {
    listener = onChange;
    check().catch(() => {});
  },
  now: () => check().then(() => latest),
  latest: () => latest,
  simulate(level) {
    const samples = {
      warn: {
        level: 'warn',
        title: 'Connection degraded',
        reason: 'Weak Wi-Fi',
        detail: 'Wi-Fi signal is 38%. Move closer to the router or use Ethernet.',
        checks: [
          { label: 'Network', value: 'Wi-Fi · HomeNet · 38%', level: 'warn' },
          { label: 'Server', value: 'Sample Server · 142 ms', level: 'good' },
          { label: 'Route', value: 'Local network (secure)', level: 'good' },
          { label: 'Stability', value: '5/6 recent checks OK', level: 'warn' },
          { label: 'Internet', value: 'Reachable', level: 'good' },
        ],
      },
      bad: {
        level: 'bad',
        title: 'No network',
        reason: 'Cable unplugged',
        detail: 'No Wi-Fi or Ethernet connection. Check the cable or Wi-Fi.',
        checks: [
          { label: 'Network', value: 'None', level: 'bad' },
          { label: 'Server', value: 'Sample Server · not responding', level: 'bad' },
          { label: 'Internet', value: 'Unreachable', level: 'bad' },
        ],
      },
    };
    // 'break' points the live session at a dead address to exercise the real failover path.
    if (level === 'break' && plex.getSession()) plex.getSession().server.uri = 'http://192.0.2.1:32400';
    simulate = samples[level] || null;
    return check().then(() => latest);
  },
};
