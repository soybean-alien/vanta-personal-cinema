// Vanta by soybean_alien
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectResult, Health, Item, PlayOpts, PlayerState, Prefs, Section, User, items, nextEpisode, playable, sections } from './api';
import { AppCtx, Ctx, Menu, MenuEntry, Modal, View, useUpdate } from './components';
import { focusEl, focusFirst, installGamepad, installKeys } from './nav';
import mark from './assets/vanta-mark.svg';
import { BadgeShowcase, BadgeState, BadgeToasts, setTicketHolder } from './badges';
import { BadgeCategoryPage, BadgesPage } from './badges-page';
import { Collections, Detail, Library, Playlist, Search, Settings } from './views';

export default function App() {
  const [auth, setAuth] = useState<ConnectResult | 'loading' | 'signingIn'>('loading');

  const connect = useCallback(async () => {
    setAuth('loading');
    setAuth(await window.plex.connect());
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  if (auth === 'loading') return <Splash text="Connecting to your Plex server..." />;
  if (auth === 'signingIn') return <Splash text="Approve the sign-in in your browser, then come back here." />;
  if ('error' in auth)
    return (
      <Splash text={auth.error}>
        <button data-nav autoFocus onClick={connect}>
          Retry
        </button>
      </Splash>
    );
  if (auth.state === 'signedOut')
    return (
      <Splash text="One-time sign-in. After this the app logs you in automatically.">
        <button
          data-nav
          autoFocus
          onClick={async () => {
            setAuth('signingIn');
            setAuth(await window.plex.signIn());
          }}
        >
          Sign in with Plex
        </button>
      </Splash>
    );

  return <Shell user={auth.user} server={auth.server.name} onSignOut={async () => setAuth(await window.plex.signOut())} />;
}

function Splash({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="splash">
      <div className="logo">Vanta</div>
      <p>{text}</p>
      {children}
    </div>
  );
}

// Sidebar brand block. Layouts are picked in Settings → Account → Logo layout.
function Brand({ layout }: { layout: string }) {
  if (layout === 'seal')
    return (
      <div className="brand brand-seal">
        <svg viewBox="0 0 100 100" className="seal">
          <defs>
            <path id="seal-ring" d="M50,50 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0" />
          </defs>
          <image href={mark} x="24" y="24" width="52" height="52" />
          {/* The path starts at 9 o'clock and runs clockwise; rotating it puts VANTA's centre at 12. */}
          <text transform="rotate(41 50 50)">
            <textPath href="#seal-ring">VANTA · PRIVATE CINEMA ·</textPath>
          </text>
        </svg>
      </div>
    );
  return (
    <div className={`brand brand-${layout}`}>
      <div className="brand-markwrap">
        <img className="brand-mark" src={mark} alt="" />
        {layout === 'monogram' && <span className="brand-v">V</span>}
      </div>
      <div className="brand-text">
        <span className="brand-name">Vanta</span>
        {layout === 'tagline' && <span className="brand-tag">Private Cinema</span>}
      </div>
    </div>
  );
}

// Connection health: a coloured dot + status under the logo; click for the diagnostics behind it.
function StatusLine() {
  const [h, setH] = useState<Health>();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    window.plex.health().then(setH);
    return window.plex.onHealth(setH);
  }, []);
  if (!h) return null;
  const recheck = async () => {
    setChecking(true);
    setH(await window.plex.checkHealth());
    setChecking(false);
  };
  return (
    <>
      <button className={`status status-${h.level}`} data-nav onClick={() => setOpen(true)} title={h.detail}>
        <span className="status-dot" />
        <span className="status-text">
          <span className="status-title">{h.title}</span>
          {h.reason && <span className="status-reason">{h.reason}</span>}
        </span>
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="diag">
            <div className={`diag-head status-${h.level}`}>
              <span className="status-dot" />
              <h2>{h.title}</h2>
            </div>
            <p className="diag-detail">{h.detail}</p>
            <table className="diag-checks">
              <tbody>
                {h.checks.map((c) => (
                  <tr key={c.label} className={`status-${c.level}`}>
                    <td>
                      <span className="status-dot small" />
                    </td>
                    <th>{c.label}</th>
                    <td>{c.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions">
              <button className="play" data-nav data-autofocus disabled={checking} onClick={recheck}>
                {checking ? 'Checking…' : '⟳ Check again'}
              </button>
              <button className="tool" data-nav onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="muted small">
              Checked {h.at ? new Date(h.at).toLocaleTimeString() : 'just now'}. Vanta rechecks every 15 s (every 5 s while offline) and
              switches routes automatically if one stops answering.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

// Update notice under the connection status. It only appears when there is something to say:
// an update to download (ask mode), download progress, "restart to update", or "updated to x" once after updating.
function UpdatePill() {
  const [u, setU] = useUpdate();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string>();
  if (!u) return null;
  const justUpdated = u.justUpdated && !dismissed;
  const show = u.state === 'available' || u.state === 'downloading' || u.state === 'ready' || justUpdated;
  if (!show) return null;

  const install = async () => {
    const r = await window.plex.installUpdate();
    if (r.error) setError(r.error);
  };
  const label =
    u.state === 'downloading'
      ? `Downloading update · ${u.percent ?? 0}%`
      : u.state === 'ready'
        ? 'Restart to update'
        : u.state === 'available'
          ? 'Update available'
          : 'Updated';
  const sub = u.state === 'downloading' || u.state === 'ready' || u.state === 'available' ? `Vanta ${u.version}` : `Now on ${u.justUpdated!.version} · what's new`;

  return (
    <>
      <button
        className={`update-pill ${u.state === 'ready' ? 'ready' : ''}`}
        data-nav
        onClick={() => (u.state === 'ready' ? install() : setOpen(true))}
      >
        <span className="update-icon">{u.state === 'ready' ? '⟳' : justUpdated && u.state !== 'downloading' && u.state !== 'available' ? '✓' : '⬆'}</span>
        <span className="status-text">
          <span className="status-title">{label}</span>
          <span className="status-reason">{error || sub}</span>
        </span>
        {u.state === 'downloading' && (
          <span className="update-bar">
            <span style={{ width: `${u.percent ?? 0}%` }} />
          </span>
        )}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="diag">
            <h2>{u.state === 'available' ? `Vanta ${u.version} is available` : `Updated to Vanta ${u.justUpdated?.version}`}</h2>
            <p className="muted small">You have {u.current}. Updates install silently and keep your sign-in, settings and progress.</p>
            <pre className="notes">{(u.state === 'available' ? u.notes : u.justUpdated?.notes) || 'Bug fixes and improvements.'}</pre>
            <div className="actions">
              {u.state === 'available' ? (
                <>
                  <button
                    className="play"
                    data-nav
                    data-autofocus
                    onClick={async () => {
                      setOpen(false);
                      setU(await window.plex.downloadUpdate());
                    }}
                  >
                    ⬇ Download update
                  </button>
                  <button className="tool" data-nav onClick={() => setOpen(false)}>
                    Later
                  </button>
                </>
              ) : (
                <button
                  className="play"
                  data-nav
                  data-autofocus
                  onClick={() => {
                    setOpen(false);
                    setDismissed(true);
                  }}
                >
                  Got it
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

type Entry = { id: number; view: View; focus?: HTMLElement | null };
let nextId = 1;

function Shell({ user, server, onSignOut }: { user: User; server: string; onSignOut: () => void }) {
  const [libs, setLibs] = useState<Section[]>([]);
  const [playlists, setPlaylists] = useState<Item[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>();
  const [history, setHistory] = useState<Entry[]>([]);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const [player, setPlayer] = useState<PlayerState>({ playing: false });
  const [query, setQuery] = useState('');
  const [badgeState, setBadgeState] = useState<BadgeState>();
  const refreshBadges = useCallback(() => window.plex.badges().then(setBadgeState), []);
  useEffect(() => {
    refreshBadges();
    window.addEventListener('vanta:badges-changed', refreshBadges);
    return () => window.removeEventListener('vanta:badges-changed', refreshBadges);
  }, [refreshBadges]);
  const searchRef = useRef<HTMLInputElement>(null);
  const playingRef = useRef(false);
  const restoreRef = useRef<HTMLElement | null>(null);
  const top = history[history.length - 1];

  useEffect(() => {
    window.plex.getPrefs().then(setPrefsState);
    sections()
      .then(setLibs)
      .catch((e) => setError(e.message));
    items('/playlists?playlistType=video').then(setPlaylists, () => {});
  }, []);

  const visibleLibs = useMemo(() => libs.filter((s) => !prefs?.ui.hiddenLibs.includes(s.key)), [libs, prefs]);

  // Land on the first visible library once everything is loaded.
  useEffect(() => {
    if (!history.length && visibleLibs.length) setHistory([{ id: nextId++, view: { kind: 'library', section: visibleLibs[0] } }]);
  }, [visibleLibs]);

  const go = useCallback((view: View) => setHistory([{ id: nextId++, view }]), []);
  useEffect(() => {
    const openBadges = () => go({ kind: 'badges' });
    window.addEventListener('vanta:open-badges', openBadges);
    return () => window.removeEventListener('vanta:open-badges', openBadges);
  }, [go]);
  const open = useCallback((view: View) => {
    const focus = document.activeElement as HTMLElement | null;
    setHistory((h) => {
      if (h.length) h[h.length - 1].focus = focus;
      return [...h, { id: nextId++, view }];
    });
  }, []);
  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length <= 1) return h;
      restoreRef.current = h[h.length - 2].focus ?? null;
      return h.slice(0, -1);
    });
  }, []);

  // Put focus back where it was before the view we just left was opened.
  useEffect(() => {
    const el = restoreRef.current;
    restoreRef.current = null;
    if (el && el.isConnected) focusEl(el);
  }, [history]);

  const play = useCallback(async (ratingKey: string, opts?: PlayOpts) => {
    const r = await window.plex.play(ratingKey, opts);
    if (r.error) setError(r.error);
  }, []);

  const playItem = useCallback(
    async (item: Item, opts?: PlayOpts) => {
      try {
        if (playable(item)) return play(item.ratingKey, opts);
        if (item.type === 'show' || item.type === 'season') {
          const ep = await nextEpisode(item);
          return ep ? play(ep.ratingKey, opts) : setError('No episodes found.');
        }
        if (item.type === 'collection') {
          const queue = (await items(`/library/collections/${item.ratingKey}/children`)).filter(playable).map((i) => i.ratingKey);
          return queue.length ? play(queue[0], { ...opts, queue }) : setError('Nothing playable in this collection.');
        }
      } catch (e: any) {
        setError(e.message);
      }
    },
    [play],
  );

  useEffect(
    () =>
      window.plex.onPlayerState((s) => {
        playingRef.current = s.playing;
        setPlayer(s);
        if (s.error) setError(s.error);
        if (s.refresh) setRefresh((n) => n + 1);
      }),
    [],
  );

  const sidebarTargets = useMemo<View[]>(
    () => [
      ...visibleLibs.map((section) => ({ kind: 'library', section }) as View),
      ...(prefs?.ui.pins || []).flatMap((pin) => {
        const section = libs.find((s) => s.key === pin.sectionKey);
        return section ? [{ kind: 'library', section, filters: pin.filters, pinId: pin.id } as View] : [];
      }),
    ],
    [visibleLibs, libs, prefs],
  );

  const sameTarget = (a: View | undefined, b: View) =>
    !!a &&
    a.kind === 'library' &&
    b.kind === 'library' &&
    a.section.key === b.section.key &&
    (a.pinId ?? '') === (b.pinId ?? '');

  // Keyboard + controller wiring; handlers read the latest state through a ref.
  const actions = useRef({ back, search: (_pad: boolean) => {}, settings: () => {}, libStep: (_d: number) => {} });
  actions.current = {
    back: () => {
      if (top?.view.kind === 'search' && history.length === 1) {
        setQuery('');
        if (visibleLibs[0]) go({ kind: 'library', section: visibleLibs[0] });
      } else back();
    },
    search: (pad) => {
      if (!pad) return focusEl(searchRef.current);
      // Controller: open the search page and land on the on-screen keyboard.
      if (top?.view.kind !== 'search') open({ kind: 'search' });
      setTimeout(() => focusEl(document.querySelector<HTMLElement>('.view:not(.behind) .osk .first')), 60);
    },
    settings: () => open({ kind: 'settings' }),
    libStep: (d) => {
      if (!sidebarTargets.length) return;
      const i = sidebarTargets.findIndex((t) => history.length === 1 && sameTarget(top?.view, t));
      const target = sidebarTargets[(i + d + sidebarTargets.length) % sidebarTargets.length];
      go(target);
    },
  };
  useEffect(
    () =>
      installKeys({
        back: () => actions.current.back(),
        search: (pad) => actions.current.search(pad),
        settings: () => actions.current.settings(),
        libStep: (d) => actions.current.libStep(d),
      }),
    [],
  );
  useEffect(() => installGamepad(() => playingRef.current), []);

  const onSearch = (q: string) => {
    setQuery(q);
    if (q.trim() && top?.view.kind !== 'search') open({ kind: 'search' });
  };

  if (!prefs) return <Splash text="Loading..." />;

  const ctx: Ctx = {
    open,
    play,
    playItem,
    menu: (x, y, entries) => setMenu({ x, y, entries }),
    bump: () => setRefresh((n) => n + 1),
    error: setError,
    refresh,
    prefs,
    setPrefs: (patch) => window.plex.setPrefs(patch).then(setPrefsState),
    sections: libs,
  };

  const navButton = (key: string, label: React.ReactNode, target: View, onMenu?: MenuEntry[]) => (
    <button
      key={key}
      data-nav
      className={history.length === 1 && sameTarget(top?.view, target) ? 'active' : ''}
      onClick={() => go(target)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onMenu) setMenu({ x: e.clientX, y: e.clientY, entries: onMenu });
      }}
    >
      {label}
    </button>
  );

  setTicketHolder(user.username || user.name);
  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <aside className="sidebar">
          <Brand layout={prefs.ui.brandLayout} />
          <StatusLine />
          <UpdatePill />
          <div className="who">
            <div className="user">{prefs.ui.displayName === 'username' ? user.username : user.name}</div>
            <div className="server">{server}</div>
          </div>
          <input
            ref={searchRef}
            className="search"
            data-nav
            placeholder="🔍 Search  ( / )"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                focusFirst();
              }
            }}
          />
          <nav>
            {visibleLibs.map((s) =>
              navButton(
                s.key,
                <>
                  <span className="icon">{s.type === 'movie' ? '🎬' : '📺'}</span>
                  {s.title}
                </>,
                { kind: 'library', section: s },
                [
                  {
                    label: 'Hide from sidebar',
                    action: () => ctx.setPrefs({ ui: { hiddenLibs: [...prefs.ui.hiddenLibs, s.key] } }),
                  },
                ],
              ),
            )}
            {prefs.ui.pins.length > 0 && <div className="nav-head">Pinned</div>}
            {prefs.ui.pins.map((pin) => {
              const section = libs.find((s) => s.key === pin.sectionKey);
              if (!section) return null;
              return navButton(
                pin.id,
                <>
                  <span className="icon">📌</span>
                  {pin.name}
                </>,
                { kind: 'library', section, filters: pin.filters, pinId: pin.id },
                [
                  {
                    label: 'Remove pin',
                    action: () => ctx.setPrefs({ ui: { pins: prefs.ui.pins.filter((p) => p.id !== pin.id) } }),
                  },
                ],
              );
            })}
            {prefs.ui.showPlaylists && playlists.length > 0 && <div className="nav-head">Playlists</div>}
            {prefs.ui.showPlaylists &&
              playlists.map((pl) => (
                <button
                  key={pl.ratingKey}
                  data-nav
                  className={
                    history.length === 1 && top?.view.kind === 'playlist' && top.view.ratingKey === pl.ratingKey ? 'active' : ''
                  }
                  onClick={() => go({ kind: 'playlist', ratingKey: pl.ratingKey, title: pl.title })}
                >
                  <span className="icon">🎞</span>
                  {pl.title}
                </button>
              ))}
          </nav>
          {player.playing && (
            <div className="now-playing">
              <div className="muted small">Now playing in mpv</div>
              <div className="np-title">{player.title}</div>
              <button className="tool" data-nav onClick={() => window.plex.stop()}>
                ■ Stop
              </button>
            </div>
          )}
          <BadgeShowcase state={badgeState} />
          <button
            className={`settings-btn ${top?.view.kind === 'badges' || top?.view.kind === 'badgeCategory' ? 'active' : ''}`}
            data-nav
            onClick={() => go({ kind: 'badges' })}
          >
            🏅 Badges
          </button>
          <button
            className={`settings-btn ${top?.view.kind === 'settings' ? 'active' : ''}`}
            data-nav
            onClick={() => open({ kind: 'settings' })}
          >
            ⚙ Settings
          </button>
        </aside>
        <main className="content">
          {error && (
            <div className="error" onClick={() => setError(undefined)}>
              {error} <span>(click to dismiss)</span>
            </div>
          )}
          {history.map((entry, i) => {
            const behind = i < history.length - 1;
            const v = entry.view;
            return (
              <div key={entry.id} className={`view ${behind ? 'behind' : ''}`}>
                {history.length > 1 && i > 0 && (
                  <button className="back" data-nav onClick={back}>
                    ← Back
                  </button>
                )}
                {v.kind === 'library' && <Library section={v.section} initial={v.filters} pinId={v.pinId} />}
                {v.kind === 'collections' && <Collections section={v.section} />}
                {v.kind === 'item' && <Detail ratingKey={v.ratingKey} />}
                {v.kind === 'playlist' && <Playlist ratingKey={v.ratingKey} title={v.title} />}
                {v.kind === 'search' && <Search query={query} setQuery={setQuery} />}
                {v.kind === 'settings' && <Settings onSignOut={onSignOut} />}
                {v.kind === 'badges' && <BadgesPage />}
                {v.kind === 'badgeCategory' && <BadgeCategoryPage category={v.category} />}
              </div>
            );
          })}
        </main>
      </div>
      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}
      <BadgeToasts sound={prefs.ui.badgeSound} onEarned={refreshBadges} />
    </AppCtx.Provider>
  );
}
