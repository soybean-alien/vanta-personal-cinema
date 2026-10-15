// Vanta by soybean_alien
// The user's combined style: a wax-seal body with a neon glow around its edge, an enamel-pin disc (metal rim,
// glossy enamel, one shine) pressed into the middle, and the emblem drawn as neon tubing on that enamel.
// `node design/badge-styles/combo.mjs` writes combo.html; render with
//   node_modules/electron/dist/electron design/icons/render.cjs design/badge-styles/combo.html design/badge-styles/combo.png 1500
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SAMPLES } from './styles.mjs';

const EMBLEMS = {
  heart: 'M50 74 C26 58 22 43 29 34 C36 25 46 28 50 37 C54 28 64 25 71 34 C78 43 74 58 50 74Z',
  moon: 'M58 24 A27 27 0 1 0 77 63 A20 20 0 1 1 58 24Z',
  infinity: 'M50 50 C43 39 27 37 25 50 C27 63 43 61 50 50 C57 39 73 37 75 50 C73 63 57 61 50 50Z',
};

// Organic wax outline: a ring of radii with soft bulges, smoothed into a closed Catmull-Rom curve.
function waxPath(seed, cx, cy, r) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const n = 22;
  const p = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.94 + rnd() * 0.1) + (i % 4 === 0 ? r * 0.05 * rnd() : 0);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1.map((v) => v.toFixed(1)).join(' ')} ${c2.map((v) => v.toFixed(1)).join(' ')} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// enamel: 'color' = glossy rarity-colored enamel, 'deep' = dark rarity enamel so the neon pops harder.
export function comboSvg(b, uid, { enamel = 'color', tails = true } = {}) {
  const id = (k) => `${uid}${k}`;
  const cy = tails ? 94 : 100;
  const wax = waxPath(b.id.length * 7919 + 13, 100, cy, 78);
  const em = `translate(${100 - 50 * 0.78} ${cy - 50 * 0.78}) scale(0.78)`;
  const enamelFill = enamel === 'deep' ? `url(#${id('d')})` : `url(#${id('e')})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>
<radialGradient id="${id('w')}" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="${b.c.light}"/><stop offset=".45" stop-color="${b.c.base}"/><stop offset="1" stop-color="${b.c.dark}"/></radialGradient>
<linearGradient id="${id('m')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d6"/><stop offset=".45" stop-color="#d2ab55"/><stop offset="1" stop-color="#7a5a1a"/></linearGradient>
<radialGradient id="${id('e')}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${b.c.base}"/><stop offset="1" stop-color="${b.c.dark}"/></radialGradient>
<radialGradient id="${id('d')}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${b.c.dark}"/><stop offset="1" stop-color="${b.c.ink}"/></radialGradient>
<filter id="${id('g')}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="${id('t')}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2"/></filter>
<clipPath id="${id('c')}"><circle cx="100" cy="${cy}" r="44"/></clipPath>
</defs>
${tails ? `<path d="M80 150 L66 194 L83 183 L92 196 L100 158Z" fill="${b.c.dark}"/><path d="M120 150 L134 194 L117 183 L108 196 L100 158Z" fill="${b.c.dark}"/>` : ''}
<path d="${wax}" fill="none" stroke="${b.c.base}" stroke-width="9" filter="url(#${id('g')})" opacity=".95"/>
<path d="${wax}" fill="url(#${id('w')})"/>
<path d="${wax}" fill="none" stroke="${b.c.light}" stroke-width="1.6" stroke-opacity=".9"/>
<circle cx="100" cy="${cy}" r="60" fill="${b.c.dark}" opacity=".45"/>
<circle cx="100" cy="${cy}" r="58" fill="none" stroke="${b.c.light}" stroke-opacity=".35" stroke-width="2"/>
<circle cx="100" cy="${cy + 2.5}" r="52" fill="#000" opacity=".35"/>
<circle cx="100" cy="${cy}" r="52" fill="url(#${id('m')})"/>
<circle cx="100" cy="${cy}" r="45" fill="${enamelFill}"/>
<g filter="url(#${id('t')})"><path transform="${em}" d="${EMBLEMS[b.emblem]}" fill="none" stroke="${b.c.light}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/></g>
<path transform="${em}" d="${EMBLEMS[b.emblem]}" fill="none" stroke="${b.c.light}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
<path transform="${em}" d="${EMBLEMS[b.emblem]}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
<g clip-path="url(#${id('c')})"><path d="M${100 - 40} ${cy - 8} A44 44 0 0 1 ${100 + 6} ${cy - 42}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="7" stroke-linecap="round"/></g>
</svg>`;
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const VARIANTS = [
  { key: 'A', title: 'A · Color enamel', note: 'Glossy enamel in the badge’s rarity color, with the emblem glowing as neon on top.', opt: { enamel: 'color', tails: true } },
  { key: 'B', title: 'B · Deep enamel', note: 'Darker enamel in the rarity color, so the neon emblem stands out more.', opt: { enamel: 'deep', tails: true } },
  { key: 'C', title: 'C · Deep enamel, no ribbons', note: 'Same as B without the ribbon tails. A rounder shape that reads better at small sizes.', opt: { enamel: 'deep', tails: false } },
];
const rows = VARIANTS.map((v) => {
  const big = SAMPLES.map((b) => `<figure><div class="art">${comboSvg(b, `${v.key}${b.id.replace(/\W/g, '')}`, v.opt)}</div><figcaption style="color:${b.c.light}">${b.name}</figcaption></figure>`).join('');
  const small = SAMPLES.map((b) => `<div class="sm">${comboSvg(b, `${v.key}s${b.id.replace(/\W/g, '')}`, v.opt)}</div>`).join('');
  return `<div class="card"><div class="head"><b>${v.title}</b><span>${v.note}</span></div><div class="row">${big}<div class="smalls"><div class="lbl">Sidebar size</div><div class="smrow">${small}</div></div></div></div>`;
}).join('\n');

fs.writeFileSync(
  path.join(dir, 'combo.html'),
  `<!doctype html><html><head><meta charset="utf-8"><title>Vanta badge style: wax + enamel + neon</title><style>
body{margin:0;padding:30px 38px 36px;background:#0f1115;color:#e8eaee;font-family:'Segoe UI',system-ui,sans-serif}
h1{margin:0 0 4px;font-size:26px}h1 span{color:#e5a00d}.sub{color:#8a91a0;margin-bottom:18px;font-size:14px}
.card{background:#161920;border:1px solid #262a33;border-radius:14px;padding:14px 20px;margin-bottom:16px}
.head{display:flex;gap:14px;align-items:baseline;font-size:17px;margin-bottom:4px}.head span{color:#8a91a0;font-size:13px}
.row{display:flex;align-items:center;gap:28px}figure{margin:0;text-align:center}.art svg{width:200px;height:200px;display:block}
figcaption{font-size:13px;font-weight:600}.smalls{margin-left:auto;text-align:center}.lbl{color:#8a91a0;font-size:12px;margin-bottom:6px}
.smrow{display:flex;gap:10px}.sm svg{width:46px;height:46px;display:block}
</style></head><body><h1><span>Vanta</span> · wax seal + enamel + neon</h1>
<div class="sub">Wax-seal body with a neon glow around the edge, an enamel-pin disc in the middle, and the emblem drawn as neon tubing. Shown for Patron, Night Owl and Marathoner.</div>
${rows}</body></html>`,
);
console.log('combo.html written');
