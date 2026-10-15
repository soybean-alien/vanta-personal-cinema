// Vanta by soybean_alien
// Writes every concept to svg/NN-name.svg and lays them out in gallery.html (big, plus 48/32/16 px on dark and light).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ICONS as FIRST } from './icons.mjs';
import { MORE } from './icons2.mjs';

const ICONS = [...FIRST, ...MORE];

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, 'svg');
fs.mkdirSync(out, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cards = [];
let group = '';
ICONS.forEach((icon, i) => {
  const n = String(i + 1).padStart(2, '0');
  const file = `${n}-${slug(icon.name)}.svg`;
  fs.writeFileSync(path.join(out, file), icon.draw(`i${n}`));
  if (icon.group !== group) {
    group = icon.group;
    cards.push(`<h2>${group}</h2>`);
  }
  const small = (bg) =>
    `<div class="strip ${bg}">${[48, 32, 16].map((s) => `<img src="svg/${file}" width="${s}" height="${s}">`).join('')}</div>`;
  cards.push(`<div class="card"><div class="num">${n}</div><img class="big" src="svg/${file}" width="150" height="150">
<div class="name">${icon.name}</div><div class="note">${icon.note}</div>${small('dark')}${small('light')}</div>`);
});

fs.writeFileSync(
  path.join(dir, 'gallery.html'),
  `<!doctype html><html><head><meta charset="utf-8"><title>Vanta icon concepts</title><style>
body{margin:0;padding:36px 40px 48px;background:#0b0c0f;color:#e8eaee;font-family:'Segoe UI',system-ui,sans-serif}
h1{margin:0 0 4px;font-size:30px;letter-spacing:.02em}h1 span{color:#e5a00d}
.sub{color:#8a91a0;margin-bottom:8px}
h2{grid-column:1/-1;margin:26px 0 0;font-size:15px;text-transform:uppercase;letter-spacing:.14em;color:#8a91a0;border-bottom:1px solid #22262e;padding-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:18px}
.card{position:relative;background:#14161b;border:1px solid #22262e;border-radius:14px;padding:16px 14px 14px;display:flex;flex-direction:column;align-items:center;text-align:center}
.num{position:absolute;top:10px;left:12px;font-weight:700;color:#e5a00d;font-size:15px}
.big{margin:8px 0 10px}
.name{font-weight:600;font-size:15px}
.note{color:#8a91a0;font-size:12px;line-height:1.4;margin:4px 0 10px;min-height:50px}
.strip{display:flex;gap:12px;align-items:center;justify-content:center;width:100%;padding:8px 0;border-radius:8px}
.strip.dark{background:#000}.strip.light{background:#e9eaec;margin-top:6px}
</style></head><body><h1><span>Vanta</span> · icon concepts</h1>
<div class="sub">Each card shows the icon large, then at 48, 32 and 16 px (taskbar and desktop sizes) on a black and a light background.</div>
<div class="grid">${cards.join('\n')}</div></body></html>`,
);
console.log(`${ICONS.length} icons written`);
