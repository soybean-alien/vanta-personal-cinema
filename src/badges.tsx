// Vanta by soybean_alien
// Badges UI: medallion art, unlock chimes, the unlock toast and the sidebar showcase.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import CATALOG from '../electron/badge-catalog.json';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
export interface BadgeDef {
  id: string;
  name: string;
  tier: Tier;
  emblem: string;
  earned: string;
  secret?: boolean;
  hint?: string;
}
export interface BadgeState {
  catalog: BadgeDef[];
  earned: Record<string, { at: number }>;
  favorites: string[];
  minutes: number;
}

export const CATALOG_BY_ID: Record<string, BadgeDef> = Object.fromEntries((CATALOG as BadgeDef[]).map((b) => [b.id, b]));

// ── Art ────────────────────────────────────────────────────────────────
const TIERS: Record<Tier, { lo: string; hi: string; glint: string; label: string }> = {
  bronze: { lo: '#7a4a22', hi: '#e2a56b', glint: '#ffd9b0', label: 'Bronze' },
  silver: { lo: '#7d848d', hi: '#e9edf1', glint: '#ffffff', label: 'Silver' },
  gold: { lo: '#a8740a', hi: '#ffd76a', glint: '#fff3c4', label: 'Gold' },
  platinum: { lo: '#7f9db3', hi: '#eef8ff', glint: '#d8f0ff', label: 'Platinum' },
};
export const tierLabel = (t: Tier) => TIERS[t].label;

// Emblems drawn in a 100x100 box centred on (50,50), stroked/filled with the tier highlight.
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
  infinity: (c) =>
    `<path d="M50 50 C44 40 30 38 28 50 C30 62 44 60 50 50 C56 40 70 38 72 50 C70 62 56 60 50 50Z" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`,
};

// A 12-point rosette medal: tier-metal rim, black face, metal emblem.
export function BadgeArt({ badge, size = 48, locked = false }: { badge: BadgeDef; size?: number; locked?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const t = TIERS[badge.tier];
  const points = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 ? 44 : 49;
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const emblem = locked ? `<text x="50" y="60" text-anchor="middle" font-size="30" font-weight="700" fill="${t.lo}">?</text>` : (EMBLEMS[badge.emblem] || EMBLEMS.spark)(`url(#${uid}m)`);
  const svg = `<defs>
<linearGradient id="${uid}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.hi}"/><stop offset=".45" stop-color="${t.lo}"/><stop offset=".7" stop-color="${t.hi}"/><stop offset="1" stop-color="${t.lo}"/></linearGradient>
<linearGradient id="${uid}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glint}"/><stop offset="1" stop-color="${t.hi}"/></linearGradient>
<radialGradient id="${uid}f" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#2a241a"/><stop offset="1" stop-color="#0b0906"/></radialGradient></defs>
<polygon points="${points}" fill="url(#${uid}r)"/>
<circle cx="50" cy="50" r="36" fill="url(#${uid}f)" stroke="${t.lo}" stroke-width="1.5"/>
<circle cx="50" cy="50" r="33" fill="none" stroke="${t.hi}" stroke-opacity=".35" stroke-width="1"/>
${emblem}`;
  return (
    <svg
      className={`badge-art ${locked ? 'locked' : ''}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-label={badge.name}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ── Chimes (original, synthesized; nothing licensed) ───────────────────
export const CHIMES: [string, string][] = [
  ['halo', 'Halo'],
  ['glint', 'Glint'],
  ['velvet', 'Velvet'],
  ['starlight', 'Starlight'],
  ['off', 'Off'],
];

// Builds a chime into any audio context (live or offline), starting at `now`.
function scoreChime(ctx: BaseAudioContext, name: string, now: number) {
  const out = ctx.createGain();
  out.gain.value = 0.16; // soft by design
  // gentle room: a short feedback echo
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.19;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  delay.connect(fb).connect(delay);
  out.connect(ctx.destination);
  out.connect(delay).connect(ctx.destination);

  const tone = (freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 1, attack = 0.015) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, now + at);
    g.gain.linearRampToValueAtTime(gain, now + at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    o.connect(g).connect(out);
    o.start(now + at);
    o.stop(now + at + dur + 0.05);
  };
  // bell = fundamental + inharmonic partials
  const bell = (f: number, at: number, dur: number, gain = 1) => {
    tone(f, at, dur, 'sine', gain);
    tone(f * 2.76, at, dur * 0.5, 'sine', gain * 0.18);
    tone(f * 5.4, at, dur * 0.25, 'sine', gain * 0.06);
  };

  if (name === 'halo') {
    bell(659.25, 0, 1.6, 0.9); // E5
    bell(987.77, 0.13, 2.0, 0.8); // B5
    tone(1975.5, 0.13, 1.2, 'sine', 0.08);
  } else if (name === 'glint') {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, i * 0.075, 0.7, 'triangle', 0.5 - i * 0.07));
  } else if (name === 'velvet') {
    [440, 554.37, 659.25].forEach((f) => tone(f, 0, 1.8, 'sine', 0.42, 0.18));
    bell(1760, 0.32, 1.2, 0.35);
  } else {
    bell(783.99, 0, 1.0, 0.7); // G5
    bell(1174.66, 0.11, 1.2, 0.7); // D6
    bell(1567.98, 0.24, 1.8, 0.75); // G6
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
  const ctx = new OfflineAudioContext(2, rate * 3.2, rate);
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
  const current = queue[0];

  const enqueue = useCallback((ids: string[], preview = false) => {
    const known = ids.filter((id) => CATALOG_BY_ID[id]);
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
    const prev = (e: Event) => enqueue([(e as CustomEvent).detail], true);
    window.addEventListener('vanta:badge-preview', prev);
    return () => {
      off();
      window.removeEventListener('vanta:badge-preview', prev);
    };
  }, [enqueue, onEarned]);

  // The countdown only runs while Vanta is focused and the toast isn't hovered; otherwise it stays down.
  useEffect(() => {
    if (!current) return;
    elapsed.current = 0;
    played.current = false;
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
  const b = CATALOG_BY_ID[current.id];
  const dismiss = () => {
    elapsed.current = SHOW_MS;
  };
  return (
    <div
      className={`badge-toast ${phase}`}
      role="status"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      onClick={dismiss}
    >
      <BadgeArt badge={b} size={78} />
      <div className="badge-toast-text">
        {current.more ? (
          <>
            <div className="badge-toast-kicker">And that's not all</div>
            <div className="badge-toast-line">
              You've unlocked <b>{current.more} more badges</b>!
            </div>
          </>
        ) : (
          <>
            <div className="badge-toast-kicker">
              Congratulations! · {tierLabel(b.tier)}
              {current.preview ? ' · preview' : ''}
            </div>
            <div className="badge-toast-line">
              You've just unlocked the <b>{b.name}</b> badge!
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sidebar showcase ───────────────────────────────────────────────────
// Favorites (up to 6, chosen on the Badges page); until there are any, the most recent earned badges.
export function BadgeShowcase({ state }: { state?: BadgeState }) {
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  if (!state) return null;
  const earned = Object.entries(state.earned).sort((a, b) => b[1].at - a[1].at).map(([id]) => id);
  const ids = (state.favorites.length ? state.favorites : earned.slice(0, 3)).filter((id) => CATALOG_BY_ID[id]).slice(0, 6);
  if (!ids.length) return null;
  const show = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ id, x: r.right + 10, y: r.top + r.height / 2 });
  };
  const t = tip && CATALOG_BY_ID[tip.id];
  return (
    <section className="showcase" aria-label="Badge showcase">
      <div className="nav-head">Badges</div>
      <div className="showcase-grid">
        {ids.map((id) => {
          const b = CATALOG_BY_ID[id];
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
            <b>{t.name}</b> <span className={`tier-chip ${t.tier}`}>{tierLabel(t.tier)}</span>
          </div>
          <div>{t.earned}</div>
          <div className="muted small">Earned {new Date(state.earned[t.id].at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
        </div>
      )}
    </section>
  );
}
