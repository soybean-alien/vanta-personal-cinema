// Vanta by soybean_alien
// Badges UI: medallion art, unlock chimes, the unlock toast and the sidebar showcase.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import CATALOG from '../electron/badge-catalog.json';

// Rarity is designed per badge (how much effort it takes), never rolled. One color language everywhere.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export interface BadgeDef {
  id: string;
  name: string;
  rarity: Rarity;
  emblem: string;
  earned: string;
  secret?: boolean;
  hint?: string;
  unreleased?: boolean;
  special?: 'golden' | 'purple'; // full-color ticket: golden = current Patron, purple = Previous Patron
  variant?: string; // set by the engine when a badge shows an alternate state (Patron 'lapsed')
  variants?: Record<string, Partial<BadgeDef>>;
  category?: string;
}
export interface BadgeState {
  dev?: boolean; // development build (enables dev-only grants)
  catalog: BadgeDef[];
  earned: Record<string, { at: number }>;
  favorites: string[];
  minutes: number;
  progress?: Record<string, { cur: number; max: number; unit: string }>;
}

export const CATALOG_BY_ID: Record<string, BadgeDef> = Object.fromEntries((CATALOG as BadgeDef[]).map((b) => [b.id, b]));
// 'patron:lapsed' style ids pick a variant (used by previews); plain ids are the catalog entry.
export function defFor(key: string): BadgeDef | undefined {
  const [id, variant] = key.split(':');
  const b = CATALOG_BY_ID[id];
  return b && variant && b.variants?.[variant] ? { ...b, ...b.variants[variant], variant } : b;
}
const CATALOG_INDEX: Record<string, number> = Object.fromEntries((CATALOG as BadgeDef[]).map((b, i) => [b.id, i]));

// ── Art ────────────────────────────────────────────────────────────────
export const RARITY: Record<Rarity, { color: string; lo: string; hi: string; glint: string; label: string }> = {
  common: { color: '#8a9099', lo: '#5f646c', hi: '#d6dade', glint: '#ffffff', label: 'Common' },
  uncommon: { color: '#2f9e4f', lo: '#1c6a33', hi: '#7fdc95', glint: '#e2ffe9', label: 'Uncommon' },
  rare: { color: '#3d6df2', lo: '#23449f', hi: '#93b2ff', glint: '#e6eeff', label: 'Rare' },
  epic: { color: '#9a3df0', lo: '#5c1f99', hi: '#d2a6ff', glint: '#f4e8ff', label: 'Epic' },
  legendary: { color: '#ff8a00', lo: '#a85700', hi: '#ffc46b', glint: '#fff2d9', label: 'Legendary' },
};
export const rarityLabel = (r: Rarity) => RARITY[r].label;
// Emblems drawn in a 100x100 box centred on (50,50), in the rarity highlight.
const EMBLEMS: Record<string, (c: string) => string> = {
  spark: (c) => `<path d="M50 24 Q53 47 76 50 Q53 53 50 76 Q47 53 24 50 Q47 47 50 24Z" fill="${c}"/><circle cx="66" cy="34" r="3" fill="${c}"/>`,
  ticket: (c) =>
    `<path d="M28 36 H72 V44 A6 6 0 0 0 72 56 V64 H28 V56 A6 6 0 0 0 28 44Z" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><line x1="40" y1="38" x2="40" y2="62" stroke="${c}" stroke-width="3" stroke-dasharray="3 3"/><path d="M50 44 L55 54 L60 44" fill="none" stroke="${c}" stroke-width="3.5"/>`,
  popcorn: (c) =>
    `<path d="M34 46 H66 L61 74 H39Z" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><line x1="45" y1="48" x2="47" y2="72" stroke="${c}" stroke-width="3"/><line x1="55" y1="48" x2="53" y2="72" stroke="${c}" stroke-width="3"/><circle cx="40" cy="40" r="6" fill="${c}"/><circle cx="50" cy="35" r="7" fill="${c}"/><circle cx="60" cy="40" r="6" fill="${c}"/>`,
  reels: (c) =>
    `<circle cx="38" cy="44" r="12" fill="none" stroke="${c}" stroke-width="4"/><circle cx="62" cy="44" r="12" fill="none" stroke="${c}" stroke-width="4"/><circle cx="38" cy="44" r="3" fill="${c}"/><circle cx="62" cy="44" r="3" fill="${c}"/><rect x="30" y="58" width="40" height="14" rx="3" fill="none" stroke="${c}" stroke-width="4"/>`,
  hourglass: (c) =>
    `<line x1="34" y1="26" x2="66" y2="26" stroke="${c}" stroke-width="4" stroke-linecap="round"/><line x1="34" y1="74" x2="66" y2="74" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M38 28 L62 28 L52 50 L62 72 L38 72 L48 50Z" fill="none" stroke="${c}" stroke-width="3.5" stroke-linejoin="round"/><path d="M42 70 L58 70 L50 60Z" fill="${c}"/>`,
  moon: (c) => `<path d="M58 26 A24 24 0 1 0 74 60 A18 18 0 1 1 58 26Z" fill="${c}"/><circle cx="68" cy="34" r="2.5" fill="${c}"/><circle cx="74" cy="44" r="1.8" fill="${c}"/>`,
  stack: (c) =>
    `<rect x="30" y="56" width="40" height="12" rx="3" fill="${c}"/><rect x="33" y="42" width="34" height="11" rx="3" fill="none" stroke="${c}" stroke-width="3.5"/><rect x="36" y="29" width="28" height="10" rx="3" fill="none" stroke="${c}" stroke-width="3.5"/>`,
  compass: (c) => `<circle cx="50" cy="50" r="23" fill="none" stroke="${c}" stroke-width="4"/><path d="M50 30 L56 50 L50 70 L44 50Z" fill="${c}"/><circle cx="50" cy="50" r="3" fill="#120f0a"/>`,
  crown: (c) => `<path d="M30 66 L28 38 L41 50 L50 32 L59 50 L72 38 L70 66Z" fill="${c}"/><rect x="30" y="68" width="40" height="5" rx="2" fill="${c}"/>`,
  heart: (c) => `<path d="M50 72 C28 58 24 44 30 36 C36 28 46 30 50 38 C54 30 64 28 70 36 C76 44 72 58 50 72Z" fill="${c}"/><path d="M38 38 C35 41 35 45 37 48" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round"/>`,
  infinity: (c) =>
    `<path d="M50 50 C44 40 30 38 28 50 C30 62 44 60 50 50 C56 40 70 38 72 50 C70 62 56 60 50 50Z" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`,
};

// Deep enamel shade per rarity (the disc behind the neon emblem).
const INK: Record<Rarity, string> = { common: '#24272c', uncommon: '#0b2b15', rare: '#0c1a44', epic: '#2a0a4a', legendary: '#3a1d00' };

// Organic wax outline around (50,50): a ring of slightly uneven radii, smoothed into a closed Catmull-Rom curve.
// Seeded by the badge id so each badge keeps its own shape everywhere it's drawn.
function waxPath(id: string, r: number) {
  let s = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 233280, 7);
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const n = 22;
  const p = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.94 + rnd() * 0.1) + (i % 4 === 0 ? r * 0.05 * rnd() : 0);
    return [50 + rr * Math.cos(a), 50 + rr * Math.sin(a)];
  });
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

// The badge style (the user's pick, "variant C"): a wax-seal body with a neon glow around its edge, an enamel-pin
// disc (gold rim, deep rarity enamel, one shine) pressed into it, and the emblem as neon tubing. The tubing comes
// from a filter (shape minus its eroded self = outline), so every emblem in EMBLEMS works unchanged.
// locked = an unearned silhouette (grey, no glow, emblem shape still readable); secret = a locked badge showing only '?'.
const SILHOUETTE = { color: '#3a3d44', lo: '#2a2d33', hi: '#4b4f57', glint: '#5b6069', label: '' };
function badgeSvg(badge: BadgeDef, uid: string, locked = false, secret = false) {
  const t = locked ? SILHOUETTE : RARITY[badge.rarity];
  const ink = locked ? '#1d1f23' : INK[badge.rarity];
  const wax = waxPath(badge.id, 37);
  const glyph = (EMBLEMS[badge.emblem] || EMBLEMS.spark)('#fff');
  const s = 0.6;
  const emblem = secret
    ? `<text x="50" y="59" text-anchor="middle" font-family="Segoe UI" font-size="26" font-weight="700" fill="#5b6069">?</text>`
    : locked
      ? `<g transform="translate(${50 - 50 * s} ${50 - 50 * s}) scale(${s})">${(EMBLEMS[badge.emblem] || EMBLEMS.spark)('#3d4148')}</g>`
      : `<g filter="url(#${uid}n)"><g transform="translate(${50 - 50 * s} ${50 - 50 * s}) scale(${s})">${glyph}</g></g>`;
  return `<defs>
<radialGradient id="${uid}w" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="${t.hi}"/><stop offset=".45" stop-color="${t.color}"/><stop offset="1" stop-color="${t.lo}"/></radialGradient>
<linearGradient id="${uid}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${locked ? '#5b6069' : '#fff6d6'}"/><stop offset=".45" stop-color="${locked ? '#41454d' : '#d2ab55'}"/><stop offset="1" stop-color="${locked ? '#2a2d33' : '#7a5a1a'}"/></linearGradient>
<radialGradient id="${uid}e" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${t.lo}"/><stop offset="1" stop-color="${ink}"/></radialGradient>
<filter id="${uid}g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="${uid}n" x="-40%" y="-40%" width="180%" height="180%">
<feMorphology in="SourceAlpha" operator="erode" radius="1" result="in"/><feComposite in="SourceAlpha" in2="in" operator="out" result="tube"/>
<feGaussianBlur in="tube" stdDeviation="1.6" result="blur"/><feFlood flood-color="${t.hi}"/><feComposite in2="blur" operator="in" result="glow"/>
<feFlood flood-color="${t.glint}"/><feComposite in2="tube" operator="in" result="core"/>
<feMerge><feMergeNode in="glow"/><feMergeNode in="glow"/><feMergeNode in="core"/></feMerge></filter>
<clipPath id="${uid}c"><circle cx="50" cy="50" r="22"/></clipPath></defs>
<g transform="translate(50 50) scale(1.1) translate(-50 -50)">
${locked ? '' : `<path d="${wax}" fill="none" stroke="${t.color}" stroke-width="4.5" filter="url(#${uid}g)" opacity=".95"/>`}
<path d="${wax}" fill="url(#${uid}w)"/>
<path d="${wax}" fill="none" stroke="${t.hi}" stroke-width=".8" stroke-opacity="${locked ? '.4' : '.9'}"/>
<circle cx="50" cy="50" r="30" fill="${t.lo}" opacity=".45"/>
<circle cx="50" cy="50" r="29" fill="none" stroke="${t.hi}" stroke-opacity=".35" stroke-width="1"/>
<circle cx="50" cy="51.2" r="26" fill="#000" opacity=".35"/>
<circle cx="50" cy="50" r="26" fill="url(#${uid}m)"/>
<circle cx="50" cy="50" r="22.5" fill="url(#${uid}e)"/>
${emblem}
${locked ? '' : `<g clip-path="url(#${uid}c)"><path d="M30 46 A22 22 0 0 1 53 29" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3.5" stroke-linecap="round"/></g>`}
</g>`;
}

export function BadgeArt({ badge, size = 48, locked = false, secret = false }: { badge: BadgeDef; size?: number; locked?: boolean; secret?: boolean }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      className={`badge-art ${locked ? 'locked' : ''}`}
      viewBox="0 0 100 100"
      overflow="visible"
      width={size}
      height={size}
      aria-label={badge.name}
      dangerouslySetInnerHTML={{ __html: badgeSvg(badge, uid, locked, secret) }}
    />
  );
}

// ── Unlock ticket ──────────────────────────────────────────────────────
// A flat movie ticket: rarity-colored stub (VANTA ◆ RARITY), perforation, then the main ticket with a ribbon,
// the badge name, rarity/date rows, a barcode and the medallion. One SVG serves both the in-app toast and the
// overlay drawn inside mpv during playback, so they always match.
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function wrapChars(text: string, max: number, lines = 2) {
  const out: string[] = [];
  for (const w of text.split(' ')) {
    const last = out[out.length - 1];
    if (last !== undefined && (last + ' ' + w).length <= max) out[out.length - 1] = last + ' ' + w;
    else out.push(w);
  }
  return out.slice(0, lines);
}
// One line if it fits, otherwise two lines split at the space nearest the middle (no lonely last word).
function balanced(text: string, max: number) {
  if (text.length <= max) return [text];
  const mid = text.length / 2;
  let cut = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
  return cut < 0 ? [text] : [text.slice(0, cut), text.slice(cut + 1)];
}
function barcode(seed: string, x0: number, x1: number, y: number, h: number, color: string) {
  let v = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  let x = x0;
  let out = '';
  while (x < x1) {
    v = (v * 1103515245 + 12345) >>> 0;
    const w = 1 + (v % 3);
    if ((v >> 5) % 3) out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
    x += w + 1;
  }
  return out;
}
const star = (cx: number, cy: number, r: number, fill: string) => {
  const p = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${p}" fill="${fill}"/>`;
};

export const TICKET = { w: 620, h: 240 };
export function ticketSvg({ badge, at, more = 0, preview = false, uid }: { badge: BadgeDef; at: number; more?: number; preview?: boolean; uid: string }) {
  const r = RARITY[badge.rarity];
  const date = new Date(at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const serial = `No.${String((CATALOG_INDEX[badge.id] ?? 0) + 1).padStart(4, '0')}`;
  const title = more ? `+${more} more badges` : badge.name;
  const titleSize = title.length > 18 ? 22 : title.length > 13 ? 26 : 31;
  const sub = more ? 'Visit the Badges page to see them all.' : `You've just unlocked the ${badge.name} badge!`;
  const subFit = sub.length * 6.6 > 250 ? ' textLength="250" lengthAdjust="spacingAndGlyphs"' : '';
  // Why it was earned (the catalog's `earned` text), up to two lines under the headline.
  const reason = more ? [] : balanced(badge.earned || '', 38);
  const stubName = wrapChars((more ? 'Badges unlocked' : badge.name).toUpperCase(), 11);
  const shape =
    'M12 0 H140 A10 10 0 0 0 160 0 H588 Q600 0 600 12 V204 Q600 216 588 216 H160 A10 10 0 0 0 140 216 H12 Q0 216 0 204 V12 Q0 0 12 0 Z';
  const font = "'Segoe UI', system-ui, sans-serif";
  const display = "Bahnschrift, 'Segoe UI', sans-serif";
  // Palettes: the normal light ticket, or a fully orange "golden ticket" for special badges (Patron).
  // Foiled, full-color tickets are reserved for Patron ONLY (golden = current, purple = Previous Patron).
  // Every other badge, Legendary included, uses the standard paper ticket with a rarity stub.
  const foil = badge.id === 'patron';
  const golden = foil && badge.special === 'golden';
  const purple = foil && badge.special === 'purple';
  const p = purple
    ? { paper: `url(#${uid}v)`, stub: '#4c1784', panel: 'rgba(255,255,255,0.12)', ink: '#ffffff', muted: '#e6d4ff', sub: '#f1e6ff', label: '#efe3ff', accent: '#ffffff', ribbon: '#24073f', ribbonText: '#d8b6ff', perf: '#e3ccff', disc: 'rgba(255,255,255,0.18)', stars: '#f1e3ff' }
    : golden
    ? { paper: `url(#${uid}g)`, stub: '#c46400', panel: 'rgba(255,255,255,0.16)', ink: '#3a1d00', muted: '#6e3a00', sub: '#5a2e00', label: '#4a2600', accent: '#3a1d00', ribbon: '#3a1d00', ribbonText: '#ffd27a', perf: '#fff0d0', disc: 'rgba(255,255,255,0.28)', stars: '#fff6dc' }
    : { paper: '#f6f4ef', stub: r.color, panel: '#ebe7de', ink: '#3b3b3b', muted: '#7a7a7a', sub: '#6b6b6b', label: '#4a4a4a', accent: r.color, ribbon: r.color, ribbonText: '#fff', perf: '#b8b2a6', disc: '#ddd7cb', stars: r.color };
  const inner = `<defs>
<clipPath id="${uid}c"><path d="${shape}"/></clipPath>
<linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc85a"/><stop offset=".55" stop-color="#ff9a12"/><stop offset="1" stop-color="#f07c00"/></linearGradient>
<linearGradient id="${uid}v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b779ff"/><stop offset=".55" stop-color="#8a3ae6"/><stop offset="1" stop-color="#6a22c4"/></linearGradient>
<filter id="${uid}s" x="-5%" y="-5%" width="110%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".45"/></filter></defs>
<g transform="translate(10 8)">
<path d="${shape}" fill="${p.paper}" filter="url(#${uid}s)"/>
<g clip-path="url(#${uid}c)">
  <rect x="0" y="0" width="42" height="216" fill="${p.stub}"/>
  <rect x="440" y="0" width="160" height="216" fill="${p.panel}"/>
  ${golden || purple ? '<polygon points="250,0 330,0 230,216 150,216" fill="#fff" fill-opacity=".14"/><polygon points="345,0 365,0 265,216 245,216" fill="#fff" fill-opacity=".1"/>' : ''}
</g>
<text transform="translate(27 108) rotate(-90)" text-anchor="middle" font-family="${display}" font-weight="700" font-size="15" letter-spacing="3" fill="#fff">${golden ? 'GOLDEN TICKET' : purple ? 'PREVIOUS PATRON' : `VANTA ◆ ${r.label.toUpperCase()}`}</text>
<svg x="66" y="12" width="58" height="58" viewBox="0 0 100 100" overflow="visible">${badgeSvg(badge, uid + 'm')}</svg>
${stubName.map((l, i) => `<text x="53" y="${90 + i * 15}" font-family="${display}" font-weight="700" font-size="12.5" fill="${p.ink}">${esc(l)}</text>`).join('')}
<text x="53" y="136" font-family="${font}" font-size="11" fill="${p.muted}">${serial}</text>
<text x="53" y="151" font-family="${font}" font-size="11" fill="${p.muted}">${date}</text>
<text x="53" y="166" font-family="${font}" font-size="11" fill="${preview ? '#c0392b' : p.muted}">${preview ? 'PREVIEW' : r.label}</text>
${barcode(badge.id + 'stub', 53, 140, 180, 18, p.ink)}
<line x1="150" y1="14" x2="150" y2="202" stroke="${p.perf}" stroke-width="1.5" stroke-dasharray="4 4"/>
<polygon points="166,18 424,18 442,33 424,48 166,48" fill="${p.ribbon}"/>
<text x="180" y="39" font-family="${display}" font-weight="700" font-size="17" letter-spacing="1.5" fill="${p.ribbonText}">${golden || purple ? 'THANK YOU!' : 'CONGRATULATIONS!'}</text>
${star(492, 34, 9, p.stars)}${star(520, 24, 12, p.stars)}${star(548, 34, 9, p.stars)}
<text x="180" y="80" font-family="${display}" font-weight="700" font-size="${titleSize}" fill="${p.ink}">${esc(title.toUpperCase())}</text>
<text x="180" y="100" font-family="${font}" font-size="13" fill="${p.sub}"${subFit}>${esc(sub)}</text>
${reason.map((l, i) => `<text x="180" y="${121 + i * 16}" font-family="${font}" font-size="13" font-style="italic" font-weight="600" fill="${p.label}">${esc(l)}</text>`).join('')}
<text x="180" y="${more ? 144 : 161}" font-family="Georgia, serif" font-size="14" fill="${p.label}">Rarity:</text>
<text x="426" y="${more ? 144 : 161}" text-anchor="end" font-family="Georgia, serif" font-size="14" font-weight="700" fill="${p.accent}">${r.label}</text>
<text x="180" y="${more ? 167 : 179}" font-family="Georgia, serif" font-size="14" fill="${p.label}">Unlocked:</text>
<text x="426" y="${more ? 167 : 179}" text-anchor="end" font-family="Georgia, serif" font-size="14" fill="${p.label}">${date}</text>
${barcode(badge.id, 180, 426, 186, 16, p.ink)}
<circle cx="520" cy="124" r="62" fill="${p.disc}"/>
<svg x="462" y="66" width="116" height="116" viewBox="0 0 100 100" overflow="visible">${badgeSvg(badge, uid + 'b')}</svg>
</g>`;  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TICKET.w} ${TICKET.h}" width="${TICKET.w}" height="${TICKET.h}">${inner}</svg>`;
}

// SVG -> raw premultiplied BGRA (base64) for mpv's overlay-add.
async function svgToBGRA(svg: string, w: number, h: number): Promise<string> {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255;
    out[i] = px[i + 2] * a; // B
    out[i + 1] = px[i + 1] * a; // G
    out[i + 2] = px[i] * a; // R
    out[i + 3] = px[i + 3];
  }
  let bin = '';
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Called from the main process when a badge toast is drawn inside the player during playback.
async function ticketBGRA(id: string, at: number, more: number, width: number) {
  const height = Math.round((width * TICKET.h) / TICKET.w);
  const svg = ticketSvg({ badge: CATALOG_BY_ID[id], at, more, uid: 't' + width });
  return { b64: await svgToBGRA(svg, width, height), w: width, h: height };
}
(window as unknown as { __vantaTicketBGRA: typeof ticketBGRA }).__vantaTicketBGRA = ticketBGRA;
// ── Chimes (original, synthesized; nothing licensed) ───────────────────
export const CHIMES: [string, string][] = [
  ['ember', 'Ember (warm keys)'],
  ['temple', 'Temple (singing bowl)'],
  ['dusk', 'Dusk (deep dong)'],
  ['hearth', 'Hearth (low two-note)'],
  ['lantern', 'Lantern (wooden mallet)'],
  ['harbor', 'Harbor (distant gong)'],
  ['off', 'Off'],
];

// Builds a chime into any audio context (live or offline), starting at `now`.
// Everything here is deliberately low, soft-edged and dark: low notes, slow attacks, highs filtered off,
// and a gentle generated reverb tail. Nothing bright or alarm-like.
function scoreChime(ctx: BaseAudioContext, name: string, now: number) {
  // master: soft volume -> low-pass (removes brightness) -> dry + reverb
  const out = ctx.createGain();
  out.gain.value = 0.24; // subtle on purpose
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = name === 'lantern' ? 2200 : 1500;
  tone.Q.value = 0.4;
  out.connect(tone);
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  tone.connect(dry).connect(ctx.destination);
  // reverb: a decaying noise impulse, so the sound blooms and fades instead of stopping
  const verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 3.2);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let seed = 1234 + ch * 77;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  tone.connect(verb).connect(wet).connect(ctx.destination);

  // one partial: sine with a soft attack and a long exponential decay; `detune` adds slow warm beating
  const partial = (freq: number, at: number, dur: number, gain: number, attack = 0.04, detune = 0) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, now + at);
    g.gain.linearRampToValueAtTime(gain, now + at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    o.connect(g).connect(out);
    o.start(now + at);
    o.stop(now + at + dur + 0.1);
  };
  // a struck metal body: fundamental plus a few quiet inharmonic partials that fade faster
  const strike = (f: number, at: number, dur: number, gain: number, ratios: number[], attack = 0.04) => {
    partial(f, at, dur, gain, attack, -3);
    partial(f, at, dur, gain * 0.5, attack, 4); // the pair beats gently, like a real bowl
    ratios.forEach((r, i) => partial(f * r, at, dur * (0.55 - i * 0.12), gain * (0.22 / (i + 1)), attack));
  };

  if (name === 'temple') {
    strike(196, 0, 5.5, 0.9, [2.71, 5.15], 0.06); // G3 singing bowl
  } else if (name === 'dusk') {
    strike(130.81, 0, 4.2, 1, [2, 3.01], 0.05); // C3, round and plain
  } else if (name === 'hearth') {
    strike(220, 0, 2.6, 0.8, [2, 2.99], 0.04); // A3
    strike(174.61, 0.42, 4.0, 0.85, [2, 2.99], 0.05); // F3, lands lower and settles
  } else if (name === 'lantern') {
    // wooden mallet: quick soft knock that dies fast, under a warm sustained body
    [293.66, 220].forEach((f, i) => {
      partial(f, i * 0.28, 1.6, 0.75, 0.012);
      partial(f * 3.9, i * 0.28, 0.18, 0.12, 0.006);
    });
  } else if (name === 'harbor') {
    strike(98, 0, 6.5, 0.95, [1.48, 2.3, 3.6], 0.12); // G2 gong, slow swell
  } else {
    // ember: soft electric-piano chord, C3 E3 G3, gently staggered
    [130.81, 164.81, 196].forEach((f, i) => {
      partial(f, i * 0.05, 3.6, 0.5, 0.03, -2);
      partial(f * 2, i * 0.05, 1.4, 0.1, 0.03);
    });
  }
}
let audio: AudioContext | null = null;
export function playChime(name: string) {
  if (name === 'off') return;
  audio ??= new AudioContext();
  scoreChime(audio, name, audio.currentTime + 0.02);
}

// Renders a chime to a 16-bit stereo WAV (base64), so the sounds can be auditioned outside the app.
export async function renderChimeWav(name: string): Promise<string> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, rate * 7, rate);
  scoreChime(ctx, name, 0.02);
  const buf = await ctx.startRendering();
  const frames = buf.length;
  const view = new DataView(new ArrayBuffer(44 + frames * 4));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + frames * 4, true);
  str(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, frames * 4, true);
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  for (let i = 0; i < frames; i++) {
    view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 0x7fff, true);
    view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 0x7fff, true);
  }
  let bin = '';
  new Uint8Array(view.buffer).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
// Demo mode exposes the renderer for tools/ (auditioning chimes).
if (new URLSearchParams(location.search).has('demo')) (window as unknown as { __renderChime: typeof renderChimeWav }).__renderChime = renderChimeWav;
// ── Toast ──────────────────────────────────────────────────────────────
const SHOW_MS = 12000;
type ToastItem = { id: string; more?: number; preview?: boolean };

// Preview hook for Settings: shows the toast for a badge without earning it.
export const previewBadgeToast = (id: string) => window.dispatchEvent(new CustomEvent('vanta:badge-preview', { detail: id }));

export function BadgeToasts({ sound, onEarned }: { sound: string; onEarned: () => void }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const elapsed = useRef(0);
  const played = useRef(false);
  const hovering = useRef(false);
  const shownAt = useRef(Date.now());
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const current = queue[0];

  const enqueue = useCallback((ids: string[], preview = false) => {
    const known = ids.filter((id) => defFor(id));
    if (!known.length) return;
    // More than three at once: show the first in full, then one summary card.
    const items: ToastItem[] = known.length > 3 ? [{ id: known[0], preview }, { id: known[1], more: known.length - 1, preview }] : known.map((id) => ({ id, preview }));
    setQueue((q) => [...q, ...items]);
  }, []);

  useEffect(() => {
    const pull = async () => {
      const ids = await window.plex.takeBadges();
      if (ids.length) {
        enqueue(ids);
        onEarned();
      }
    };
    pull();
    const off = window.plex.onBadgesEarned(pull);
    // A badge drawn inside the player during playback: play the chime here and refresh the showcase.
    const offShown = window.plex.onBadgeShown(() => {
      playChime(soundRef.current);
      onEarned();
    });
    const prev = (e: Event) => enqueue([(e as CustomEvent).detail], true);
    window.addEventListener('vanta:badge-preview', prev);
    return () => {
      off();
      offShown();
      window.removeEventListener('vanta:badge-preview', prev);
    };
  }, [enqueue, onEarned]);

  // The countdown only runs while Vanta is focused and the toast isn't hovered; otherwise it stays down.
  useEffect(() => {
    if (!current) return;
    elapsed.current = 0;
    played.current = false;
    shownAt.current = Date.now();
    setPhase('in');
    const tick = setInterval(() => {
      const focused = document.hasFocus() && !document.hidden;
      if (focused && !played.current) {
        played.current = true;
        playChime(sound);
      }
      if (focused && !hovering.current) elapsed.current += 250;
      if (elapsed.current >= SHOW_MS) {
        clearInterval(tick);
        setPhase('out');
        setTimeout(() => setQueue((q) => q.slice(1)), 550);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [current, sound]);

  if (!current) return null;
  const b = defFor(current.id)!;
  const dismiss = () => {
    elapsed.current = SHOW_MS;
  };
  return (
    <div
      className={`badge-toast ${phase}`}
      role="status"
      aria-label={current.more ? `${current.more} more badges unlocked` : `Badge unlocked: ${b.name} (${rarityLabel(b.rarity)})`}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      onClick={dismiss}
      dangerouslySetInnerHTML={{ __html: ticketSvg({ badge: b, at: shownAt.current, more: current.more, preview: current.preview, uid: 'toast' }) }}
    />
  );
}
// ── Sidebar showcase ───────────────────────────────────────────────────
// Favorites (up to 6, chosen on the Badges page); until there are any, the most recent earned badges.
export function BadgeShowcase({ state }: { state?: BadgeState }) {
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  if (!state) return null;
  const earned = Object.entries(state.earned).sort((a, b) => b[1].at - a[1].at).map(([id]) => id);
  const ids = (state.favorites.length ? state.favorites : earned.slice(0, 3)).filter((id) => state.catalog.some((b) => b.id === id) || CATALOG_BY_ID[id]).slice(0, 6);
  if (!ids.length) return null;
  const show = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ id, x: r.right + 10, y: r.top + r.height / 2 });
  };
  // Lookups go through the engine's resolved catalog, so a lapsed Patron shows as Previous Patron (Epic).
  const def = (id: string) => state.catalog.find((b) => b.id === id) ?? CATALOG_BY_ID[id];
  const t = tip && def(tip.id);
  return (
    <section className="showcase" aria-label="Badge showcase">
      <button className="nav-head showcase-head" data-nav onClick={() => window.dispatchEvent(new Event('vanta:open-badges'))}>
        Badges ›
      </button>
      <div className="showcase-grid">
        {ids.map((id) => {
          const b = def(id);
          return (
            <button
              key={id}
              className="showcase-badge"
              data-nav
              onMouseEnter={(e) => show(id, e.currentTarget)}
              onMouseLeave={() => setTip(null)}
              onFocus={(e) => show(id, e.currentTarget)}
              onBlur={() => setTip(null)}
            >
              <BadgeArt badge={b} size={46} />
              <span className="showcase-name">{b.name}</span>
            </button>
          );
        })}
      </div>
      {t && (
        <div className="badge-tip" style={{ left: tip!.x, top: tip!.y }}>
          <div className="badge-tip-head">
            <b>{t.name}</b> <span className={`rarity-chip ${t.rarity}`}>{rarityLabel(t.rarity)}</span>
          </div>
          <div>{t.earned}</div>
          <div className="muted small">Earned {new Date(state.earned[t.id].at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
        </div>
      )}
    </section>
  );
}
