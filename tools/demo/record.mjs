// Vanta by soybean_alien
// Re-records the README media from the real app running in demo mode (public-domain films and their posters):
//   docs/demo.gif, docs/screenshot-movies.png, docs/screenshot-genres.png, docs/screenshot-connection.png,
//   docs/screenshot-badges.png, docs/screenshot-ticket.png, tools/banner/app.png
// Usage: npm run build && node tools/demo/record.mjs
// It launches Electron with --demo and a debug port, then drives the UI over the Chrome DevTools Protocol.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const docs = path.join(root, 'docs');
const PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(docs, { recursive: true });

// ── launch + CDP plumbing ──────────────────────────────────────────────
const electron = path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const app = spawn(electron, ['.', '--demo', '--record', `--remote-debugging-port=${PORT}`], { cwd: root, stdio: 'ignore' });
let targets;
for (let i = 0; i < 40 && !targets; i++) {
  await sleep(250);
  targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => null);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (pending.has(d.id)) pending.get(d.id)(d.result), pending.delete(d.id);
});
const send = (method, params = {}) => new Promise((r) => (pending.set(++id, r), ws.send(JSON.stringify({ id, method, params }))));
const js = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).then((r) => r.result?.value);
const png = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
const VK = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Enter: 13, Escape: 27 };
const key = async (k) => {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: VK[k] });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: VK[k] });
};
const sel = (s) => JSON.stringify(s);
const click = (s) => js(`document.querySelector(${sel(s)}).click()`);
const clickText = (s, text) => js(`[...document.querySelectorAll(${sel(s)})].find(e => e.innerText.includes(${sel(text)})).click()`);
const dismiss = (s) => js(`document.querySelector(${sel(s)})?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);

// ── GIF frames ─────────────────────────────────────────────────────────
const frames = [];
const frame = async (delay) => frames.push({ png: await png(), delay });

await sleep(2500); // fonts + posters

// Screenshots for the README
fs.writeFileSync(path.join(docs, 'screenshot-movies.png'), await png());
// The same view without scrollbars, for the banner's app window.
await js(`document.head.insertAdjacentHTML('beforeend', '<style id="noscroll">* { scrollbar-width: none !important; }</style>')`);
await sleep(200);
fs.writeFileSync(path.join(root, 'tools', 'banner', 'app.png'), await png());
await js(`document.getElementById('noscroll').remove()`);
await clickText('.view:not(.behind) .choice', 'Genre');
await sleep(500);
fs.writeFileSync(path.join(docs, 'screenshot-genres.png'), await png());
await dismiss('.menu-backdrop');
await click('.status');
await sleep(700);
fs.writeFileSync(path.join(docs, 'screenshot-connection.png'), await png());
await dismiss('.modal-backdrop');
await sleep(400);
// Badges: the page, and an unlock ticket drawn by the same code the player overlay uses (premultiplied BGRA -> PNG).
await clickText('.settings-btn', 'Badges');
await sleep(900);
fs.writeFileSync(path.join(docs, 'screenshot-badges.png'), await png());
const t = await js(`window.__vantaTicketBGRA('six-pack', Date.now(), 0, 1240)`);
const raw = Buffer.from(t.b64, 'base64');
const tp = new PNG({ width: t.w, height: t.h });
for (let i = 0; i < t.w * t.h; i++) {
  const a = raw[i * 4 + 3];
  const un = (v) => (a ? Math.min(255, Math.round((v * 255) / a)) : 0);
  tp.data.set([un(raw[i * 4 + 2]), un(raw[i * 4 + 1]), un(raw[i * 4]), a], i * 4);
}
fs.writeFileSync(path.join(docs, 'screenshot-ticket.png'), PNG.sync.write(tp));
await clickText('.sidebar nav button', 'Movies');
await sleep(900);
console.log('wrote 5 screenshots');

// The tour: badges page → an unlock ticket → library (resolution tags) → keyboard focus → detail → genre filter →
// random → second library → collection → search → status → settings
await clickText('.settings-btn', 'Badges');
await sleep(900);
await frame(1800);
await js(`document.querySelector('.view:not(.behind)').scrollTo({ top: 330, behavior: 'instant' })`);
await sleep(400);
await frame(1300);
await js(`window.__vantaDemoUnlock(['six-pack'])`);
await sleep(1500);
await frame(2600);
await js(`document.querySelector('.view:not(.behind)').scrollTo({ top: 0, behavior: 'instant' })`);
await clickText('.sidebar nav button', 'Movies');
await sleep(900);
await frame(1600);
await key('ArrowRight');
await frame(600);
await key('ArrowRight');
await frame(450);
await key('ArrowRight');
await frame(450);
await key('ArrowDown');
await frame(700);
await key('Enter');
await sleep(600);
await frame(1700);
await key('Escape');
await sleep(300);
await frame(600);
await clickText('.view:not(.behind) .choice', 'Genre');
await sleep(400);
await frame(1100);
await clickText('.menu button', 'Horror');
await sleep(700);
await frame(1200);
await clickText('.view:not(.behind) .tool', 'Random');
await sleep(600);
await frame(1700);
await dismiss('.modal-backdrop');
await clickText('.view:not(.behind) .tool', 'Clear filters');
await clickText('.sidebar nav button', 'Silent Classics');
await sleep(900);
await frame(1300);
await clickText('.view:not(.behind) .grid .poster', 'Metropolis');
await sleep(900);
await frame(1600);
await key('Escape');
await clickText('.view:not(.behind) .tool', 'Collections');
await sleep(900);
await frame(1200);
await clickText('.view:not(.behind) .poster', 'Buster Keaton');
await sleep(900);
await frame(1500);
await js(`document.querySelector('.search').focus()`);
await send('Input.insertText', { text: 'night' });
await sleep(900);
await frame(1600);
await click('.status');
await sleep(700);
await frame(1800);
await dismiss('.modal-backdrop');
await click('.settings-btn');
await sleep(700);
await frame(1600);
await js(`document.querySelector('.view:not(.behind)').scrollTo({ top: 520 })`);
await sleep(400);
await frame(1300);
await js(`(() => { const i = document.querySelector('.search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await clickText('.sidebar nav button', 'Movies');
await sleep(900);
await frame(1400);

ws.close();
app.kill();

// ── encode ─────────────────────────────────────────────────────────────
// --frames <dir> also saves each frame as a PNG for checking.
const framesDir = process.argv.includes('--frames') ? process.argv[process.argv.indexOf('--frames') + 1] : null;
if (framesDir) frames.forEach((f, i) => fs.writeFileSync(path.join(framesDir, `frame-${String(i + 1).padStart(2, '0')}.png`), f.png));
const gif = GIFEncoder();
for (const f of frames) {
  const { width, height, data } = PNG.sync.read(f.png);
  const palette = quantize(data, 256);
  gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: f.delay });
}
gif.finish();
fs.writeFileSync(path.join(docs, 'demo.gif'), gif.bytes());
console.log(`wrote docs/demo.gif (${frames.length} frames, ${(frames.reduce((s, f) => s + f.delay, 0) / 1000).toFixed(1)} s, ${(gif.bytes().length / 1e6).toFixed(1)} MB)`);
