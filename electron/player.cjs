// Vanta by soybean_alien
// Direct-plays media in mpv and reports progress back to Plex so resume points and watched state sync.
// One mpv window per session: when an episode or queue item ends, the next one is loaded into the same window.
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const plex = require('./plex.cjs');

const PIPE = '\\\\.\\pipe\\vanta-mpv';
const REPORT_EVERY_MS = 10000;

function findMpv() {
  // Installed builds ship their own mpv in resources/mpv; dev runs fall back to a system install.
  const candidates = [
    process.env.MPV_PATH,
    process.resourcesPath && path.join(process.resourcesPath, 'mpv', 'mpv.exe'),
    'C:\\Program Files\\MPV Player\\mpv.exe',
    'C:\\Program Files\\mpv\\mpv.exe',
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || 'mpv';
}

// Plex stores language preferences as names here; mpv matches on the file's ISO 639 track tags.
const LANGS = {
  english: 'eng,en',
  japanese: 'jpn,ja',
  spanish: 'spa,es',
  french: 'fre,fra,fr',
  german: 'ger,deu,de',
  italian: 'ita,it',
  korean: 'kor,ko',
  chinese: 'chi,zho,zh',
  portuguese: 'por,pt',
  russian: 'rus,ru',
  hindi: 'hin,hi',
};

const QUALITY = {
  default: [],
  hq: ['--profile=high-quality'],
  sharp: ['--profile=high-quality', '--scale=ewa_lanczossharp', '--cscale=ewa_lanczossharp'],
};

// mpv-side controller bindings (Xbox layout). The app UI has its own mapping while mpv isn't running.
const BINDINGS = [
  ['GAMEPAD_ACTION_DOWN', 'cycle pause'], // A
  ['GAMEPAD_ACTION_RIGHT', 'quit'], // B
  ['GAMEPAD_ACTION_LEFT', 'cycle sub'], // X
  ['GAMEPAD_ACTION_UP', 'script-message vanta skip'], // Y
  ['GAMEPAD_DPAD_LEFT', 'seek -10'],
  ['GAMEPAD_DPAD_RIGHT', 'seek 30'],
  ['GAMEPAD_DPAD_UP', 'cycle audio'],
  ['GAMEPAD_DPAD_DOWN', 'show-progress'],
  ['GAMEPAD_LEFT_SHOULDER', 'add chapter -1'],
  ['GAMEPAD_RIGHT_SHOULDER', 'add chapter 1'],
  ['GAMEPAD_LEFT_TRIGGER', 'add volume -5'],
  ['GAMEPAD_RIGHT_TRIGGER', 'add volume 5'],
  ['GAMEPAD_START', 'show-progress'], // Menu
  ['GAMEPAD_BACK', 'cycle fullscreen'], // View
  ['s', 'script-message vanta skip'],
  ['n', 'script-message vanta next'],
];

function buildArgs(prefs) {
  const p = prefs.player;
  const args = ['--keep-open=yes', '--input-gamepad=yes', `--input-ipc-server=${PIPE}`];
  if (p.fullscreen) args.push('--fs');
  if (p.hwdec) args.push('--hwdec=auto-safe');
  if (LANGS[p.audioLang]) args.push(`--alang=${LANGS[p.audioLang]}`);
  const slang = LANGS[p.subLang] || LANGS.english;
  if (p.subMode === 'off') args.push('--sid=no');
  else {
    args.push(`--slang=${slang}`);
    // smart: only forced subs when the audio is already in your language, full subs otherwise.
    args.push(`--subs-with-matching-audio=${p.subMode === 'always' ? 'yes' : 'forced'}`);
  }
  args.push(...(QUALITY[p.quality] || []));
  if (p.smoothMotion) args.push('--video-sync=display-resample', '--interpolation');
  const shaders = (p.shaders || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  if (shaders.length) args.push(`--glsl-shaders=${shaders.join(';')}`);
  for (const line of (p.extraArgs || '').split('\n')) {
    if (line.trim().startsWith('--')) args.push(line.trim());
  }
  return args;
}

async function resolve(ratingKey) {
  const meta = await plex.pms(`/library/metadata/${ratingKey}?includeMarkers=1`);
  const m = meta.MediaContainer.Metadata[0];
  const part = m.Media?.[0]?.Part?.[0];
  if (!part) throw new Error(`"${m.title}" has no playable file.`);
  const { uri } = plex.getSession().server;
  const title =
    m.type === 'episode'
      ? `${m.grandparentTitle} - S${m.parentIndex}E${m.index} - ${m.title}`
      : `${m.title}${m.year ? ` (${m.year})` : ''}`;
  const marker = (type) => {
    const x = (m.Marker || []).find((k) => k.type === type);
    return x ? { start: x.startTimeOffset / 1000, end: x.endTimeOffset / 1000 } : null;
  };
  return {
    ratingKey: String(m.ratingKey),
    m,
    title,
    url: uri + part.key,
    // Sidecar subtitle files (.srt etc.) stored next to the media on the server.
    subs: (part.Stream || []).filter((s) => s.streamType === 3 && s.key).map((s) => uri + s.key),
    intro: marker('intro'),
    credits: marker('credits'),
  };
}

let current = null;

function send(c, ...command) {
  if (c.sock && !c.sock.destroyed) c.sock.write(JSON.stringify({ command }) + '\n');
}

async function timeline(state, c, it = c.item) {
  const q = new URLSearchParams({
    ratingKey: it.ratingKey,
    key: `/library/metadata/${it.ratingKey}`,
    state,
    time: String(Math.round(c.time * 1000)),
    duration: String(Math.round(c.duration * 1000)),
  });
  try {
    await plex.pms(`/:/timeline?${q}`);
  } catch (e) {
    console.warn('timeline report failed:', e.message);
  }
}

// Report the finished/stopped item, marking it watched when 90%+ was seen.
async function finishItem(c) {
  const it = c.item;
  await timeline('stopped', c, it);
  if (c.duration && c.time / c.duration >= 0.9) {
    try {
      await plex.pms(`/:/scrobble?key=${it.ratingKey}&identifier=com.plexapp.plugins.library`);
    } catch {}
  }
}

// Next item: the explicit queue (playlist / collection / play-all) if any, otherwise the next episode of the show.
async function findNext(c) {
  if (c.queue) {
    const i = c.queueIndex + 1;
    return i < c.queue.length ? { ratingKey: c.queue[i], queueIndex: i } : null;
  }
  if (c.item.m.type !== 'episode') return null;
  const leaves = await plex.pms(`/library/metadata/${c.item.m.grandparentRatingKey}/allLeaves`);
  const list = leaves.MediaContainer.Metadata || [];
  const i = list.findIndex((x) => String(x.ratingKey) === c.item.ratingKey);
  return i >= 0 && i + 1 < list.length ? { ratingKey: String(list[i + 1].ratingKey) } : null;
}

async function loadInto(c, next) {
  const it = await resolve(next.ratingKey);
  if (c.exited) return;
  c.item = it;
  if (next.queueIndex != null) c.queueIndex = next.queueIndex;
  c.time = 0;
  c.duration = (it.m.duration || 0) / 1000;
  c.ended = false;
  c.introShown = c.creditsShown = c.introSkipped = false;
  c.nextCache = undefined;
  c.pendingSubs = it.subs;
  send(c, 'set_property', 'force-media-title', it.title);
  send(c, 'set_property', 'start', it.m.viewOffset ? String(it.m.viewOffset / 1000) : 'none');
  send(c, 'loadfile', it.url, 'replace');
  c.events.onState({ playing: true, ratingKey: it.ratingKey, title: it.title });
}

async function goNext(c, { countdown } = {}) {
  if (c.advancing) {
    c.skipCountdown = true; // Y/N during the up-next countdown starts the next item now
    return;
  }
  c.advancing = true;
  c.skipCountdown = false;
  try {
    const next = c.nextCache !== undefined ? c.nextCache : await findNext(c);
    await finishItem(c);
    c.events.onState({ playing: true, refresh: true, ratingKey: c.item.ratingKey, title: c.item.title });
    if (!next) {
      send(c, 'quit');
      return;
    }
    if (countdown) {
      const nextTitle = (await resolve(next.ratingKey)).title;
      for (let s = countdown; s > 0; s--) {
        if (c.exited || !c.ended) return; // user quit, or sought back into the video
        if (c.skipCountdown) break;
        send(c, 'show-text', `Up next in ${s}s: ${nextTitle}\nPress Q or B to stop`, 1100);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (c.exited || !c.ended) return;
    }
    await loadInto(c, next);
  } catch (e) {
    console.warn('advance failed:', e.message);
    send(c, 'quit');
  } finally {
    c.advancing = false;
  }
}

function onTime(c) {
  const t = c.time;
  const skip = c.prefs.player.skipIntro;
  const { intro, credits } = c.item;
  if (intro && t >= intro.start && t < intro.end - 1 && !c.introSkipped) {
    if (skip === 'auto') {
      c.introSkipped = true;
      send(c, 'seek', intro.end, 'absolute');
      send(c, 'show-text', 'Intro skipped', 1500);
    } else if (skip === 'button' && !c.introShown) {
      c.introShown = true;
      send(c, 'show-text', 'Skip intro: press S or Y', Math.min(8000, (intro.end - t) * 1000));
    }
  }
  if (credits && t >= credits.start && !c.creditsShown && c.prefs.player.autoplay) {
    c.creditsShown = true;
    findNext(c)
      .then((n) => {
        c.nextCache = n;
        if (n) send(c, 'show-text', 'Next episode: press N or Y', 6000);
      })
      .catch(() => {});
  }
}

function onSkip(c) {
  const { intro, credits } = c.item;
  if (intro && c.time >= intro.start - 1 && c.time < intro.end) {
    c.introSkipped = true;
    send(c, 'seek', intro.end, 'absolute');
  } else if ((credits && c.time >= credits.start) || c.ended) {
    goNext(c);
  }
}

function attachIpc(c) {
  let tries = 0;
  const tryConnect = () => {
    const sock = net.connect(PIPE);
    let buf = '';
    sock.on('connect', () => {
      c.sock = sock;
      ['time-pos', 'duration', 'pause', 'eof-reached'].forEach((prop, i) => send(c, 'observe_property', i + 1, prop));
      for (const [key, cmd] of BINDINGS) send(c, 'keybind', key, cmd);
    });
    sock.on('data', (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        handle(c, msg);
      }
    });
    sock.on('error', () => {
      if (!c.sock && ++tries < 50 && !c.exited) setTimeout(tryConnect, 150);
    });
  };
  tryConnect();
}

function handle(c, msg) {
  if (msg.event === 'file-loaded') {
    for (const s of c.pendingSubs || []) send(c, 'sub-add', s, 'auto');
    c.pendingSubs = null;
    return;
  }
  if (msg.event === 'client-message' && msg.args?.[0] === 'vanta') {
    if (msg.args[1] === 'skip') onSkip(c);
    if (msg.args[1] === 'next') goNext(c);
    return;
  }
  if (msg.event !== 'property-change' || msg.data == null) return;
  if (msg.name === 'time-pos') {
    c.time = msg.data;
    onTime(c);
  } else if (msg.name === 'duration') {
    c.duration = msg.data;
    // duration only becomes known once a file is loaded, which covers loads that beat the IPC connection
    for (const s of c.pendingSubs || []) send(c, 'sub-add', s, 'auto');
    c.pendingSubs = null;
  }
  else if (msg.name === 'pause' && msg.data !== c.paused) {
    c.paused = msg.data;
    if (!c.ended) timeline(c.paused ? 'paused' : 'playing', c);
  } else if (msg.name === 'eof-reached') {
    c.ended = msg.data === true;
    if (!c.ended) return;
    c.time = c.duration || c.time;
    if (c.prefs.player.autoplay) goNext(c, { countdown: c.prefs.player.countdown || 5 });
    else finishItem(c).then(() => send(c, 'quit'));
  }
}

function stop() {
  if (current) {
    try {
      current.proc.kill();
    } catch {}
  }
}

// opts: { queue?: string[], queueIndex?: number, fromStart?: boolean }
async function play(ratingKey, opts, events) {
  stop();
  const prefs = plex.getPrefs();
  let queue = opts.queue && opts.queue.length ? opts.queue.map(String) : null;
  let queueIndex = queue ? opts.queueIndex || 0 : 0;
  if (queue && opts.shuffle) {
    queue = [...queue].sort(() => Math.random() - 0.5);
    queueIndex = 0;
  }
  const item = await resolve(queue ? queue[queueIndex] : ratingKey);
  const { token } = plex.getSession().server;

  const args = [
    ...buildArgs(prefs),
    `--http-header-fields=X-Plex-Token: ${token}`,
    `--force-media-title=${item.title}`,
  ];
  if (item.m.viewOffset && !opts.fromStart) args.push(`--start=${(item.m.viewOffset / 1000).toFixed(1)}`);
  args.push(item.url);

  const proc = spawn(findMpv(), args, { stdio: 'ignore' });
  const c = {
    proc,
    prefs,
    events,
    item,
    queue,
    queueIndex,
    pendingSubs: item.subs,
    time: (opts.fromStart ? 0 : item.m.viewOffset || 0) / 1000,
    duration: (item.m.duration || 0) / 1000,
    paused: false,
  };
  current = c;
  events.onState({ playing: true, ratingKey: item.ratingKey, title: item.title });

  proc.on('error', (e) => {
    c.exited = true;
    events.onState({ playing: false, error: `Could not start mpv: ${e.message}` });
  });
  proc.on('exit', async () => {
    c.exited = true;
    clearInterval(c.timer);
    if (current === c) current = null;
    if (!c.advancing) await finishItem(c);
    events.onState({ playing: false, refresh: true });
  });

  attachIpc(c);
  c.timer = setInterval(() => {
    if (!c.exited && !c.ended) timeline(c.paused ? 'paused' : 'playing', c);
  }, REPORT_EVERY_MS);
  return { ok: true, title: item.title };
}

module.exports = { play, stop };
