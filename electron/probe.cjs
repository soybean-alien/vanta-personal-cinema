// Vanta by soybean_alien
// https://github.com/soybean-alien/vanta-personal-cinema · GPL-3.0
//
// File details for titles Plex never analyzed (no video/audio/subtitle streams in its metadata). Vanta's own mpv
// opens the file from the server without a window or sound, decodes one frame, and reports the tracks; nothing is
// changed on the server. Answers are cached on this PC per file (part id + size), so each file is read once.
const { app } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plex = require('./plex.cjs');
const { findMpv } = require('./player.cjs');

const CACHE = path.join(app.getPath('userData'), 'file-probe-cache.json');
let cache;
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

// Runs inside mpv: gathers the track list once the file is open, the pixel format once a frame is decoded, and
// writes them as JSON when mpv quits.
const SCRIPT = `
local utils = require 'mp.utils'
local out = mp.get_opt('vanta-probe-out')
local info = {}
mp.register_event('file-loaded', function()
  info.tracks = mp.get_property_native('track-list')
  info.duration = mp.get_property_native('duration')
end)
mp.observe_property('video-params', 'native', function(_, v)
  if v and v.pixelformat then info.pixelformat = v.pixelformat end
end)
mp.register_event('shutdown', function()
  local f = io.open(out, 'w')
  if f then f:write(utils.format_json(info)) f:close() end
end)
`;

function runMpv(url, token) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanta-probe-'));
  const script = path.join(dir, 'probe.lua');
  const out = path.join(dir, 'out.json');
  fs.writeFileSync(script, SCRIPT);
  const args = [
    '--no-config',
    '--vo=null',
    '--ao=null',
    '--frames=1',
    '--really-quiet',
    '--ytdl=no',
    `--script=${script}`,
    `--script-opts=vanta-probe-out=${out}`,
    `--http-header-fields=X-Plex-Token: ${token}`,
    url,
  ];
  return new Promise((resolve) => {
    const proc = spawn(findMpv(), args, { stdio: 'ignore', windowsHide: true });
    const timer = setTimeout(() => proc.kill(), 45000);
    proc.on('error', () => {});
    proc.on('close', () => {
      clearTimeout(timer);
      let info = null;
      try {
        info = JSON.parse(fs.readFileSync(out, 'utf8'));
      } catch {}
      fs.rm(dir, { recursive: true, force: true }, () => {});
      resolve(info);
    });
  });
}

// mpv's codec names → the names Plex uses, so the details page labels them the same way.
const CODEC = { dts: 'dca', subrip: 'srt', 'hdmv_pgs_subtitle': 'pgs', 'dvd_subtitle': 'vobsub' };
const langNames = new Intl.DisplayNames(['en'], { type: 'language' });
const language = (code) => {
  if (!code || code === 'und') return null;
  try {
    return langNames.of(code);
  } catch {
    return code;
  }
};
const tierOf = (w, h) => (w >= 3200 || h >= 1800 ? '4k' : w >= 1700 || h >= 1000 ? '1080' : w >= 1200 || h >= 700 ? '720' : 'sd');

// mpv's report → Plex-shaped Media (with Part.Stream), the same shape the details page already reads.
function toMedia(info, part) {
  const tracks = info?.tracks || [];
  const v = tracks.find((t) => t.type === 'video' && !t.image && !t.albumart);
  if (!v && !tracks.some((t) => t.type === 'audio')) return null;
  const container = (path.extname(part.key || part.file || '').slice(1) || '').toLowerCase() || undefined;
  const bitDepth = Number((/(\d+)(le|be)?$/.exec(info.pixelformat || '') || [])[1]) || (info.pixelformat ? 8 : undefined);
  const w = v?.['demux-w'];
  const h = v?.['demux-h'];
  const streams = [];
  if (v) {
    const res = tierOf(w || 0, h || 0);
    streams.push({
      streamType: 1,
      codec: CODEC[v.codec] || v.codec,
      bitDepth,
      width: w,
      height: h,
      frameRate: v['demux-fps'],
      displayTitle: `${res === '4k' ? '4K' : res === 'sd' ? 'SD' : `${res}p`} (${String(CODEC[v.codec] || v.codec).toUpperCase()})`,
    });
  }
  for (const t of tracks.filter((t) => t.type === 'audio')) {
    const ch = t['demux-channel-count'];
    const chName = ch === 8 ? '7.1' : ch === 6 ? '5.1' : ch === 2 ? 'Stereo' : ch === 1 ? 'Mono' : ch ? `${ch} ch` : '';
    const lang = language(t.lang);
    streams.push({
      streamType: 2,
      codec: CODEC[t.codec] || t.codec,
      channels: ch,
      language: lang,
      default: !!t.default,
      selected: !!t.default,
      title: t.title,
      displayTitle: `${lang || 'Unknown'} (${String(CODEC[t.codec] || t.codec).toUpperCase()}${chName ? ` ${chName}` : ''})`,
    });
  }
  for (const t of tracks.filter((t) => t.type === 'sub')) {
    const lang = language(t.lang);
    streams.push({
      streamType: 3,
      codec: CODEC[t.codec] || t.codec,
      language: lang,
      forced: !!t.forced,
      hearingImpaired: !!t['hearing-impaired'],
      selected: !!t.default,
      displayTitle: `${lang || 'Unknown'} (${String(CODEC[t.codec] || t.codec).toUpperCase()})`,
    });
  }
  return {
    width: w,
    height: h,
    container,
    videoCodec: v ? CODEC[v.codec] || v.codec : undefined,
    audioCodec: streams.find((s) => s.streamType === 2)?.codec,
    Part: [{ ...part, container, Stream: streams }],
    probed: true,
  };
}

const running = new Map();

// The title's Media list with file details filled in from the file itself, or null when Plex already has them.
async function fileDetails(ratingKey) {
  const meta = await plex.pms(`/library/metadata/${encodeURIComponent(ratingKey)}`);
  const m = meta?.MediaContainer?.Metadata?.[0];
  const media = m?.Media || [];
  if (!media.length || media.every((x) => x.Part?.[0]?.Stream?.length)) return null;
  const c = load();
  const out = [];
  for (const x of media) {
    const part = x.Part?.[0];
    if (!part || part.Stream?.length) {
      out.push(x);
      continue;
    }
    const id = `${part.id}:${part.size || 0}`;
    if (!c[id]) {
      if (!running.has(id)) {
        const { uri, token } = plex.getSession().server;
        running.set(
          id,
          runMpv(uri + part.key, token).finally(() => running.delete(id)),
        );
      }
      const info = await running.get(id);
      // A file mpv can't open either (damaged or incomplete) is remembered as unreadable, with what its name tells.
      const container = (path.extname(part.key || part.file || '').slice(1) || '').toLowerCase() || undefined;
      c[id] = toMedia(info, part) || { container, unreadable: true, Part: [{ container, Stream: [] }] };
      fs.writeFile(CACHE, JSON.stringify(c), () => {});
    }
    out.push({ ...x, ...c[id], Part: [{ ...part, ...c[id].Part[0], size: part.size }] });
  }
  return out;
}

module.exports = { fileDetails };
