// Vanta by soybean_alien
// Builds the badge style gallery (gallery.html) from styles.mjs. Render to PNG with:
//   node_modules/electron/dist/electron design/icons/render.cjs design/badge-styles/gallery.html design/badge-styles/gallery.png 1500
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STYLES, SAMPLES } from './styles.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const cards = STYLES.map((s, i) => {
  const n = String(i + 1).padStart(2, '0');
  const art = SAMPLES.map(
    (b) => `<figure><div class="art">${s.draw(b, `s${n}${b.id.replace(/\W/g, '')}`)}</div><figcaption style="color:${b.c.light}">${b.name}</figcaption></figure>`,
  ).join('');
  return `<div class="card"><div class="head"><span class="num">${n}</span><b>${s.name}</b></div><div class="row">${art}</div><p>${s.note}</p></div>`;
}).join('\n');

fs.writeFileSync(
  path.join(dir, 'gallery.html'),
  `<!doctype html><html><head><meta charset="utf-8"><title>Vanta badge styles</title><style>
body{margin:0;padding:34px 38px 44px;background:#0f1115;color:#e8eaee;font-family:'Segoe UI',system-ui,sans-serif}
h1{margin:0 0 4px;font-size:28px}h1 span{color:#e5a00d}.sub{color:#8a91a0;margin-bottom:22px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{background:#161920;border:1px solid #262a33;border-radius:14px;padding:14px 16px}
.head{display:flex;gap:10px;align-items:center;font-size:16px;margin-bottom:6px}.num{color:#e5a00d;font-weight:700}
.row{display:flex;justify-content:space-around}figure{margin:0;text-align:center}.art svg{width:118px;height:118px;display:block}
figcaption{font-size:12px;font-weight:600;margin-top:2px}p{color:#8a91a0;font-size:12.5px;line-height:1.4;margin:8px 0 0}
</style></head><body><h1><span>Vanta</span> · badge styles</h1>
<div class="sub">15 original treatments, each shown for Patron (golden), Night Owl (Rare) and Marathoner (Epic). The chosen style is the badge you earn, pin and see on the unlock ticket.</div>
<div class="grid">${cards}</div></body></html>`,
);
console.log(`${STYLES.length} styles written`);
