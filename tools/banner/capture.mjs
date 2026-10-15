// Vanta by soybean_alien
// Captures the banner's app art from demo mode (sample data): the Badges page window (badges.png), the real badge
// medallions as SVG (badge-<id>.svg) and an unlock ticket (ticket.png), all drawn by the app's own code.
// Usage: npm run build && node tools/banner/capture.mjs   (then render banner.html, see its header)
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const PORT = 9342;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
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

await sleep(2500);
await js(`[...document.querySelectorAll('.settings-btn')].find(b => b.innerText.includes('Badges')).click()`);
await sleep(900);
await js(`document.head.insertAdjacentHTML('beforeend', '<style>* { scrollbar-width: none !important; }</style>')`);
await sleep(300);
fs.writeFileSync(path.join(here, 'badges.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

// Medallions, straight from the cards (earned art; the catalog order).
const arts = await js(`[...document.querySelectorAll('.view:not(.behind) .badge-card.earned')].map(c => [c.querySelector('.badge-name').innerText, c.querySelector('.badge-art').outerHTML])`);
for (const [name, svg] of arts) {
  const out = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/width="\d+" height="\d+"/, 'width="400" height="400"');
  fs.writeFileSync(path.join(here, `badge-${name.toLowerCase().replace(/\W+/g, '-')}.svg`), out);
}

// The unlock ticket, rasterized by the same code the player overlay uses (BGRA premultiplied -> RGBA PNG).
const ticket = await js(`window.__vantaTicketBGRA('six-pack', Date.now(), 0, 1240)`);
const raw = Buffer.from(ticket.b64, 'base64');
const png = new PNG({ width: ticket.w, height: ticket.h });
for (let i = 0; i < ticket.w * ticket.h; i++) {
  const a = raw[i * 4 + 3];
  const un = (v) => (a ? Math.min(255, Math.round((v * 255) / a)) : 0);
  png.data[i * 4] = un(raw[i * 4 + 2]);
  png.data[i * 4 + 1] = un(raw[i * 4 + 1]);
  png.data[i * 4 + 2] = un(raw[i * 4]);
  png.data[i * 4 + 3] = a;
}
fs.writeFileSync(path.join(here, 'ticket.png'), PNG.sync.write(png));
console.log(`wrote badges.png, ticket.png and ${arts.length} badge SVGs`);
ws.close();
app.kill();
