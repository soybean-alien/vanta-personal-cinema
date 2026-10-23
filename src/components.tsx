// Vanta by soybean_alien
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Filters, Folder, Item, PlayOpts, Prefs, ResTier, Section, episodeLabel, img, isWatched, markWatched, minutes, playable, UpdateState } from './api';
import { focusEl, focusFirst, focusLost } from './nav';

// When a view finishes loading and nothing useful has focus (keyboard/controller just opened it),
// put focus on its main action or first poster.
export function useAutoFocus(ready: boolean) {
  useEffect(() => {
    if (ready && focusLost()) setTimeout(() => focusLost() && focusFirst(), 0);
  }, [ready]);
}

export type View =
  | { kind: 'library'; section: Section; filters?: Filters; pinId?: string }
  | { kind: 'collections'; section: Section }
  | { kind: 'item'; ratingKey: string }
  | { kind: 'folder'; folder: Folder }
  | { kind: 'playlist'; ratingKey: string; title: string }
  | { kind: 'search' }
  | { kind: 'badges' }
  | { kind: 'badgeCategory'; category: string }
  | { kind: 'settings' };

export interface MenuEntry {
  label: string;
  action: () => void;
}

export interface Ctx {
  open(v: View): void;
  playItem(item: Item, opts?: PlayOpts): void;
  play(ratingKey: string, opts?: PlayOpts): void;
  menu(x: number, y: number, entries: MenuEntry[]): void;
  bump(): void;
  error(msg: string): void;
  refresh: number;
  prefs: Prefs;
  setPrefs(patch: Parameters<Window['plex']['setPrefs']>[0]): void;
  sections: Section[];
}

export const AppCtx = createContext<Ctx>(null!);

// Live updater state (pushed from the main process).
export function useUpdate() {
  const [u, setU] = useState<UpdateState>();
  useEffect(() => {
    window.plex.updateState().then(setU);
    return window.plex.onUpdate(setU);
  }, []);
  return [u, setU] as const;
}
export const useApp = () => useContext(AppCtx);

// A movie-grid folder (a Plex or TMDB collection): its films play in release order.
export const playFolder = (ctx: Ctx, f: Folder, shuffle?: boolean) =>
  ctx.play(f.films[0].ratingKey, { queue: f.films.map((i) => i.ratingKey), shuffle });
export const folderMenu = (ctx: Ctx, f: Folder): MenuEntry[] => [
  { label: '▶ Play all', action: () => playFolder(ctx, f) },
  { label: '🔀 Shuffle', action: () => playFolder(ctx, f, true) },
  { label: '🗂 Open', action: () => ctx.open({ kind: 'folder', folder: f }) },
];

// Right-click / Y-button menu entries for any library item.
export function itemMenu(ctx: Ctx, item: Item): MenuEntry[] {
  const e: MenuEntry[] = [];
  const watched = isWatched(item);
  if (playable(item)) {
    e.push({
      label: item.viewOffset ? `▶ Resume from ${Math.floor(item.viewOffset / 60000)} min` : '▶ Play',
      action: () => ctx.playItem(item),
    });
    if (item.viewOffset) e.push({ label: '⟲ Play from beginning', action: () => ctx.playItem(item, { fromStart: true }) });
  } else if (item.type === 'show' || item.type === 'season') {
    e.push({ label: '▶ Play next episode', action: () => ctx.playItem(item) });
  } else if (item.type === 'collection') {
    e.push({ label: '▶ Play all', action: () => ctx.playItem(item) });
    e.push({ label: '🔀 Shuffle', action: () => ctx.playItem(item, { shuffle: true }) });
  }
  e.push({ label: 'ℹ Details', action: () => ctx.open({ kind: 'item', ratingKey: item.ratingKey }) });
  if (item.type === 'episode' && item.grandparentRatingKey)
    e.push({ label: '📺 Go to show', action: () => ctx.open({ kind: 'item', ratingKey: item.grandparentRatingKey! }) });
  if (item.type === 'episode' && item.parentRatingKey)
    e.push({ label: '📂 Go to season', action: () => ctx.open({ kind: 'item', ratingKey: item.parentRatingKey! }) });
  if (item.type !== 'collection' && item.type !== 'playlist') {
    e.push({
      label: watched ? '○ Mark as unwatched' : '✓ Mark as watched',
      action: async () => {
        try {
          await markWatched(item.ratingKey, !watched);
          ctx.bump();
        } catch (err: any) {
          ctx.error(err.message);
        }
      },
    });
    if (!watched && item.viewOffset)
      e.push({
        label: '○ Clear progress',
        action: async () => {
          await markWatched(item.ratingKey, false);
          ctx.bump();
        },
      });
  }
  return e;
}

export function Poster({
  item,
  wide,
  onClick,
  title,
  sub,
  res,
  folder,
}: {
  item: Item;
  wide?: boolean;
  onClick?: () => void;
  title?: string;
  sub?: string;
  res?: ResTier | null; // file resolution tag (library grid only)
  folder?: Folder; // a collection folded into the movie grid: stacked first-film poster
}) {
  const ctx = useApp();
  const watched = isWatched(item);
  const group = item.type === 'show' || item.type === 'season';
  const unwatchedEps = group && item.leafCount ? item.leafCount - (item.viewedLeafCount || 0) : 0;
  const progress = item.viewOffset && item.duration ? item.viewOffset / item.duration : 0;
  const thumb = folder
    ? folder.films[0].thumb || item.thumb
    : wide
    ? item.type === 'movie'
      ? item.art || item.thumb
      : item.thumb
    : item.type === 'episode'
      ? item.grandparentThumb || item.thumb
      : item.thumb || item.composite;
  const click =
    onClick || (() => ctx.open(folder ? { kind: 'folder', folder } : { kind: 'item', ratingKey: item.ratingKey }));
  return (
    <div
      className={`poster ${wide ? 'wide' : ''} ${folder ? 'folder' : ''}`}
      tabIndex={0}
      data-nav
      data-rk={item.ratingKey}
      onClick={click}
      onContextMenu={(e) => {
        e.preventDefault();
        ctx.menu(e.clientX, e.clientY, folder ? folderMenu(ctx, folder) : itemMenu(ctx, item));
      }}
    >
      <div className="art">
        {thumb && <img loading="lazy" src={wide ? img(thumb, 400, 225) : img(thumb, 240, 360)} />}
        {!watched && !group && !progress && playable(item) && <span className="dot" />}
        {unwatchedEps > 0 && <span className="badge">{unwatchedEps}</span>}
        {group && watched && <span className="check">✓</span>}
        {res && <span className={`res res-${res.tier}`}>{res.label}</span>}
        {folder && <span className="stack-count">🗂 {folder.films.length}</span>}
        {progress > 0 && (
          <div className="bar">
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className="title">{title ?? item.title}</div>
      <div className="sub">
        {sub ??
          (item.type === 'episode' && !wide
            ? episodeLabel(item)
            : wide
              ? minutes(item.duration)
              : folder
                ? `${folder.films.length} films`
                : item.type === 'collection'
                ? `${item.childCount ?? ''} items`
                : (item.year ?? ''))}
      </div>
    </div>
  );
}

// Continue Watching: in-progress movies and the next episode of shows you're watching.
export function DeckRow({ items }: { items: Item[] }) {
  const ctx = useApp();
  if (!items.length) return null;
  return (
    <section className="deck">
      <h2>Continue watching</h2>
      <div className="row">
        {items.map((i) => (
          <Poster
            key={i.ratingKey}
            item={i}
            wide
            title={i.type === 'episode' ? i.grandparentTitle : i.title}
            sub={
              i.type === 'episode'
                ? `${episodeLabel(i)} · ${i.title}`
                : i.viewOffset && i.duration
                  ? `${Math.round((i.duration - i.viewOffset) / 60000)} min left`
                  : minutes(i.duration)
            }
            onClick={() => ctx.playItem(i)}
          />
        ))}
      </div>
    </section>
  );
}

export function Menu({ x, y, entries, onClose }: { x: number; y: number; entries: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const origin = useRef(document.activeElement as HTMLElement | null);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
    focusEl(ref.current!.querySelector<HTMLElement>('[data-nav]'));
  }, [x, y]);
  const close = () => {
    onClose();
    origin.current?.focus({ preventScroll: true });
  };
  return (
    <div className="menu-backdrop" onMouseDown={close} onContextMenu={(e) => (e.preventDefault(), close())}>
      <div
        ref={ref}
        className="menu"
        data-nav-scope
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'GamepadY' || e.key === 'ContextMenu') {
            e.preventDefault();
            close();
          }
        }}
      >
        {entries.map((en) => (
          <button
            key={en.label}
            data-nav
            onClick={() => {
              close();
              en.action();
            }}
          >
            {en.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const origin = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    focusEl(ref.current!.querySelector<HTMLElement>('[data-autofocus]') || ref.current!.querySelector<HTMLElement>('[data-nav]'));
    const o = origin.current;
    return () => o?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={ref}
        className="modal"
        data-nav-scope
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

// A value picker that works with mouse (click → list), keyboard and controller (left/right cycles, A → list).
export function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const ctx = useApp();
  const idx = Math.max(
    0,
    options.findIndex(([v]) => v === value),
  );
  const step = (d: number) => onChange(options[(idx + d + options.length) % options.length][0]);
  return (
    <button
      className="choice"
      data-nav
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          step(e.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        ctx.menu(
          r.left,
          r.bottom + 4,
          options.map(([v, l]) => ({ label: (v === value ? '● ' : '   ') + l, action: () => onChange(v) })),
        );
      }}
    >
      {label && <span className="choice-label">{label}</span>}
      <span className="choice-value">‹ {options[idx]?.[1]} ›</span>
    </button>
  );
}

export function Toggle({ label, value, onChange }: { label?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle ${value ? 'on' : ''}`} data-nav onClick={() => onChange(!value)}>
      {label && <span className="choice-label">{label}</span>}
      <span className="pill">{value ? 'On' : 'Off'}</span>
    </button>
  );
}

// A sliding on/off switch. Click / Enter / A toggles; Left and Right set Off and On (controller-friendly).
export function Switch({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`switch ${value ? 'on' : ''}`}
      role="switch"
      aria-checked={value}
      data-nav
      onClick={() => onChange(!value)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          if ((e.key === 'ArrowRight') !== value) onChange(e.key === 'ArrowRight');
        }
      }}
    >
      <span className="switch-track">
        <span className="switch-knob" />
      </span>
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="switch-hint">{hint}</span>}
      </span>
    </button>
  );
}