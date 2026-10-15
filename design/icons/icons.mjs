// Vanta by soybean_alien
// Icon concepts for Vanta. The idea is vantablack: a black that swallows light, with one accent and nothing else.
// Each concept is a function of an id prefix (SVG ids must be unique when many icons share a page).
// `node design/icons/build.mjs` writes svg/*.svg and gallery.html.

const GOLD = '#e5a00d';
const GOLD_HI = '#f7c65a';
const GOLD_LO = '#9a6a05';
const CHAMP = '#d9b77a';
const WHITE = '#f1f1ee';
const ICE = '#9fd8ff';
const VIOLET = '#9b7bff';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${body}</svg>`;

// Shared rounded-square tile: near-black with a whisper of top light.
const tile = (p, inner, top = '#17191e', bottom = '#040506') =>
  svg(`<defs><linearGradient id="${p}tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
<rect x="8" y="8" width="240" height="240" rx="54" fill="url(#${p}tile)"/>
<rect x="8.5" y="8.5" width="239" height="239" rx="53.5" fill="none" stroke="#fff" stroke-opacity=".08"/>
${inner}`);

const glowDef = (p, color, inner = 0.72, peak = 0.82, op = 0.75) =>
  `<radialGradient id="${p}glow"><stop offset="${inner}" stop-color="${color}" stop-opacity="0"/><stop offset="${peak}" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const polar = (r, deg, cx = 128, cy = 128) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const eventHorizon = (color) => (p) =>
  tile(
    p,
    `<defs>${glowDef(p, color)}</defs>
<circle cx="128" cy="128" r="100" fill="url(#${p}glow)"/>
<circle cx="128" cy="128" r="66" fill="#000"/>
<circle cx="128" cy="128" r="66" fill="none" stroke="${color}" stroke-width="2.5"/>`,
  );

const negativeV = (color) => (p) =>
  tile(
    p,
    `<circle cx="128" cy="128" r="80" fill="${color}"/>
<polygon points="84,90 108,90 128,138 148,90 172,90 128,178" fill="#050607"/>`,
  );

const serifV = (color) => (p) =>
  tile(
    p,
    `<polygon points="80,80 110,80 134,184 128,196" fill="${color}"/>
<polygon points="172,80 180,80 131,196 128,188" fill="${color}"/>
<rect x="66" y="75" width="58" height="5" fill="${color}"/>
<rect x="160" y="75" width="34" height="5" fill="${color}"/>`,
  );

function aperture(color) {
  return (p) => {
    const hole = [0, 1, 2, 3, 4, 5].map((k) => polar(30, k * 60 - 90));
    const lines = hole
      .map((v, k) => {
        const n = hole[(k + 1) % 6];
        const d = [n[0] - v[0], n[1] - v[1]];
        const len = Math.hypot(d[0], d[1]);
        const u = [d[0] / len, d[1] / len];
        // extend the hexagon edge past the next vertex until it meets the outer circle (r = 82)
        const ox = v[0] - 128;
        const oy = v[1] - 128;
        const b = ox * u[0] + oy * u[1];
        const c = ox * ox + oy * oy - 82 * 82;
        const t = -b + Math.sqrt(b * b - c);
        const end = [v[0] + u[0] * t, v[1] + u[1] * t];
        return `<line x1="${v[0].toFixed(1)}" y1="${v[1].toFixed(1)}" x2="${end[0].toFixed(1)}" y2="${end[1].toFixed(1)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
      })
      .join('');
    return tile(
      p,
      `<defs><radialGradient id="${p}blade"><stop offset=".3" stop-color="#2a2c31"/><stop offset="1" stop-color="#101114"/></radialGradient></defs>
<circle cx="128" cy="128" r="82" fill="url(#${p}blade)"/>
<polygon points="${pts(hole)}" fill="#000"/>
${lines}
<circle cx="128" cy="128" r="82" fill="none" stroke="${color}" stroke-width="3"/>`,
    );
  };
}

export const ICONS = [
  // ── Void ──────────────────────────────────────────────────────────────
  { name: 'Event Horizon', note: 'A perfect black disc rimmed by the last ring of light. The purest reading of the name.', group: 'Void', draw: eventHorizon(GOLD) },
  {
    name: 'Diamond Ring',
    note: 'Total eclipse with the diamond-ring flash on the edge. One spark against the black.',
    group: 'Void',
    draw: (p) =>
      tile(
        p,
        `<defs>${glowDef(p, GOLD, 0.7, 0.8, 0.45)}<radialGradient id="${p}spark"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${GOLD_HI}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<circle cx="128" cy="128" r="100" fill="url(#${p}glow)"/>
<circle cx="128" cy="128" r="64" fill="#000" stroke="${GOLD}" stroke-opacity=".7" stroke-width="1.5"/>
<circle cx="173" cy="83" r="26" fill="url(#${p}spark)"/>`,
      ),
  },
  {
    name: 'Crescent',
    note: 'A sliver of gold escaping a black disc, like light grazing the edge of something that absorbs everything.',
    group: 'Void',
    draw: (p) =>
      tile(
        p,
        `<circle cx="134" cy="122" r="68" fill="${GOLD}"/>
<circle cx="122" cy="134" r="68" fill="#050607"/>`,
      ),
  },
  {
    name: 'Absorption',
    note: 'Concentric rings get brighter as they fall inward, then stop dead at the black core.',
    group: 'Void',
    draw: (p) =>
      tile(
        p,
        [96, 82, 68, 54]
          .map((r, i) => `<circle cx="128" cy="128" r="${r}" fill="none" stroke="${GOLD}" stroke-width="${1.5 + i * 0.8}" stroke-opacity="${0.18 + i * 0.25}"/>`)
          .join('') + `<circle cx="128" cy="128" r="40" fill="#000"/>`,
      ),
  },
  {
    name: 'Light Sink',
    note: 'Twelve rays converge on a black core and vanish. Light goes in and never comes out.',
    group: 'Void',
    draw: (p) =>
      tile(
        p,
        `<defs><linearGradient id="${p}ray" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD}" stop-opacity="0"/><stop offset="1" stop-color="${GOLD_HI}"/></linearGradient></defs>` +
          Array.from({ length: 12 }, (_, k) => `<rect x="44" y="126.5" width="46" height="3" rx="1.5" fill="url(#${p}ray)" transform="rotate(${k * 30} 128 128)"/>`).join('') +
          `<circle cx="128" cy="128" r="36" fill="#000" stroke="${GOLD}" stroke-width="2"/>`,
      ),
  },
  {
    name: 'Singularity',
    note: 'A black hole with a tilted accretion disc: the back half bends over the top and the front cuts across.',
    group: 'Void',
    draw: (p) =>
      tile(
        p,
        `<g transform="rotate(-14 128 128)">
<ellipse cx="128" cy="128" rx="102" ry="24" fill="none" stroke="${GOLD}" stroke-opacity=".45" stroke-width="5"/>
</g>
<circle cx="128" cy="128" r="56" fill="none" stroke="${GOLD_HI}" stroke-width="2.5"/>
<circle cx="128" cy="128" r="50" fill="#000"/>
<g transform="rotate(-14 128 128)"><path d="M26,128 A102,24 0 0,0 230,128" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/></g>`,
      ),
  },
  {
    name: 'Swatch',
    note: 'A square of vantablack set into a lighter dark tile, with a tiny gold maker’s mark. A materials-lab feel.',
    group: 'Void',
    draw: (p) =>
      tile(
        p,
        `<rect x="66" y="66" width="124" height="124" rx="12" fill="#000"/>
<rect x="66.5" y="66.5" width="123" height="123" rx="11.5" fill="none" stroke="#fff" stroke-opacity=".06"/>
<path d="M164,170 L170,182 L176,170" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linejoin="miter"/>`,
        '#2a2d33',
        '#14161a',
      ),
  },
  {
    name: 'Iris',
    note: 'An eye’s iris in warm gold around a black pupil, with one catchlight. Built for watching.',
    group: 'Void',
    draw: (p) =>
      tile(
        p,
        `<defs><radialGradient id="${p}iris"><stop offset=".45" stop-color="${GOLD_HI}"/><stop offset=".8" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_LO}"/></radialGradient></defs>
<circle cx="128" cy="128" r="70" fill="url(#${p}iris)"/>` +
          Array.from({ length: 36 }, (_, k) => {
            const [x1, y1] = polar(36, k * 10);
            const [x2, y2] = polar(66, k * 10 + 4);
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${GOLD_LO}" stroke-opacity=".5" stroke-width="1.2"/>`;
          }).join('') +
          `<circle cx="128" cy="128" r="34" fill="#000"/>
<circle cx="112" cy="110" r="7" fill="#fff" fill-opacity=".85"/>`,
      ),
  },

  // ── Monogram ──────────────────────────────────────────────────────────
  {
    name: 'Blade V',
    note: 'A single thin geometric V with mitred strokes. Minimal and sharp, close to a fashion label.',
    group: 'Monogram',
    draw: (p) => tile(p, `<path d="M74,78 L128,184 L182,78" fill="none" stroke="${GOLD}" stroke-width="13" stroke-linejoin="miter" stroke-miterlimit="10"/>`),
  },
  { name: 'Negative V', note: 'A V cut out of a gold coin. Negative space does the work, and it stays readable at 16 px.', group: 'Monogram', draw: negativeV(GOLD) },
  {
    name: 'Chevron Play',
    note: 'A V turned on its side becomes a play arrow: the letter and the action in one mark.',
    group: 'Monogram',
    draw: (p) => tile(p, `<path d="M96,70 L170,128 L96,186" fill="none" stroke="${GOLD}" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>`),
  },
  {
    name: 'Split V',
    note: 'Two strokes that nearly meet, in two tones of gold. The gap at the point is where the light disappears.',
    group: 'Monogram',
    draw: (p) =>
      tile(
        p,
        `<line x1="80" y1="74" x2="123" y2="178" stroke="${GOLD}" stroke-width="22"/>
<line x1="176" y1="74" x2="133" y2="178" stroke="${CHAMP}" stroke-width="22"/>`,
      ),
  },
  {
    name: 'Facet V',
    note: 'The V as a cut gem: two lit facets meeting at a ridge.',
    group: 'Monogram',
    draw: (p) =>
      tile(
        p,
        `<polygon points="66,76 128,196 128,124" fill="${GOLD_HI}"/>
<polygon points="190,76 128,196 128,124" fill="${GOLD_LO}"/>
<polygon points="66,76 128,124 190,76 162,76 128,102 94,76" fill="${GOLD}"/>`,
      ),
  },
  { name: 'Didone V', note: 'High-contrast serif V (thick and thin strokes, hairline serifs) in champagne. The luxury-magazine take.', group: 'Monogram', draw: serifV(CHAMP) },
  {
    name: 'Ring V',
    note: 'A thin V inside a thin circle. Quiet, badge-like and symmetrical.',
    group: 'Monogram',
    draw: (p) =>
      tile(
        p,
        `<circle cx="128" cy="128" r="84" fill="none" stroke="${GOLD}" stroke-width="3"/>
<path d="M90,94 L128,170 L166,94" fill="none" stroke="${GOLD}" stroke-width="7" stroke-linejoin="miter"/>`,
      ),
  },
  {
    name: 'Ribbon V',
    note: 'Two bands crossing at the point like a folded ribbon, the back band in shadow.',
    group: 'Monogram',
    draw: (p) =>
      tile(
        p,
        `<polygon points="186,74 158,74 114,170 128,198" fill="${GOLD_LO}"/>
<polygon points="70,74 98,74 142,170 128,198" fill="${GOLD}"/>`,
      ),
  },
  {
    name: 'Convergence',
    note: 'Two beams of light fade in from the top and meet in a hot point: a V drawn by light itself.',
    group: 'Monogram',
    draw: (p) =>
      tile(
        p,
        `<defs><linearGradient id="${p}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD}" stop-opacity="0"/><stop offset="1" stop-color="${GOLD_HI}"/></linearGradient>
<radialGradient id="${p}hot"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${GOLD_HI}" stop-opacity=".8"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<polygon points="56,52 92,52 130,190 126,190" fill="url(#${p}beam)"/>
<polygon points="200,52 164,52 126,190 130,190" fill="url(#${p}beam)"/>
<circle cx="128" cy="188" r="22" fill="url(#${p}hot)"/>`,
      ),
  },
  {
    name: 'Crest',
    note: 'A heraldic shield with a V. Old-money and a little regal.',
    group: 'Monogram',
    draw: (p) =>
      tile(
        p,
        `<path d="M128,50 L190,72 L190,132 C190,170 162,194 128,208 C94,194 66,170 66,132 L66,72 Z" fill="#000" stroke="${GOLD}" stroke-width="3"/>
<path d="M98,96 L128,160 L158,96" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linejoin="miter"/>`,
      ),
  },

  // ── Cinema ────────────────────────────────────────────────────────────
  { name: 'Aperture', note: 'A camera iris closing down to a black hexagon, gold-edged blades on gunmetal.', group: 'Cinema', draw: aperture(GOLD) },
  {
    name: 'Film Gate',
    note: 'A frame of film with sprocket holes and nothing in the frame: black, waiting for the picture.',
    group: 'Cinema',
    draw: (p) =>
      tile(
        p,
        `<rect x="40" y="58" width="176" height="140" rx="10" fill="none" stroke="${GOLD}" stroke-width="3"/>
<rect x="56" y="86" width="144" height="84" rx="4" fill="#000" stroke="${GOLD}" stroke-opacity=".4"/>` +
          Array.from({ length: 7 }, (_, i) => `<rect x="${56 + i * 21}" y="66" width="10" height="10" rx="2" fill="${GOLD}" fill-opacity=".75"/><rect x="${56 + i * 21}" y="180" width="10" height="10" rx="2" fill="${GOLD}" fill-opacity=".75"/>`).join(''),
      ),
  },
  {
    name: 'Curtain Call',
    note: 'Stage curtains part to reveal pure black, and the gap between them forms the V.',
    group: 'Cinema',
    draw: (p) =>
      tile(
        p,
        `<defs><linearGradient id="${p}drape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD_LO}"/><stop offset=".5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_LO}"/></linearGradient></defs>
<path d="M36,46 L124,46 C112,96 96,150 36,212 Z" fill="url(#${p}drape)"/>
<path d="M220,46 L132,46 C144,96 160,150 220,212 Z" fill="url(#${p}drape)"/>
<rect x="36" y="40" width="184" height="12" rx="3" fill="${GOLD_HI}"/>`,
      ),
  },
  {
    name: 'Reel',
    note: 'A classic film reel reduced to its outline. Instantly reads as movies.',
    group: 'Cinema',
    draw: (p) =>
      tile(
        p,
        `<circle cx="128" cy="128" r="84" fill="#000" stroke="${GOLD}" stroke-width="4"/>
<circle cx="128" cy="128" r="12" fill="${GOLD}"/>` +
          [0, 72, 144, 216, 288]
            .map((a) => {
              const [x, y] = polar(48, a - 90);
              return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19" fill="none" stroke="${GOLD}" stroke-width="3"/>`;
            })
            .join(''),
      ),
  },
  {
    name: 'Play Void',
    note: 'A gold disc with a black play button punched through it. The universal symbol, made dark.',
    group: 'Cinema',
    draw: (p) => tile(p, `<circle cx="128" cy="128" r="82" fill="${GOLD}"/><polygon points="108,88 172,128 108,168" fill="#050607" stroke="#050607" stroke-width="8" stroke-linejoin="round"/>`),
  },
  {
    name: 'Afterglow',
    note: 'A widescreen of pure black with warm light bleeding around its edges, like a cinema just before the film starts.',
    group: 'Cinema',
    draw: (p) =>
      tile(
        p,
        `<defs><radialGradient id="${p}spill" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="${GOLD}" stop-opacity=".7"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="128" cy="128" rx="116" ry="84" fill="url(#${p}spill)"/>
<rect x="44" y="81" width="168" height="94" rx="6" fill="#000"/>`,
      ),
  },
  {
    name: 'Marquee',
    note: 'A V spelled in marquee bulbs. Old Hollywood with a soft glow.',
    group: 'Cinema',
    draw: (p) => {
      const dots = [];
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        dots.push([74 + (128 - 74) * t, 74 + (186 - 74) * t], [182 - (182 - 128) * t, 74 + (186 - 74) * t]);
      }
      const uniq = dots.filter((d, i) => i < dots.length - 1 || d[0] !== dots[dots.length - 2][0]);
      return tile(
        p,
        `<defs><filter id="${p}bulb" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4"/></filter></defs>` +
          uniq.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${GOLD}" filter="url(#${p}bulb)" opacity=".8"/>`).join('') +
          uniq.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="${GOLD_HI}"/>`).join(''),
      );
    },
  },
  {
    name: 'Spotlight',
    note: 'A single cone of light falls on an empty stage. Black everywhere else.',
    group: 'Cinema',
    draw: (p) =>
      tile(
        p,
        `<defs><linearGradient id="${p}cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_HI}" stop-opacity=".9"/><stop offset="1" stop-color="${GOLD}" stop-opacity=".12"/></linearGradient></defs>
<polygon points="118,40 138,40 196,186 60,186" fill="url(#${p}cone)"/>
<ellipse cx="128" cy="188" rx="70" ry="13" fill="${GOLD}" fill-opacity=".55"/>
<rect x="112" y="32" width="32" height="12" rx="3" fill="${GOLD_HI}"/>`,
      ),
  },
  {
    name: 'Lens',
    note: 'A camera lens front with deep glass and a cold reflection. Technical and premium.',
    group: 'Cinema',
    draw: (p) =>
      tile(
        p,
        `<defs><radialGradient id="${p}glass" cx=".42" cy=".38"><stop offset="0" stop-color="#1d2b4a"/><stop offset=".55" stop-color="#090c14"/><stop offset="1" stop-color="#000"/></radialGradient></defs>
<circle cx="128" cy="128" r="86" fill="#0d0e11" stroke="#3a3d44" stroke-width="2"/>
<circle cx="128" cy="128" r="72" fill="none" stroke="${GOLD}" stroke-width="2"/>
<circle cx="128" cy="128" r="58" fill="url(#${p}glass)"/>
<path d="M92,108 A40,40 0 0,1 120,84" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
<circle cx="150" cy="150" r="5" fill="${GOLD}" fill-opacity=".8"/>`,
      ),
  },

  // ── Geometric ─────────────────────────────────────────────────────────
  {
    name: 'Monolith',
    note: 'A tall black slab with one lit edge. Calm, 2001-style.',
    group: 'Geometric',
    draw: (p) =>
      tile(
        p,
        `<defs><radialGradient id="${p}halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${GOLD}" stop-opacity=".35"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="128" cy="128" rx="74" ry="104" fill="url(#${p}halo)"/>
<rect x="98" y="42" width="60" height="172" rx="3" fill="#000"/>
<line x1="157" y1="44" x2="157" y2="212" stroke="${GOLD_HI}" stroke-width="2.5"/>`,
      ),
  },
  {
    name: 'Black Diamond',
    note: 'A gem cut from black with gold facet lines: value and darkness together.',
    group: 'Geometric',
    draw: (p) =>
      tile(
        p,
        `<polygon points="62,104 96,68 160,68 194,104 128,198" fill="#000" stroke="${GOLD}" stroke-width="3" stroke-linejoin="round"/>
<g stroke="${GOLD}" stroke-width="2" stroke-opacity=".75" fill="none"><path d="M62,104 L194,104"/><path d="M96,68 L112,104 L128,68 L144,104 L160,68"/><path d="M112,104 L128,198 L144,104"/></g>`,
      ),
  },
  {
    name: 'Prism Trap',
    note: 'A white beam enters the prism and no spectrum comes out. Physics, inverted.',
    group: 'Geometric',
    draw: (p) =>
      tile(
        p,
        `<line x1="22" y1="150" x2="104" y2="132" stroke="${WHITE}" stroke-width="3"/>
<polygon points="128,62 196,184 60,184" fill="#000" stroke="${WHITE}" stroke-opacity=".85" stroke-width="3" stroke-linejoin="round"/>
<circle cx="128" cy="150" r="3" fill="${GOLD}"/>`,
      ),
  },
  {
    name: 'Orbit',
    note: 'A single gold moon orbiting a black core: the app circling your library.',
    group: 'Geometric',
    draw: (p) =>
      tile(
        p,
        `<g transform="rotate(-22 128 128)"><ellipse cx="128" cy="128" rx="96" ry="36" fill="none" stroke="${GOLD}" stroke-opacity=".55" stroke-width="2.5"/></g>
<circle cx="128" cy="128" r="44" fill="#000" stroke="${GOLD}" stroke-width="2"/>
<g transform="rotate(-22 128 128)"><circle cx="${(128 + 96 * Math.cos(Math.PI / 5)).toFixed(1)}" cy="${(128 + 36 * Math.sin(Math.PI / 5)).toFixed(1)}" r="8" fill="${GOLD_HI}"/></g>`,
      ),
  },
  {
    name: 'Hex Void',
    note: 'Two nested hexagons with a black core. Modular and engineered, like a component.',
    group: 'Geometric',
    draw: (p) => {
      const hex = (r) => pts([0, 1, 2, 3, 4, 5].map((k) => polar(r, k * 60 - 90)));
      return tile(
        p,
        `<polygon points="${hex(86)}" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linejoin="round"/>
<polygon points="${hex(52)}" fill="#000" stroke="${GOLD}" stroke-opacity=".45" stroke-width="2" stroke-linejoin="round"/>`,
      );
    },
  },
  {
    name: 'Black Sun',
    note: 'A dark sun sets on a gold horizon, with its reflection fading below.',
    group: 'Geometric',
    draw: (p) =>
      tile(
        p,
        `<defs><radialGradient id="${p}sky" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="${GOLD}" stop-opacity=".45"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
<rect x="8" y="8" width="240" height="140" rx="54" fill="url(#${p}sky)"/>
<path d="M76,142 A52,52 0 0,1 180,142 Z" fill="#000" stroke="${GOLD}" stroke-width="2.5"/>
<line x1="34" y1="142" x2="222" y2="142" stroke="${GOLD_HI}" stroke-width="3" stroke-linecap="round"/>
<g stroke="${GOLD}" stroke-linecap="round"><line x1="84" y1="158" x2="172" y2="158" stroke-width="3" stroke-opacity=".6"/><line x1="98" y1="172" x2="158" y2="172" stroke-width="3" stroke-opacity=".4"/><line x1="112" y1="186" x2="144" y2="186" stroke-width="3" stroke-opacity=".22"/></g>`,
      ),
  },
  {
    name: 'Comet Halo',
    note: 'A ring of dots fading round the circle, like a loading spinner frozen in gold.',
    group: 'Geometric',
    draw: (p) =>
      tile(
        p,
        Array.from({ length: 24 }, (_, k) => {
          const [x, y] = polar(80, k * 15 - 90);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + (k / 23) * 6).toFixed(1)}" fill="${GOLD}" fill-opacity="${(0.15 + (k / 23) * 0.85).toFixed(2)}"/>`;
        }).join('') + `<circle cx="128" cy="128" r="46" fill="#000"/>`,
      ),
  },

  // ── Variants ──────────────────────────────────────────────────────────
  { name: 'Event Horizon · Ice', note: 'Event Horizon in cold white-blue. Clinical, futuristic, and very different from Plex’s orange.', group: 'Variants', draw: eventHorizon(ICE) },
  { name: 'Event Horizon · Ultraviolet', note: 'Event Horizon in violet. Moody, nightlife, and unlike any other media app.', group: 'Variants', draw: eventHorizon(VIOLET) },
  { name: 'Negative V · Violet', note: 'The cut-out coin in violet. A bold app-store look.', group: 'Variants', draw: negativeV(VIOLET) },
  { name: 'Didone V · Bone', note: 'The serif V in off-white on black, like a fashion-house monogram.', group: 'Variants', draw: serifV(WHITE) },
  { name: 'Aperture · Silver', note: 'The aperture in brushed silver. Camera-gear understatement.', group: 'Variants', draw: aperture('#c9ccd2') },
  {
    name: 'Wordmark Tile',
    note: 'The serif V above a tiny spaced-out VANTA. Best as a brand card or splash; the word won’t survive 16 px.',
    group: 'Variants',
    draw: (p) =>
      tile(
        p,
        `<g transform="translate(128 112) scale(.72) translate(-128 -136)"><polygon points="80,80 110,80 134,184 128,196" fill="${CHAMP}"/><polygon points="172,80 180,80 131,196 128,188" fill="${CHAMP}"/><rect x="66" y="75" width="58" height="5" fill="${CHAMP}"/><rect x="160" y="75" width="34" height="5" fill="${CHAMP}"/></g>
<text x="128" y="196" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" letter-spacing="9" fill="${CHAMP}">VANTA</text>`,
      ),
  },
];

export { svg, tile, glowDef, polar, pts, GOLD, GOLD_HI, GOLD_LO, CHAMP };
