// Vanta by soybean_alien
// Badge STYLE exploration: 15 original badge treatments, each drawn for three sample badges
// (Patron golden, Night Owl rare blue, Marathoner epic purple). `node design/badge-styles/build.mjs`
// writes gallery.html; render with design/icons/render.cjs. The chosen style becomes the art used on the
// unlock ticket, the sidebar showcase and the Badges page.

export const SAMPLES = [
  { id: 'patron', name: 'Patron', c: { base: '#ff9a12', light: '#ffd27a', dark: '#a85700', ink: '#3a1d00' }, emblem: 'heart' },
  { id: 'night-owl', name: 'Night Owl', c: { base: '#3d6df2', light: '#a9c1ff', dark: '#1e3b8f', ink: '#0c1a44' }, emblem: 'moon' },
  { id: 'marathoner', name: 'Marathoner', c: { base: '#9a3df0', light: '#dcb8ff', dark: '#5a1d94', ink: '#2a0a4a' }, emblem: 'infinity' },
];

// Emblems in a 100x100 box centred on (50,50). `fill` mode paths are solid shapes; `stroke` mode are lines.
const EMBLEMS = {
  heart: { mode: 'fill', d: 'M50 74 C26 58 22 43 29 34 C36 25 46 28 50 37 C54 28 64 25 71 34 C78 43 74 58 50 74Z' },
  moon: { mode: 'fill', d: 'M58 24 A27 27 0 1 0 77 63 A20 20 0 1 1 58 24Z' },
  infinity: { mode: 'stroke', d: 'M50 50 C43 39 27 37 25 50 C27 63 43 61 50 50 C57 39 73 37 75 50 C73 63 57 61 50 50Z', w: 6 },
};
// Draw emblem `e` scaled by `s` around centre (cx, cy).
function emblem(key, cx, cy, s, color, { stroke = null, sw = null } = {}) {
  const e = EMBLEMS[key];
  const t = `translate(${cx - 50 * s} ${cy - 50 * s}) scale(${s})`;
  if (e.mode === 'stroke' || stroke) {
    const w = sw ?? e.w ?? 5;
    return `<path transform="${t}" d="${e.d}" fill="none" stroke="${stroke ?? color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<path transform="${t}" d="${e.d}" fill="${color}"/>`;
}
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${inner}</svg>`;
const polar = (r, deg, cx = 100, cy = 100) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export const STYLES = [
  {
    name: 'Rosette Medal',
    note: 'Today’s look: a scalloped metal rosette around a black face. Classic award, a little formal.',
    draw: (b, p) => {
      const ring = pts(Array.from({ length: 28 }, (_, i) => polar(i % 2 ? 84 : 94, (i / 28) * 360 - 90)));
      return svg(`<defs><linearGradient id="${p}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.c.light}"/><stop offset=".5" stop-color="${b.c.dark}"/><stop offset="1" stop-color="${b.c.light}"/></linearGradient>
<radialGradient id="${p}f" cx=".5" cy=".35"><stop offset="0" stop-color="#2a241a"/><stop offset="1" stop-color="#0b0906"/></radialGradient></defs>
<polygon points="${ring}" fill="url(#${p}r)"/><circle cx="100" cy="100" r="68" fill="url(#${p}f)" stroke="${b.c.dark}" stroke-width="3"/>${emblem(b.emblem, 100, 100, 1.05, b.c.light)}`);
    },
  },
  {
    name: 'Enamel Pin',
    note: 'A hard-enamel lapel pin: polished metal outline, flat glossy color, one shine. Feels collectible and pinnable.',
    draw: (b, p) =>
      svg(`<defs><linearGradient id="${p}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c9"/><stop offset=".5" stop-color="#c9a24a"/><stop offset="1" stop-color="#8a6a22"/></linearGradient></defs>
<circle cx="100" cy="104" r="80" fill="#000" opacity=".3"/>
<circle cx="100" cy="100" r="80" fill="url(#${p}m)"/><circle cx="100" cy="100" r="70" fill="${b.c.base}"/>
<circle cx="100" cy="100" r="58" fill="none" stroke="url(#${p}m)" stroke-width="3"/>
${emblem(b.emblem, 100, 100, 1.0, '#fff', {})}${emblem(b.emblem, 100, 100, 1.0, null, { stroke: '#c9a24a', sw: 2.5 })}
<path d="M48 70 A60 60 0 0 1 96 38" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="8" stroke-linecap="round"/>`),
  },
  {
    name: 'Reel Coin',
    note: 'A coin whose rim is film sprockets, struck in the rarity color. Unmistakably cinema.',
    draw: (b, p) => {
      const holes = Array.from({ length: 16 }, (_, i) => {
        const [x, y] = polar(80, i * 22.5);
        return `<rect x="${(x - 5).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="10" height="14" rx="3" fill="#0b0b0e" transform="rotate(${i * 22.5 + 90} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }).join('');
      return svg(`<defs><radialGradient id="${p}c" cx=".4" cy=".35"><stop offset="0" stop-color="${b.c.light}"/><stop offset="1" stop-color="${b.c.base}"/></radialGradient></defs>
<circle cx="100" cy="100" r="92" fill="${b.c.dark}"/>${holes}<circle cx="100" cy="100" r="66" fill="url(#${p}c)" stroke="${b.c.dark}" stroke-width="4"/>${emblem(b.emblem, 100, 100, 1.0, b.c.ink)}`);
    },
  },
  {
    name: 'Deco Crest',
    note: 'An art-deco picture-palace crest: stepped shield, sunburst fan, gold pinstripes.',
    draw: (b, p) => {
      const rays = Array.from({ length: 9 }, (_, i) => {
        const [x, y] = polar(70, 200 + i * 17.5, 100, 118);
        return `<line x1="100" y1="118" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${b.c.light}" stroke-opacity=".45" stroke-width="3"/>`;
      }).join('');
      return svg(`<path d="M100 10 L170 40 L170 110 C170 150 140 178 100 192 C60 178 30 150 30 110 L30 40 Z" fill="${b.c.dark}"/>
<path d="M100 22 L158 47 L158 108 C158 142 133 166 100 178 C67 166 42 142 42 108 L42 47 Z" fill="${b.c.base}" stroke="${b.c.light}" stroke-width="2.5"/>
<g clip-path="url(#${p}k)">${rays}</g><clipPath id="${p}k"><path d="M100 22 L158 47 L158 108 C158 142 133 166 100 178 C67 166 42 142 42 108 L42 47 Z"/></clipPath>
<path d="M60 150 L140 150" stroke="${b.c.light}" stroke-width="2"/><path d="M70 158 L130 158" stroke="${b.c.light}" stroke-width="2"/>
${emblem(b.emblem, 100, 96, 0.95, '#fff')}`);
    },
  },
  {
    name: 'Neon Sign',
    note: 'The emblem as glowing neon tubing on a black plaque, the way theatre signs glow at night.',
    draw: (b, p) =>
      svg(`<defs><filter id="${p}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>
<rect x="18" y="18" width="164" height="164" rx="36" fill="#0c0c11" stroke="#2a2a33" stroke-width="3"/>
<g filter="url(#${p}g)" opacity=".9"><circle cx="100" cy="100" r="62" fill="none" stroke="${b.c.base}" stroke-width="7"/>${emblem(b.emblem, 100, 100, 0.95, null, { stroke: b.c.base, sw: 8 })}</g>
<circle cx="100" cy="100" r="62" fill="none" stroke="${b.c.light}" stroke-width="3"/>${emblem(b.emblem, 100, 100, 0.95, null, { stroke: '#fff', sw: 3 })}`),
  },
  {
    name: 'Wax Seal',
    note: 'A pressed wax seal with an embossed emblem and two ribbon tails. Personal, like a signed letter.',
    draw: (b, p) => {
      const blob = Array.from({ length: 18 }, (_, i) => polar(i % 2 ? 76 : 82 + (i % 3) * 2, (i / 18) * 360, 100, 92));
      return svg(`<defs><radialGradient id="${p}w" cx=".38" cy=".3"><stop offset="0" stop-color="${b.c.light}"/><stop offset=".6" stop-color="${b.c.base}"/><stop offset="1" stop-color="${b.c.dark}"/></radialGradient></defs>
<path d="M78 150 L64 196 L82 184 L92 198 L100 156Z" fill="${b.c.dark}"/><path d="M122 150 L136 196 L118 184 L108 198 L100 156Z" fill="${b.c.dark}"/>
<polygon points="${pts(blob)}" fill="url(#${p}w)" stroke="${b.c.dark}" stroke-width="2" stroke-linejoin="round"/>
<circle cx="100" cy="92" r="56" fill="none" stroke="${b.c.dark}" stroke-opacity=".6" stroke-width="3"/>
${emblem(b.emblem, 102, 94, 0.9, b.c.light)}${emblem(b.emblem, 100, 92, 0.9, b.c.dark)}`);
    },
  },
  {
    name: 'Ticket Stub',
    note: 'The badge is itself a tiny admission ticket, matching the unlock toast.',
    draw: (b, p) =>
      svg(`<g transform="rotate(-8 100 100)"><path d="M24 52 H176 V82 A18 18 0 0 0 176 118 V148 H24 V118 A18 18 0 0 0 24 82 Z" fill="${b.c.base}" stroke="${b.c.dark}" stroke-width="3"/>
<line x1="58" y1="58" x2="58" y2="142" stroke="${b.c.light}" stroke-width="3" stroke-dasharray="5 5"/>
<text x="41" y="100" transform="rotate(-90 41 100)" text-anchor="middle" font-family="Bahnschrift, 'Segoe UI'" font-weight="700" font-size="13" letter-spacing="2" fill="#fff">VANTA</text>
${emblem(b.emblem, 118, 100, 0.85, '#fff')}</g>`),
  },
  {
    name: 'Aperture Coin',
    note: 'A camera aperture whose blades are the rarity color, opening onto the emblem.',
    draw: (b, p) => {
      const blades = Array.from({ length: 8 }, (_, i) => {
        const a = i * 45;
        const [x1, y1] = polar(88, a);
        const [x2, y2] = polar(88, a + 45);
        const [x3, y3] = polar(44, a + 70);
        return `<polygon points="100,100 ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)}" fill="${i % 2 ? b.c.base : b.c.dark}" stroke="${b.c.light}" stroke-opacity=".4"/>`;
      }).join('');
      return svg(`<circle cx="100" cy="100" r="92" fill="#111"/>${blades}<circle cx="100" cy="100" r="46" fill="#0c0c10" stroke="${b.c.light}" stroke-width="3"/>${emblem(b.emblem, 100, 100, 0.7, b.c.light)}<circle cx="100" cy="100" r="90" fill="none" stroke="${b.c.light}" stroke-width="3"/>`);
    },
  },
  {
    name: 'Holo Hexagon',
    note: 'A faceted hexagon with a holographic shimmer: modern, gamer-friendly, collectible-card energy.',
    draw: (b, p) => {
      const hex = Array.from({ length: 6 }, (_, i) => polar(88, i * 60 - 90));
      const facets = hex.map((v, i) => `<polygon points="100,100 ${pts([v, hex[(i + 1) % 6]])}" fill="${[b.c.light, b.c.base, b.c.dark][i % 3]}" opacity="${0.75 + (i % 2) * 0.25}"/>`).join('');
      return svg(`<defs><linearGradient id="${p}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient></defs>
${facets}<polygon points="${pts(hex)}" fill="url(#${p}h)" stroke="${b.c.light}" stroke-width="3"/><circle cx="100" cy="100" r="38" fill="${b.c.ink}" opacity=".85" stroke="${b.c.light}" stroke-width="2"/>${emblem(b.emblem, 100, 100, 0.66, '#fff')}`);
    },
  },
  {
    name: 'Embroidered Patch',
    note: 'A sewn fabric patch with a stitched border: cozy, crafty, like a jacket patch.',
    draw: (b, p) =>
      svg(`<defs><pattern id="${p}t" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="#000" stroke-opacity=".12" stroke-width="1.5"/></pattern></defs>
<circle cx="100" cy="100" r="88" fill="${b.c.dark}"/><circle cx="100" cy="100" r="80" fill="${b.c.base}"/><circle cx="100" cy="100" r="80" fill="url(#${p}t)"/>
<circle cx="100" cy="100" r="84" fill="none" stroke="${b.c.light}" stroke-width="3" stroke-dasharray="6 4"/>
${emblem(b.emblem, 100, 100, 1.0, b.c.light)}${emblem(b.emblem, 100, 100, 1.0, null, { stroke: b.c.dark, sw: 2 })}`),
  },
  {
    name: 'Marquee Bulbs',
    note: 'A black disc ringed with glowing marquee bulbs, the emblem lit in the middle. Old Hollywood.',
    draw: (b, p) => {
      const bulbs = Array.from({ length: 20 }, (_, i) => {
        const [x, y] = polar(78, i * 18);
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${b.c.base}" opacity=".6" filter="url(#${p}b)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${b.c.light}"/>`;
      }).join('');
      return svg(`<defs><filter id="${p}b" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3"/></filter></defs>
<circle cx="100" cy="100" r="92" fill="#0e0d12" stroke="${b.c.dark}" stroke-width="4"/>${bulbs}${emblem(b.emblem, 100, 100, 0.8, b.c.light)}`);
    },
  },
  {
    name: 'Monoline',
    note: 'Minimal: a thin double ring and a single-weight line emblem. The calmest, most Apple-like option.',
    draw: (b, p) =>
      svg(`<circle cx="100" cy="100" r="88" fill="#101116"/><circle cx="100" cy="100" r="84" fill="none" stroke="${b.c.base}" stroke-width="3"/><circle cx="100" cy="100" r="74" fill="none" stroke="${b.c.base}" stroke-opacity=".4" stroke-width="1.5"/>
${emblem(b.emblem, 100, 100, 0.95, null, { stroke: b.c.light, sw: 3.5 })}`),
  },
  {
    name: 'Cut Gem',
    note: 'A faceted gemstone in the rarity color with the emblem etched on the table facet. Rarity as a jewel.',
    draw: (b, p) =>
      svg(`<polygon points="100,12 168,46 186,100 168,154 100,188 32,154 14,100 32,46" fill="${b.c.dark}"/>
<polygon points="100,12 168,46 100,62" fill="${b.c.light}"/><polygon points="100,12 32,46 100,62" fill="${b.c.base}"/>
<polygon points="168,46 186,100 140,100" fill="${b.c.base}"/><polygon points="32,46 14,100 60,100" fill="${b.c.light}" opacity=".8"/>
<polygon points="186,100 168,154 140,100" fill="${b.c.dark}"/><polygon points="14,100 32,154 60,100" fill="${b.c.base}"/>
<polygon points="168,154 100,188 100,138" fill="${b.c.base}"/><polygon points="32,154 100,188 100,138" fill="${b.c.dark}" opacity=".85"/>
<polygon points="100,62 140,100 100,138 60,100" fill="${b.c.base}" stroke="${b.c.light}" stroke-width="2"/>${emblem(b.emblem, 100, 100, 0.52, '#fff')}`),
  },
  {
    name: 'Vinyl Record',
    note: 'A black vinyl disc with grooves and a colored center label. Media nostalgia.',
    draw: (b, p) =>
      svg(`<circle cx="100" cy="100" r="92" fill="#111114"/>${Array.from({ length: 8 }, (_, i) => `<circle cx="100" cy="100" r="${86 - i * 6}" fill="none" stroke="#fff" stroke-opacity=".06"/>`).join('')}
<path d="M40 52 A72 72 0 0 1 98 28" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>
<circle cx="100" cy="100" r="40" fill="${b.c.base}" stroke="${b.c.light}" stroke-width="2"/>${emblem(b.emblem, 100, 100, 0.55, '#fff')}<circle cx="100" cy="100" r="3" fill="#111114"/>`),
  },
  {
    name: 'Laurel Award',
    note: 'The emblem in a circle framed by laurel branches: a festival-winner feel ("Official Selection").',
    draw: (b, p) => {
      const leaves = [];
      for (let i = 0; i < 9; i++) {
        const a = 120 + i * 14;
        const [x, y] = polar(82, a);
        leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="11" ry="5" fill="${b.c.light}" transform="rotate(${a + 60} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
        const [x2, y2] = polar(82, 60 - i * 14);
        leaves.push(`<ellipse cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" rx="11" ry="5" fill="${b.c.light}" transform="rotate(${60 - i * 14 - 60} ${x2.toFixed(1)} ${y2.toFixed(1)}) rotate(-120 ${x2.toFixed(1)} ${y2.toFixed(1)})"/>`);
      }
      return svg(`<circle cx="100" cy="100" r="62" fill="${b.c.base}" stroke="${b.c.light}" stroke-width="3"/>${leaves.join('')}${emblem(b.emblem, 100, 100, 0.8, '#fff')}`);
    },
  },
];
