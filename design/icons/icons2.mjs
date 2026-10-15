// Vanta by soybean_alien
// Icon concepts 41–80: a second round, all in Vanta gold.
import { svg, tile, glowDef, polar, pts, GOLD, GOLD_HI, GOLD_LO } from './icons.mjs';

const f = (n) => n.toFixed(1);
const TILE_CLIP = (p) => `<clipPath id="${p}clip"><rect x="8" y="8" width="240" height="240" rx="54"/></clipPath>`;
const SLAB_V = [
  [58, 70],
  [104, 70],
  [128, 140],
  [152, 70],
  [198, 70],
  [146, 196],
  [110, 196],
];

export const MORE = [
  // ── Void II ───────────────────────────────────────────────────────────
  {
    name: 'Ring of Fire',
    note: 'An annular eclipse: a thick, even band of gold around a black moon. A bolder sibling to Event Horizon.',
    group: 'Void II',
    draw: (p) =>
      tile(
        p,
        `<defs>${glowDef(p, GOLD, 0.6, 0.74, 0.6)}<radialGradient id="${p}fire"><stop offset=".78" stop-color="${GOLD_HI}"/><stop offset="1" stop-color="${GOLD}"/></radialGradient></defs>
<circle cx="128" cy="128" r="104" fill="url(#${p}glow)"/>
<circle cx="128" cy="128" r="74" fill="url(#${p}fire)"/>
<circle cx="128" cy="128" r="58" fill="#000"/>`,
      ),
  },
  {
    name: 'Corona',
    note: 'Ragged streamers of light around a black sun, as you see during totality.',
    group: 'Void II',
    draw: (p) =>
      tile(
        p,
        Array.from({ length: 40 }, (_, k) => {
          const a = k * 9;
          const len = 14 + 22 * Math.abs(Math.sin(k * 1.7)) + 10 * Math.abs(Math.sin(k * 0.45));
          const [x1, y1] = polar(56, a);
          const [x2, y2] = polar(56 + len, a);
          return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${GOLD}" stroke-opacity="${(0.35 + 0.6 * Math.abs(Math.cos(k * 1.3))).toFixed(2)}" stroke-width="2" stroke-linecap="round"/>`;
        }).join('') + `<circle cx="128" cy="128" r="54" fill="#000" stroke="${GOLD_HI}" stroke-width="2"/>`,
      ),
  },
  {
    name: 'Einstein Cross',
    note: 'Gravity bends one distant light into four images around a dark mass. A nerdy, beautiful astronomy reference.',
    group: 'Void II',
    draw: (p) =>
      tile(
        p,
        `<defs><radialGradient id="${p}star"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${GOLD_HI}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<circle cx="128" cy="128" r="64" fill="none" stroke="${GOLD}" stroke-opacity=".3" stroke-width="2"/>
<circle cx="128" cy="128" r="50" fill="#000"/>` +
          [30, 120, 210, 300]
            .map((a) => {
              const [x, y] = polar(64, a - 75);
              return `<circle cx="${f(x)}" cy="${f(y)}" r="15" fill="url(#${p}star)"/>`;
            })
            .join(''),
      ),
  },
  {
    name: 'Wormhole',
    note: 'Rings narrowing into a tunnel that drops away to black. Depth and pull.',
    group: 'Void II',
    draw: (p) =>
      tile(
        p,
        Array.from({ length: 8 }, (_, i) => {
          const rx = 100 * Math.pow(0.78, i);
          return `<ellipse cx="128" cy="${f(76 + i * 14 + (1 - Math.pow(0.78, i)) * 20)}" rx="${f(rx)}" ry="${f(rx * 0.3)}" fill="none" stroke="${GOLD}" stroke-opacity="${(1 - i * 0.1).toFixed(2)}" stroke-width="${(3 - i * 0.25).toFixed(2)}"/>`;
        }).join('') + `<ellipse cx="128" cy="${f(76 + 8 * 14 + (1 - Math.pow(0.78, 8)) * 20)}" rx="17" ry="5" fill="#000"/>`,
      ),
  },
  {
    name: 'Black Pearl',
    note: 'A glossy black sphere resting in a gold setting. Jewelry-box luxury.',
    group: 'Void II',
    draw: (p) =>
      tile(
        p,
        `<defs><radialGradient id="${p}pearl" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="#4a4d55"/><stop offset=".35" stop-color="#121317"/><stop offset="1" stop-color="#000"/></radialGradient></defs>
<ellipse cx="128" cy="186" rx="62" ry="14" fill="none" stroke="${GOLD}" stroke-width="4"/>
<circle cx="128" cy="120" r="66" fill="url(#${p}pearl)"/>
<ellipse cx="104" cy="94" rx="16" ry="10" fill="${GOLD_HI}" fill-opacity=".7" transform="rotate(-35 104 94)"/>
<path d="M68,186 A62,14 0 0,0 188,186" fill="none" stroke="${GOLD_HI}" stroke-width="4"/>`,
      ),
  },
  {
    name: 'Ink Drop',
    note: 'One drop of liquid black outlined in gold, like the material itself before it hits the screen.',
    group: 'Void II',
    draw: (p) =>
      tile(
        p,
        `<path d="M128,44 C150,88 184,120 184,158 A56,56 0 0,1 72,158 C72,120 106,88 128,44 Z" fill="#000" stroke="${GOLD}" stroke-width="3"/>
<path d="M98,160 A30,30 0 0,0 118,188" fill="none" stroke="${GOLD_HI}" stroke-width="4" stroke-linecap="round"/>`,
      ),
  },
  {
    name: 'Phases',
    note: 'Three moons going from full gold to fully black, left to right: the light being swallowed.',
    group: 'Void II',
    draw: (p) =>
      tile(
        p,
        `<circle cx="70" cy="128" r="26" fill="${GOLD}"/>
<circle cx="128" cy="128" r="26" fill="${GOLD}"/><path d="M128,102 A26,26 0 0,1 128,154 Z" fill="#000"/>
<circle cx="186" cy="128" r="26" fill="#000" stroke="${GOLD}" stroke-width="2.5"/>`,
      ),
  },
  {
    name: 'Keyhole',
    note: 'A black keyhole cut through a gold disc. Your private library, unlocked.',
    group: 'Void II',
    draw: (p) => tile(p, `<circle cx="128" cy="128" r="84" fill="${GOLD}"/><circle cx="128" cy="108" r="22" fill="#050607"/><polygon points="116,118 140,118 150,182 106,182" fill="#050607"/>`),
  },

  // ── Monogram II ───────────────────────────────────────────────────────
  {
    name: 'Slab V',
    note: 'A heavy, flat-topped geometric V. Confident and graphic, and the boldest at 16 px.',
    group: 'Monogram II',
    draw: (p) => tile(p, `<polygon points="${pts(SLAB_V)}" fill="${GOLD}"/>`),
  },
  {
    name: 'Inline V',
    note: 'The slab V drawn as an outline with a hairline running through each arm. Art-deco signage.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        `<polygon points="${pts(SLAB_V)}" fill="none" stroke="${GOLD}" stroke-width="4" stroke-linejoin="miter"/>
<path d="M81,70 L128,186 L175,70" fill="none" stroke="${GOLD_HI}" stroke-width="2"/>`,
      ),
  },
  {
    name: 'Deco Burst',
    note: 'Fine rays fan out behind a solid V, like a 1920s picture-palace facade.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        `<defs>${TILE_CLIP(p)}</defs><g clip-path="url(#${p}clip)">` +
          Array.from({ length: 11 }, (_, k) => {
            const [x, y] = polar(150, 200 + k * 14, 128, 200);
            return `<line x1="128" y1="200" x2="${f(x)}" y2="${f(y)}" stroke="${GOLD}" stroke-opacity=".35" stroke-width="2"/>`;
          }).join('') +
          `</g><path d="M80,78 L128,190 L176,78" fill="none" stroke="${GOLD}" stroke-width="16" stroke-linejoin="miter"/>`,
      ),
  },
  {
    name: 'Molten V',
    note: 'The slab V filled with a gradient from bright to deep gold, like metal still cooling.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        `<defs><linearGradient id="${p}molten" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_HI}"/><stop offset=".55" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_LO}"/></linearGradient></defs>
<polygon points="${pts(SLAB_V)}" fill="url(#${p}molten)"/>`,
      ),
  },
  {
    name: 'Framed V',
    note: 'A thin V centred in a thin square: a gallery placard or hallmark stamp.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        `<rect x="54" y="54" width="148" height="148" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
<path d="M90,92 L128,168 L166,92" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linejoin="miter"/>`,
      ),
  },
  {
    name: 'Bezel',
    note: 'A V inside a ticked ring like a luxury watch bezel. Precise and expensive.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        Array.from({ length: 60 }, (_, k) => {
          const long = k % 5 === 0;
          const [x1, y1] = polar(long ? 74 : 79, k * 6);
          const [x2, y2] = polar(86, k * 6);
          return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${GOLD}" stroke-width="${long ? 3 : 1.5}" stroke-opacity="${long ? 1 : 0.6}"/>`;
        }).join('') + `<path d="M98,100 L128,162 L158,100" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linejoin="miter"/>`,
      ),
  },
  {
    name: 'Chevrons',
    note: 'Three stacked Vs getting brighter as they fall, like rank insignia or a “down into it” motion.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        [0, 1, 2]
          .map((i) => `<path d="M80,${66 + i * 38} L128,${108 + i * 38} L176,${66 + i * 38}" fill="none" stroke="${GOLD}" stroke-opacity="${[0.3, 0.62, 1][i]}" stroke-width="13" stroke-linejoin="miter"/>`)
          .join(''),
      ),
  },
  {
    name: 'Descent',
    note: 'A solid gold triangle pointing down inside a black disc: a V stripped to pure shape.',
    group: 'Monogram II',
    draw: (p) => tile(p, `<circle cx="128" cy="128" r="86" fill="#000" stroke="${GOLD}" stroke-width="3"/><polygon points="84,96 172,96 128,178" fill="${GOLD}"/>`),
  },
  {
    name: 'Starlit V',
    note: 'A fine V with a four-point sparkle above its notch. A quiet touch of glamour.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        `<path d="M78,92 L128,192 L178,92" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linejoin="miter"/>
<path d="M128,46 Q131,69 150,72 Q131,75 128,98 Q125,75 106,72 Q125,69 128,46 Z" fill="${GOLD_HI}"/>`,
      ),
  },
  {
    name: 'Pixel V',
    note: 'A V built from square pixels, fading at the tips. Retro-game nod, still classy in gold on black.',
    group: 'Monogram II',
    draw: (p) => {
      const rows = ['XX.......XX', 'XX.......XX', '.XX.....XX.', '.XX.....XX.', '..XX...XX..', '..XX...XX..', '...XX.XX...', '...XX.XX...', '....XXX....', '.....X.....'];
      const c = 14;
      const x0 = 128 - (11 * c) / 2;
      const y0 = 128 - (rows.length * c) / 2;
      return tile(
        p,
        rows
          .flatMap((r, y) =>
            [...r].map((ch, x) =>
              ch === 'X' ? `<rect x="${x0 + x * c + 1}" y="${y0 + y * c + 1}" width="${c - 2}" height="${c - 2}" fill="${GOLD}" fill-opacity="${(0.55 + (y / rows.length) * 0.45).toFixed(2)}"/>` : '',
            ),
          )
          .join(''),
      );
    },
  },
  {
    name: 'Long Shadow V',
    note: 'A slab V casting a long diagonal shadow across the tile. Flat-design depth.',
    group: 'Monogram II',
    draw: (p) => {
      const V = SLAB_V.map(([x, y]) => [128 + (x - 128) * 0.8, 128 + (y - 133) * 0.8]);
      const shadow = [V[4], [V[4][0] + 120, V[4][1] + 120], [V[5][0] + 120, V[5][1] + 120], [V[6][0] + 120, V[6][1] + 120], V[6], V[5]];
      return tile(
        p,
        `<defs>${TILE_CLIP(p)}<linearGradient id="${p}shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GOLD_LO}" stop-opacity=".55"/><stop offset="1" stop-color="${GOLD_LO}" stop-opacity="0"/></linearGradient></defs>
<polygon points="${pts(shadow)}" fill="url(#${p}shade)" clip-path="url(#${p}clip)"/>
<polygon points="${pts(V)}" fill="${GOLD}"/>`,
      );
    },
  },
  {
    name: 'Crowned V',
    note: 'A small crown over the V. A regal crest for the king of your library.',
    group: 'Monogram II',
    draw: (p) =>
      tile(
        p,
        `<polygon points="98,84 98,58 113,72 128,52 143,72 158,58 158,84" fill="${GOLD_HI}"/>
<path d="M84,102 L128,192 L172,102" fill="none" stroke="${GOLD}" stroke-width="13" stroke-linejoin="miter"/>`,
      ),
  },

  // ── Cinema II ─────────────────────────────────────────────────────────
  {
    name: 'Projector',
    note: 'A vintage twin-reel projector throwing a beam off the edge. Pure cinema nostalgia.',
    group: 'Cinema II',
    draw: (p) =>
      tile(
        p,
        `<defs>${TILE_CLIP(p)}<linearGradient id="${p}throw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD_HI}" stop-opacity=".9"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient></defs>
<polygon points="190,142 260,104 260,200 190,160" fill="url(#${p}throw)" clip-path="url(#${p}clip)"/>
<circle cx="84" cy="88" r="25" fill="none" stroke="${GOLD}" stroke-width="3"/><circle cx="84" cy="88" r="5" fill="${GOLD}"/>
<circle cx="144" cy="80" r="31" fill="none" stroke="${GOLD}" stroke-width="3"/><circle cx="144" cy="80" r="6" fill="${GOLD}"/>
<rect x="60" y="122" width="112" height="56" rx="8" fill="#000" stroke="${GOLD}" stroke-width="3"/>
<rect x="172" y="136" width="18" height="30" rx="3" fill="${GOLD}"/>
<line x1="76" y1="178" x2="68" y2="200" stroke="${GOLD}" stroke-width="4"/><line x1="156" y1="178" x2="164" y2="200" stroke="${GOLD}" stroke-width="4"/>`,
      ),
  },
  {
    name: 'Admit One',
    note: 'A gold cinema ticket with notched edges, a perforated stub and a V stamped on it.',
    group: 'Cinema II',
    draw: (p) =>
      tile(
        p,
        `<rect x="36" y="84" width="184" height="88" rx="8" fill="${GOLD}"/>
<circle cx="36" cy="128" r="14" fill="#0c0d10"/><circle cx="220" cy="128" r="14" fill="#0c0d10"/>
<line x1="94" y1="92" x2="94" y2="164" stroke="#050607" stroke-width="2.5" stroke-dasharray="5 5"/>
<text x="68" y="132" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="700" letter-spacing="1" fill="#050607" transform="rotate(-90 68 128)">ADMIT</text>
<path d="M136,104 L157,150 L178,104" fill="none" stroke="#050607" stroke-width="9" stroke-linejoin="miter"/>`,
      ),
  },
  {
    name: 'Clapper',
    note: 'A black slate with its gold-striped clapstick swung open, a moment before “Action”.',
    group: 'Cinema II',
    draw: (p) => {
      const stripes = [0, 1, 2, 3, 4].map((i) => `<polygon points="${66 + i * 30},76 ${82 + i * 30},76 ${70 + i * 30},100 ${54 + i * 30},100" fill="#050607"/>`).join('');
      return tile(
        p,
        `<rect x="52" y="108" width="152" height="94" rx="6" fill="#000" stroke="${GOLD}" stroke-width="3"/>
<line x1="68" y1="140" x2="188" y2="140" stroke="${GOLD}" stroke-opacity=".5" stroke-width="2"/><line x1="68" y1="170" x2="188" y2="170" stroke="${GOLD}" stroke-opacity=".5" stroke-width="2"/>
<g transform="rotate(-16 54 104)"><rect x="52" y="76" width="152" height="24" rx="3" fill="${GOLD}"/>${stripes}</g>`,
      );
    },
  },
  {
    name: 'Front Row',
    note: 'Rows of seats facing a glowing gold screen. The view from your couch.',
    group: 'Cinema II',
    draw: (p) => {
      const seat = (x, y) => `<rect x="${x}" y="${y}" width="26" height="28" rx="7" fill="#000" stroke="${GOLD}" stroke-opacity=".55" stroke-width="2"/>`;
      return tile(
        p,
        `<defs><radialGradient id="${p}scr" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="${GOLD}" stop-opacity=".45"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<rect x="8" y="8" width="240" height="160" rx="54" fill="url(#${p}scr)"/>
<rect x="48" y="50" width="160" height="40" rx="4" fill="${GOLD}"/>` +
          [0, 1, 2, 3, 4].map((i) => seat(46 + i * 34, 130)).join('') +
          [0, 1, 2, 3].map((i) => seat(63 + i * 34, 172)).join(''),
      );
    },
  },
  {
    name: 'Reel Strip',
    note: 'A gold filmstrip slicing diagonally across the tile with black frames, full of motion.',
    group: 'Cinema II',
    draw: (p) => {
      const holes = Array.from({ length: 16 }, (_, i) => `<rect x="${-30 + i * 20}" y="100" width="9" height="8" rx="1.5" fill="#050607"/><rect x="${-30 + i * 20}" y="148" width="9" height="8" rx="1.5" fill="#050607"/>`).join('');
      const frames = Array.from({ length: 7 }, (_, i) => `<rect x="${-26 + i * 46}" y="113" width="38" height="30" rx="2" fill="#050607"/>`).join('');
      return tile(p, `<defs>${TILE_CLIP(p)}</defs><g clip-path="url(#${p}clip)"><g transform="rotate(-28 128 128)"><rect x="-40" y="94" width="340" height="68" fill="${GOLD}"/>${holes}${frames}</g></g>`);
    },
  },
  {
    name: 'Premiere',
    note: 'Two searchlights sweep up from one point and draw a V of light in the night sky. Opening night.',
    group: 'Cinema II',
    draw: (p) =>
      tile(
        p,
        `<defs>${TILE_CLIP(p)}<linearGradient id="${p}sl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${GOLD_HI}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>
<radialGradient id="${p}base"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${GOLD_HI}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<g clip-path="url(#${p}clip)"><polygon points="122,214 134,214 70,20 30,34" fill="url(#${p}sl)"/><polygon points="122,214 134,214 226,34 186,20" fill="url(#${p}sl)"/></g>
<circle cx="128" cy="212" r="26" fill="url(#${p}base)"/>`,
      ),
  },
  {
    name: 'Countdown',
    note: 'The old film-leader countdown: crosshairs, a sweeping wedge and a 3. The film is about to start.',
    group: 'Cinema II',
    draw: (p) => {
      const [x1, y1] = polar(76, -90);
      const [x2, y2] = polar(76, 20);
      return tile(
        p,
        `<path d="M128,128 L${f(x1)},${f(y1)} A76,76 0 0,1 ${f(x2)},${f(y2)} Z" fill="${GOLD}" fill-opacity=".3"/>
<circle cx="128" cy="128" r="80" fill="none" stroke="${GOLD}" stroke-width="3"/><circle cx="128" cy="128" r="60" fill="none" stroke="${GOLD}" stroke-opacity=".5" stroke-width="2"/>
<line x1="40" y1="128" x2="216" y2="128" stroke="${GOLD}" stroke-opacity=".6" stroke-width="2"/><line x1="128" y1="40" x2="128" y2="216" stroke="${GOLD}" stroke-opacity=".6" stroke-width="2"/>
<text x="128" y="152" text-anchor="middle" font-family="Georgia, serif" font-size="68" font-weight="700" fill="${GOLD_HI}">3</text>`,
      );
    },
  },
  {
    name: 'Gilded Frame',
    note: 'An ornate gold picture frame around pure black, as if the blackest painting hung in a museum.',
    group: 'Cinema II',
    draw: (p) =>
      tile(
        p,
        `<rect x="46" y="46" width="164" height="164" fill="none" stroke="${GOLD}" stroke-width="10"/>
<rect x="62" y="62" width="132" height="132" fill="#000" stroke="${GOLD_HI}" stroke-width="2"/>` +
          [
            [46, 46],
            [210, 46],
            [46, 210],
            [210, 210],
          ]
            .map(([x, y]) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="${GOLD_HI}" transform="rotate(45 ${x} ${y})"/>`)
            .join(''),
      ),
  },

  // ── Geometric II ──────────────────────────────────────────────────────
  {
    name: 'Gold Cube',
    note: 'An isometric cube with a gold lid and black sides. A solid, product-like mark.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        `<polygon points="128,48 198,88 128,128 58,88" fill="${GOLD}"/>
<polygon points="58,88 128,128 128,208 58,168" fill="#000"/>
<polygon points="198,88 198,168 128,208 128,128" fill="#16171b"/>
<g fill="none" stroke="${GOLD_HI}" stroke-width="2" stroke-linejoin="round"><polygon points="128,48 198,88 198,168 128,208 58,168 58,88"/><path d="M58,88 L128,128 L198,88 M128,128 L128,208"/></g>`,
      ),
  },
  {
    name: 'Vortex',
    note: 'Nine squares, each turned and shrunk a little more, spiralling into the centre.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        Array.from({ length: 10 }, (_, i) => {
          const s = 168 * Math.pow(0.84, i);
          return `<rect x="${f(128 - s / 2)}" y="${f(128 - s / 2)}" width="${f(s)}" height="${f(s)}" fill="none" stroke="${GOLD}" stroke-opacity="${(0.25 + i * 0.083).toFixed(2)}" stroke-width="2" transform="rotate(${i * 9} 128 128)"/>`;
        }).join(''),
      ),
  },
  {
    name: 'Golden Spiral',
    note: 'A logarithmic spiral, the curve of shells and galaxies. A golden-ratio flourish.',
    group: 'Geometric II',
    draw: (p) => {
      const d = [];
      for (let t = 0; t <= 5.6 * Math.PI; t += 0.08) {
        const r = 3.6 * Math.exp(0.18 * t);
        d.push(`${f(132 + r * Math.cos(t))},${f(124 + r * Math.sin(t))}`);
      }
      return tile(p, `<polyline points="${d.join(' ')}" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="132" cy="124" r="5" fill="${GOLD_HI}"/>`);
    },
  },
  {
    name: 'Moiré',
    note: 'Two sets of rings slightly offset, making shimmering interference bands. Hypnotic up close.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        `<defs>${TILE_CLIP(p)}</defs><g clip-path="url(#${p}clip)" fill="none" stroke="${GOLD}" stroke-width="1.6">` +
          Array.from({ length: 8 }, (_, i) => `<circle cx="116" cy="128" r="${14 + i * 10}" stroke-opacity=".8"/><circle cx="140" cy="128" r="${14 + i * 10}" stroke-opacity=".8"/>`).join('') +
          `</g>`,
      ),
  },
  {
    name: 'Sunrise Deco',
    note: 'An art-deco half sun with alternating rays rising behind a black dome.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        `<defs>${TILE_CLIP(p)}</defs><g clip-path="url(#${p}clip)">` +
          Array.from({ length: 13 }, (_, k) => {
            const [x, y] = polar(150, 180 + k * 15, 128, 186);
            return `<line x1="128" y1="186" x2="${f(x)}" y2="${f(y)}" stroke="${GOLD}" stroke-width="${k % 2 ? 2 : 6}" stroke-opacity="${k % 2 ? 0.5 : 0.95}"/>`;
          }).join('') +
          `</g><path d="M78,186 A50,50 0 0,1 178,186 Z" fill="#000" stroke="${GOLD_HI}" stroke-width="3"/><line x1="40" y1="187" x2="216" y2="187" stroke="${GOLD_HI}" stroke-width="3"/>`,
      ),
  },
  {
    name: 'Nested Delta',
    note: 'A gold triangle pointing down with a black one inside. A V reduced to two triangles.',
    group: 'Geometric II',
    draw: (p) => tile(p, `<polygon points="52,70 204,70 128,200" fill="${GOLD}"/><polygon points="92,92 164,92 128,156" fill="#050607"/>`),
  },
  {
    name: 'Gravity Well',
    note: 'A grid of gold dots shrinking and fading as they near the black hole in the middle.',
    group: 'Geometric II',
    draw: (p) => {
      const dots = [];
      for (let gy = 0; gy < 11; gy++)
        for (let gx = 0; gx < 11; gx++) {
          const x = 38 + gx * 18;
          const y = 38 + gy * 18;
          const d = Math.hypot(x - 128, y - 128);
          if (d < 34 || d > 100) continue;
          const k = Math.min(1, (d - 34) / 66);
          dots.push(`<circle cx="${x}" cy="${y}" r="${f(1 + 3.6 * k)}" fill="${GOLD}" fill-opacity="${(0.25 + 0.75 * k).toFixed(2)}"/>`);
        }
      return tile(p, dots.join('') + `<circle cx="128" cy="128" r="28" fill="#000" stroke="${GOLD}" stroke-opacity=".5"/>`);
    },
  },
  {
    name: 'Infinity',
    note: 'An endless gold loop for endless watching. Simple and calm.',
    group: 'Geometric II',
    draw: (p) => {
      const d = [];
      for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.05) {
        const s = 1 + Math.sin(t) ** 2;
        d.push(`${f(128 + (92 * Math.cos(t)) / s)},${f(128 + (92 * Math.sin(t) * Math.cos(t)) / s)}`);
      }
      return tile(p, `<polyline points="${d.join(' ')}" fill="none" stroke="${GOLD}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`);
    },
  },
  {
    name: 'Kintsugi',
    note: 'Black ceramic mended with gold seams, the Japanese art of making the cracks the beautiful part.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        `<defs>${TILE_CLIP(p)}<filter id="${p}seam" x="-.2" y="-.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
<g clip-path="url(#${p}clip)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<g stroke="${GOLD}" stroke-width="6" opacity=".45" filter="url(#${p}seam)"><path d="M14,92 L86,106 L112,96 L138,126 L170,118 L242,156"/><path d="M112,96 L118,58 L134,14"/><path d="M138,126 L130,162 L146,196 L140,242"/><path d="M170,118 L190,92"/></g>
<g stroke="${GOLD_HI}" stroke-width="3"><path d="M14,92 L86,106 L112,96 L138,126 L170,118 L242,156"/><path d="M112,96 L118,58 L134,14"/><path d="M138,126 L130,162 L146,196 L140,242"/><path d="M170,118 L190,92"/></g></g>`,
        '#111215',
        '#020203',
      ),
  },
  {
    name: 'Bullion',
    note: 'A gold ingot with a V stamped in it. Unapologetically premium.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        `<polygon points="96,92 160,92 178,118 78,118" fill="${GOLD_HI}"/>
<polygon points="78,118 178,118 200,176 56,176" fill="${GOLD}"/>
<polygon points="56,176 200,176 200,184 56,184" fill="${GOLD_LO}"/>
<path d="M114,132 L128,162 L142,132" fill="none" stroke="${GOLD_LO}" stroke-width="6" stroke-linejoin="miter"/>`,
      ),
  },
  {
    name: 'Hourglass',
    note: 'Gold sand running through black glass. Time well spent.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        `<rect x="70" y="50" width="116" height="10" rx="3" fill="${GOLD}"/><rect x="70" y="196" width="116" height="10" rx="3" fill="${GOLD}"/>
<path d="M84,60 L172,60 L134,128 L172,196 L84,196 L122,128 Z" fill="#000" stroke="${GOLD}" stroke-opacity=".6" stroke-width="2.5" stroke-linejoin="round"/>
<polygon points="104,76 152,76 130,116 126,116" fill="${GOLD}" fill-opacity=".85"/>
<line x1="128" y1="118" x2="128" y2="176" stroke="${GOLD_HI}" stroke-width="2"/>
<polygon points="98,194 158,194 128,168" fill="${GOLD}"/>`,
      ),
  },
  {
    name: 'Waveform',
    note: 'A symmetrical audio waveform in gold bars. Sound and picture, the media side of the brand.',
    group: 'Geometric II',
    draw: (p) =>
      tile(
        p,
        Array.from({ length: 15 }, (_, i) => {
          const h = 16 + 120 * Math.abs(Math.sin((i + 1) * 0.55)) * Math.sin(((i + 0.5) / 15) * Math.PI);
          return `<rect x="${44 + i * 12}" y="${f(128 - h / 2)}" width="7" height="${f(h)}" rx="3.5" fill="${GOLD}" fill-opacity="${(0.55 + 0.45 * Math.sin(((i + 0.5) / 15) * Math.PI)).toFixed(2)}"/>`;
        }).join(''),
      ),
  },
];
