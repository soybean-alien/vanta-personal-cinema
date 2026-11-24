// Vanta by soybean_alien
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cleanTitle, collectionFolders, folderCover, Filters, Folder, Item, items, MyCollections, PlayOpts, Prefs, ResTier, Section, episodeLabel, img, isWatched, markWatched, minutes, playable, UpdateState, watchedOn } from './api';
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
  if (item.type === 'movie' || item.type === 'episode')
    e.push({ label: '🗑 Delete from disk…', action: () => askDelete(item) });
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
  money?: boolean; // movie library grid: centered title, no year
  noYear?: boolean; // TV library grid: centered title, no year (no box office)
}) {
  const ctx = useApp();
  const watched = isWatched(item);
  const group = item.type === 'show' || item.type === 'season';
  const unwatchedEps = group && item.leafCount ? item.leafCount - (item.viewedLeafCount || 0) : 0;
  const progress = item.viewOffset && item.duration ? item.viewOffset / item.duration : 0;
  const thumb = folder
    ? folderCover(folder, ctx.prefs.ui.officialCovers !== false)
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
      className={`poster ${wide ? 'wide' : ''} ${folder ? 'folder' : ''} ${folder || item.type === 'collection' ? 'col-edge' : ''} ${money ? 'money' : ''} ${noYear ? 'centered' : ''}`}
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
      <div className="title" title={money || noYear ? cleanTitle(item.title) : undefined}>{title ?? cleanTitle(item.title)}</div>
      {money && folder ? (
        <div className="sub">{folder.films.length} film{folder.films.length === 1 ? '' : 's'}</div>
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
                ? `${folder.films.length} film${folder.films.length === 1 ? '' : 's'}`
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

// "Add to collection": pick the one collection a film is in (picking another moves it there; picking its own takes it
// out), or type a name to start a new one. Remembered on this PC (electron/my-collections.cjs); nothing is written
// to Plex, and Vanta never adds a film to a collection by itself.
export function AddToCollection({ item, onClose }: { item: Item; onClose: () => void }) {
  const ctx = useApp();
  const official = ctx.prefs.ui.officialCovers !== false;
  const [mine, setMine] = useState<MyCollections>();
  const [folders, setFolders] = useState<Folder[]>();
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    window.plex.myCollections().then(setMine, () => setMine({ mine: {} }));
  }, []);
  useEffect(() => {
    collectionFolders(ctx.refresh, ctx.prefs.ui.hiddenLibs || []).then((f) => setFolders(f.all), () => setFolders([]));
  }, [ctx.refresh]);
  const has = (key: string) => !!item.guid && !!mine?.mine[key.slice(5)]?.films.includes(item.guid);
  const cols = Object.entries(mine?.mine || {})
    .map(([id, m]) => ({ key: `mine:${id}`, name: m.name, n: m.films.length, folder: folders?.find((f) => f.key === `mine:${id}`) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const name = q.trim();
  const shown = cols.filter((c) => !name || c.name.toLowerCase().includes(name.toLowerCase()));
  const exact = cols.some((c) => c.name.toLowerCase() === name.toLowerCase());
  const current = cols.find((c) => has(c.key));
  const done = (r: MyCollections | { error: string }) => {
    if ('error' in r) return setMsg(r.error);
    setMsg('');
    setMine(r);
    ctx.bump(); // the grid behind refreshes
    onClose();
  };
  const toggle = async (key: string, title: string) =>
    done(await (has(key) ? window.plex.myCollectionDrop(item.guid!, key) : window.plex.myCollectionAdd(item.guid!, key, title)));
  const create = async () => {
    if (!name || exact) return;
    done(await window.plex.myCollectionAdd(item.guid!, null, name));
    setQ('');
  };
  return (
    <Modal onClose={onClose}>
      <div className="add-col" data-nav-scope>
        <h2>Collections for “{item.title}”</h2>
        <p className="muted small">
          {current ? `In “${current.name}”. Pick another to move it, or “${current.name}” again to take it out.` : 'Not in a collection yet. Pick one, or type a name to start a new one.'}
        </p>
        <input
          data-nav
          autoFocus
          placeholder="Search your collections or name a new one..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <div className="add-col-list">
          {name && !exact && (
            <button className="add-col-row new" data-nav onClick={create}>
              <span className="add-col-name">＋ New collection “{name}”</span>
            </button>
          )}
          {!mine ? (
            <p className="muted">Loading collections...</p>
          ) : !shown.length && !name ? (
            <p className="muted">No collections yet. Type a name above to start one.</p>
          ) : (
            shown.map((c) => {
              const cover = c.folder && folderCover(c.folder, official);
              return (
                <button key={c.key} className={`add-col-row ${has(c.key) ? 'on' : ''}`} data-nav onClick={() => toggle(c.key, c.name)}>
                  <span className="add-col-check">{has(c.key) ? '✓' : ''}</span>
                  {cover && <img src={img(cover, 60, 90)} />}
                  <span className="add-col-name">{c.name}</span>
                  <span className="muted small">
                    {c.n} {c.n === 1 ? 'film' : 'films'}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {msg && <p className="music-msg">{msg}</p>}
        <button className="tool" data-nav onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// Deleting a movie or episode takes two clicks: "Delete from disk" (item menu or details page) opens this dialog,
// and here the title has to be typed (any case) before "Yes, delete it" works. Plex removes it from the library and
// deletes its files from the server's storage (electron/plex.cjs deleteItem).
export const askDelete = (item: Item) => window.dispatchEvent(new CustomEvent('vanta:delete', { detail: item }));
export function DeleteDialog({ item, onClose, onDeleted }: { item: Item; onClose: () => void; onDeleted: () => void }) {
  const [files, setFiles] = useState<string[]>();
  const [allowed, setAllowed] = useState<boolean | null>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    items(`/library/metadata/${item.ratingKey}`).then(
      ([m]) => setFiles((m?.Media || []).flatMap((x) => (x.Part || []).map((p) => p.file || '')).filter(Boolean)),
      () => setFiles([]),
    );
    window.plex.canDelete().then((r) => setAllowed(typeof r === 'boolean' ? r : null), () => setAllowed(null));
  }, [item.ratingKey]);
  const name = item.type === 'episode' ? `${item.grandparentTitle} · ${episodeLabel(item)} · ${item.title}` : cleanTitle(item.title);
  // Step 2: type the title (the episode's own title for an episode), any case, to unlock the delete button.
  const want = item.type === 'episode' ? item.title : cleanTitle(item.title);
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const [typed, setTyped] = useState('');
  const match = !!want && norm(typed) === norm(want);
  const del = async () => {
    if (!match || busy || allowed === false) return;
    setBusy(true);
    setMsg('');
    const r = await window.plex.deleteItem(item.ratingKey);
    setBusy(false);
    if ('error' in r) return setMsg(r.error);
    onDeleted();
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <div className="add-col delete-dialog" data-nav-scope>
        <h2>Delete “{name}”?</h2>
        <p>
          This removes it from your library <b>and deletes {files && files.length > 1 ? `its ${files.length} files` : 'its file'} from the server’s storage</b>. It
          can’t be undone.
        </p>
        <div className="delete-files">{files === undefined ? 'Finding the file...' : files.length ? files.map((f) => <div key={f}>{f}</div>) : 'No file listed for this item.'}</div>
        {allowed === false && (
          <p className="music-msg">
            Your Plex server doesn’t allow deleting media yet. Turn on “Allow media deletion” in the server’s Settings → Library, then try again.
          </p>
        )}
        <label className="delete-confirm">
          <span>
            Type <b>{want}</b> to confirm:
          </span>
          <input
            data-nav
            data-autofocus
            value={typed}
            placeholder={want}
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && del()}
          />
        </label>
        {msg && <p className="music-msg">{msg}</p>}
        <div className="delete-actions">
          <button className="tool" data-nav onClick={onClose}>
            Cancel
          </button>
          <button className="tool danger" data-nav disabled={!match || busy || allowed === false} onClick={del}>
            {busy ? 'Deleting...' : '🗑 Yes, delete it'}
          </button>
        </div>
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