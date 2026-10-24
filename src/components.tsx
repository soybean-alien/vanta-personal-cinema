// Vanta by soybean_alien
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BoxOffice, collectionFolders, Filters, Folder, Item, items, MyCollections, PlayOpts, Prefs, ResTier, Section, episodeLabel, img, isWatched, markWatched, minutes, playable, UpdateState, watchedOn } from './api';
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
  | { kind: 'continue' }
  | { kind: 'music' }
  | { kind: 'person'; person: import('./api').Person; job: 'actor' | 'director' | 'writer'; life?: import('./api').Life }
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
  if ((item.type === 'movie' || item.type === 'episode') && item.guid)
    e.push({
      label: '💬 Add subtitle file…',
      action: async () => {
        const r = await window.plex.subsImport({ guid: item.guid, title: item.title });
        if (r.error) ctx.error(r.error);
      },
    });
  if (item.type === 'movie' && item.guid)
    e.push({ label: '🗂 Add to collection…', action: () => window.dispatchEvent(new CustomEvent('vanta:add-to-collection', { detail: item })) });
  if (item.type === 'episode' && item.grandparentRatingKey)
    e.push({ label: '📺 Go to show', action: () => ctx.open({ kind: 'item', ratingKey: item.grandparentRatingKey! }) });
  if (item.type === 'episode' && item.parentRatingKey)
    e.push({ label: '📂 Go to season', action: () => ctx.open({ kind: 'item', ratingKey: item.parentRatingKey! }) });
  if (item.type !== 'collection' && item.type !== 'playlist') {
    e.push({
      label: watched ? '○ Mark as unwatched' : '✓ Mark as watched',
      action: async () => {
        try {
          await markWatched(item.ratingKey, !watched, item);
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
  money,
  noYear,
}: {
  item: Item;
  wide?: boolean;
  onClick?: () => void;
  title?: string;
  sub?: string;
  res?: ResTier | null; // file resolution tag (library grid only)
  folder?: Folder; // a collection folded into the movie grid: stacked first-film poster
  money?: boolean; // movie library grid: box office line under the cover, centered title, no year
  noYear?: boolean; // TV library grid: centered title, no year (no box office)
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
      className={`poster ${wide ? 'wide' : ''} ${folder ? 'folder' : ''} ${money ? 'money' : ''} ${noYear ? 'centered' : ''}`}
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
        {thumb && <img loading="lazy" src={wide ? img(thumb, 400, 225) : (ctx.prefs.ui.posterSize ?? 0) > 200 ? img(thumb, 480, 720) : img(thumb, 240, 360)} />}
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
      {money && <BoxOfficeLine films={folder ? folder.films : [item]} total={!!folder} />}
      <div className="title" title={money || noYear ? item.title : undefined}>{title ?? item.title}</div>
      {money && folder ? (
        <div className="sub">{folder.films.length} films</div>
      ) : money || noYear ? (
        watchedOn(item) && (
          <div className="sub">
            <span className="watched-on" title="Last watched">
              ✓ {watchedOn(item)}
            </span>
          </div>
        )
      ) : (
      <div className={`sub ${!folder && watchedOn(item) ? 'with-date' : ''}`}>
        <span className="sub-text">
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
        </span>
        {!folder && watchedOn(item) && (
          <span className="watched-on" title="Last watched">
            ✓ {watchedOn(item)}
          </span>
        )}
      </div>
      )}
    </div>
  );
}

// The box office box under a movie cover: "13M - 21M - 64M" = budget - US opening weekend - worldwide gross, with
// unknown numbers left out (the box keeps its full width either way). A collection folder's box shows the worldwide
// gross of all its films together. Looked up once the poster scrolls near the screen.
// Under $1,000 is a placeholder some databases store, not a real figure.
const known = (n: number | null): n is number => !!n && n >= 1000;
const money = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e7 ? `${Math.round(n / 1e6)}M` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}K`);
const dollarsLong = (n: number | null) => (known(n) ? `$${n.toLocaleString()}` : 'unknown');

function BoxOfficeLine({ films, total }: { films: Item[]; total: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bo, setBo] = useState<(BoxOffice | null)[]>();
  const keys = films.map((f) => f.ratingKey).join(',');
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.plex.boxOffice) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        Promise.all(
          keys.split(',').map((k) =>
            window.plex.boxOffice!(k).then(
              (r) => (r && !('error' in r) ? r : null),
              () => null,
            ),
          ),
        ).then((r) => alive && setBo(r));
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [keys]);
  if (!window.plex.boxOffice) return null;

  let text = '';
  let tip = total ? 'Worldwide gross of the whole collection' : 'Budget - opening weekend (US) - worldwide gross';
  if (bo && total) {
    const each = films.map((f, i) => ({ title: f.title, n: bo[i]?.worldwide ?? null }));
    const sum = each.reduce((a, x) => a + (known(x.n) ? x.n : 0), 0);
    text = known(sum) ? money(sum) : '';
    tip = `Worldwide gross of the collection: ${dollarsLong(sum)}\n${each.map((x) => `${x.title}: ${dollarsLong(x.n)}`).join('\n')}`;
  } else if (bo?.[0]) {
    const b = bo[0];
    text = [b.budget, b.opening, b.worldwide].filter(known).map(money).join(' - ');
    tip = `Budget: ${dollarsLong(b.budget)}\nOpening weekend (US): ${dollarsLong(b.opening)}\nWorldwide gross: ${dollarsLong(b.worldwide)}${b.src.length ? `\nFrom ${b.src.join(' and ')}` : ''}`;
  }
  return (
    <div ref={ref} className={`box-office ${bo === undefined ? 'loading' : ''}`} title={tip}>
      {bo === undefined ? '· · ·' : text || ' '}
    </div>
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

// A row that scrolls sideways: trackpads (deltaX) and Shift+wheel move it (a plain wheel keeps scrolling the page),
// ‹ › arrows appear only when something is off-screen that way, and page dots show where you are. Keyboard and
// controller focus scrolls it too, since its children are [data-nav].
export function ScrollRow({ children, className = '', trackClass, count }: { children: React.ReactNode; className?: string; trackClass: string; count: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const update = () => {
    const el = track.current;
    if (!el) return;
    setPages(Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.02)));
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  useEffect(() => {
    const el = track.current!;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const wheel = (e: WheelEvent) => {
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      if (!dx || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += dx;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', wheel);
    };
  }, [count]);
  const step = (dir: number) => track.current!.scrollBy({ left: dir * track.current!.clientWidth * 0.9, behavior: 'smooth' });
  return (
    <>
      <div className={`scroll-row ${className}`}>
        {page > 0 && (
          <button className="row-arrow left" data-nav aria-label="Previous" onClick={() => step(-1)}>
            ‹
          </button>
        )}
        <div className={trackClass} ref={track} onScroll={update}>
          {children}
        </div>
        {page < pages - 1 && (
          <button className="row-arrow right" data-nav aria-label="Next" onClick={() => step(1)}>
            ›
          </button>
        )}
      </div>
      {pages > 1 && (
        <div className="row-dots" aria-hidden>
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={i === page ? 'on' : ''} />
          ))}
        </div>
      )}
    </>
  );
}

// "Add to collection": put one film into a series folder (Plex's, TMDB's or yours) or start a new one. For the
// films TMDB missed. Remembered on this PC (electron/my-collections.cjs); nothing is written to Plex.
export function AddToCollection({ item, onClose }: { item: Item; onClose: () => void }) {
  const ctx = useApp();
  const [folders, setFolders] = useState<Folder[]>();
  const [mine, setMine] = useState<MyCollections>();
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    // Grid items don't carry their library id (Plex puts it on the list, not each film), so ask for the film itself.
    (async () => {
      let section = item.librarySectionID;
      if (section == null) section = (await items(`/library/metadata/${item.ratingKey}`).catch(() => []))[0]?.librarySectionID;
      if (section == null) return setFolders([]);
      collectionFolders(String(section), ctx.refresh).then((f) => setFolders(f.all), () => setFolders([]));
    })();
    window.plex.myCollections().then(setMine);
  }, []);
  const current = mine && item.guid ? mine.assign[item.guid] : undefined;
  const inNow = folders?.find((f) => f.films.some((x) => x.ratingKey === item.ratingKey));
  // The grid refreshes behind the closed picker, which shows the film in its new folder.
  const done = (r: MyCollections | { error: string }) => {
    if ('error' in r) return setMsg(r.error);
    ctx.bump();
    onClose();
  };
  const pick = async (f: Folder) => done(await window.plex.myCollectionAssign(item.guid!, f.key, f.col.title));
  const create = async () => done(await window.plex.myCollectionAssign(item.guid!, null, q.trim()));
  const shown = (folders || []).filter((f) => !q.trim() || f.col.title.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = shown.some((f) => f.col.title.toLowerCase() === q.trim().toLowerCase());
  return (
    <Modal onClose={onClose}>
      <div className="add-col" data-nav-scope>
        <h2>Add “{item.title}” to a collection</h2>
        <p className="muted small">{inNow ? `Now in: ${inNow.col.title}.` : 'Not in a collection yet.'} Pick one, or type a name to start a new one.</p>
        <input data-nav autoFocus placeholder="Search collections or name a new one..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="add-col-list">
          {q.trim() && !exact && (
            <button className="add-col-row new" data-nav onClick={create}>
              <span className="add-col-name">＋ New collection “{q.trim()}”</span>
            </button>
          )}
          {!folders ? (
            <p className="muted">Loading collections...</p>
          ) : !shown.length && !q.trim() ? (
            <p className="muted">No collections in this library yet. Type a name above to start one.</p>
          ) : (
            shown.map((f) => (
              <button key={f.key} className={`add-col-row ${inNow?.key === f.key ? 'on' : ''}`} data-nav onClick={() => pick(f)}>
                {f.films[0]?.thumb && <img src={img(f.films[0].thumb, 60, 90)} />}
                <span className="add-col-name">{f.col.title}</span>
                <span className="muted small">
                  {f.films.length} {f.films.length === 1 ? 'film' : 'films'} · {f.source === 'mine' ? 'Yours' : f.source === 'tmdb' ? 'TMDB' : 'Plex'}
                </span>
              </button>
            ))
          )}
        </div>
        {current && (
          <button
            className="tool"
            data-nav
            onClick={async () => done(await window.plex.myCollectionUnassign(item.guid!))}
          >
            ✕ Undo my choice ({current.name || 'collection'})
          </button>
        )}
        {msg && <p className="music-msg">{msg}</p>}
      </div>
    </Modal>
  );
}

// Full backup and restore (electron/backup.cjs). Used in Settings → Your data and on a fresh install's sign-in
// screen, so a new PC can come back exactly as the old one was without signing in or setting anything up.
// The UI's own local storage (each library's sort and filters) travels in the file too.
const uiStorage = () => {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      out[k] = localStorage.getItem(k) ?? '';
    }
  } catch {}
  return out;
};
export function BackupPanel({ firstRun }: { firstRun?: boolean }) {
  const [msg, setMsg] = useState('');
  const [password, setPassword] = useState('');
  const [needs, setNeeds] = useState(''); // file waiting for its password
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    setMsg('Choose where to save the backup...');
    const r = await window.plex.exportBackup({ password: password || undefined, uiStorage: uiStorage() });
    setBusy(false);
    if (r.error) return setMsg(r.error);
    if (r.canceled) return setMsg('');
    setMsg(
      `Saved ${r.badges} badges, ${r.watched} last-watched dates, ${r.collections} collection choices and ${r.subtitles ?? 0} subtitles, plus every setting and cache, to ${r.file}. ` +
        (r.secrets ? 'Sign-ins and keys are inside, locked with your password.' : 'No password was set, so sign-ins and keys were left out.'),
    );
  };
  const doImport = async (again?: boolean) => {
    setBusy(true);
    setMsg(again ? 'Unlocking...' : 'Choose a backup file...');
    const r = await window.plex.importBackup({ again, password: again ? password : undefined });
    setBusy(false);
    if (r.error) return setMsg(r.error);
    if (r.canceled) return setMsg('');
    if (r.needsPassword) {
      setNeeds(r.file!);
      return setMsg('This backup holds sign-ins and keys. Enter its password, then Unlock and restore.');
    }
    try {
      for (const [k, v] of Object.entries(r.uiStorage || {})) localStorage.setItem(k, v as string);
    } catch {}
    setNeeds('');
    setMsg(
      `Restored the backup from ${r.from ? new Date(r.from).toLocaleString() : 'file'}: ${r.badgesAdded} badges, ${r.watchedAdded} last-watched dates, ${r.collectionsAdded} collection choices and ${r.subtitlesAdded ?? 0} subtitles added` +
        `${r.secrets ? ', sign-ins and keys restored' : ''}. Vanta is restarting...`,
    );
    setTimeout(() => window.plex.restartApp(), 2500);
  };

  return (
    <div className="backup">
      <div className="pin-row">
        <input
          data-nav
          type="password"
          placeholder={needs ? 'Backup password' : firstRun ? 'Backup password (if it has one)' : 'Password to lock sign-ins and keys (recommended)'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="pin-row">
        {!firstRun && !needs && (
          <button className="tool" data-nav disabled={busy} onClick={doExport}>
            ⭳ Export backup
          </button>
        )}
        {needs ? (
          <button className="play" data-nav disabled={busy || !password} onClick={() => doImport(true)}>
            Unlock and restore
          </button>
        ) : (
          <button className={firstRun ? 'tool' : 'tool'} data-nav disabled={busy} onClick={() => doImport()}>
            ⭱ Restore from backup
          </button>
        )}
      </div>
      <p className="muted small">
        {msg ||
          (firstRun
            ? 'Moving from another PC? Restore its Vanta backup to bring back your sign-in, badges, watch dates, collections and settings, with nothing to set up.'
            : 'One file with everything Vanta keeps: badges, when you last watched each title, your collections, every setting and each library’s filters. With a password, your Plex sign-in and TMDB, Trakt, OMDb and Spotify keys go in too (encrypted), so a new PC needs no setup at all. Keep it somewhere safe, like another drive or a cloud folder. Restoring adds to what is here; nothing is lost.')}
      </p>
    </div>
  );
}

// The top of the sidebar: Continue Watching, every visible library and Music, in the viewer's own order
// (prefs.ui.navOrder, set in Settings → Sidebar). Entries the order doesn't mention yet (a new library) go last.
export interface NavEntry {
  id: string; // 'continue' | 'music' | 'lib:<section key>'
  view: View;
  icon: string;
  label: string;
  section?: Section;
}
export function navEntries(sections: Section[], hiddenLibs: string[], order?: string[]): NavEntry[] {
  const all: NavEntry[] = [
    { id: 'continue', view: { kind: 'continue' }, icon: '⏯', label: 'Continue Watching' },
    ...sections
      .filter((s) => !hiddenLibs.includes(s.key))
      .map((s): NavEntry => ({ id: `lib:${s.key}`, view: { kind: 'library', section: s }, icon: s.type === 'movie' ? '🎬' : '📺', label: s.title, section: s })),
    { id: 'music', view: { kind: 'music' }, icon: '🎵', label: 'Music' },
  ];
  const rank = (e: NavEntry) => {
    const i = (order || []).indexOf(e.id);
    return i < 0 ? 1000 + all.indexOf(e) : i;
  };
  return [...all].sort((a, b) => rank(a) - rank(b));
}

// Color themes: each swaps the palette tokens in styles.css (:root[data-theme]); layout never changes.
// swatch = [background, panel, accent] for the picker.
export const THEMES: { id: string; name: string; swatch: [string, string, string] }[] = [
  { id: 'vanta', name: 'Vanta Gold', swatch: ['#0f1115', '#161920', '#e5a00d'] },
  { id: 'oled', name: 'OLED Black', swatch: ['#000000', '#080808', '#e5a00d'] },
  { id: 'midnight', name: 'Midnight Blue', swatch: ['#0b1020', '#121a30', '#5b8cff'] },
  { id: 'ice', name: 'Glacier', swatch: ['#0c1214', '#121a1d', '#4fd6e8'] },
  { id: 'emerald', name: 'Emerald', swatch: ['#0b120f', '#111b16', '#2fd07a'] },
  { id: 'amethyst', name: 'Amethyst', swatch: ['#100c16', '#181222', '#a66bff'] },
  { id: 'crimson', name: 'Crimson', swatch: ['#120c0d', '#1b1113', '#e0383e'] },
  { id: 'sunset', name: 'Sunset', swatch: ['#140d0c', '#1d1311', '#ff7a3d'] },
  { id: 'sand', name: 'Desert Sand', swatch: ['#14110d', '#1c1813', '#dcc9a8'] },
];
export const applyTheme = (id?: string) => {
  if (!id || id === 'vanta') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
};

// Poster size for every poster grid, as a CSS variable so dragging resizes the covers live (no apply step).
export const POSTER_MIN = 90;
export const POSTER_MAX = 340;
export const POSTER_DEFAULT = 150;
export const applyPosterSize = (px: number) => document.documentElement.style.setProperty('--poster', `${px}px`);

// The library header's size slider: small covers (many per row) on the left, big ones (a few) on the right.
// The value is saved shortly after you stop moving it. Keyboard arrows adjust it; a controller's left/right does too.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function PosterSize() {
  const ctx = useApp();
  const [v, setV] = useState(ctx.prefs.ui.posterSize ?? POSTER_DEFAULT);
  const set = (px: number) => {
    const n = Math.min(POSTER_MAX, Math.max(POSTER_MIN, Math.round(px)));
    setV(n);
    applyPosterSize(n);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => ctx.setPrefs({ ui: { posterSize: n } }), 400);
  };
  return (
    <label className="poster-size" title="Cover size">
      <span className="ps-small" aria-hidden>▦</span>
      <input
        type="range"
        data-nav
        min={POSTER_MIN}
        max={POSTER_MAX}
        step={5}
        value={v}
        aria-label="Cover size"
        style={{ '--fill': `${((v - POSTER_MIN) / (POSTER_MAX - POSTER_MIN)) * 100}%` } as React.CSSProperties}
        onChange={(e) => set(Number(e.target.value))}
        onKeyDown={(e) => {
          // Controller left/right arrive as synthetic arrows, which would otherwise move focus away.
          if (!e.nativeEvent.isTrusted && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            set(v + (e.key === 'ArrowLeft' ? -15 : 15));
          }
        }}
        onDoubleClick={() => set(POSTER_DEFAULT)}
      />
      <span className="ps-big" aria-hidden>▢</span>
    </label>
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