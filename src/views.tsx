// Vanta by soybean_alien
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_FILTERS,
  Filters,
  Item,
  SORTS,
  Section,
  directory,
  episodeLabel,
  get,
  img,
  isWatched,
  items,
  libraryQuery,
  markWatched,
  minutes,
  nextEpisode,
  playable,
} from './api';
import { Choice, DeckRow, Modal, Poster, Toggle, useApp, useAutoFocus, useUpdate } from './components';

const loadFilters = (key: string): Filters => {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(`filters:${key}`) || '{}') };
  } catch {
    return DEFAULT_FILTERS;
  }
};
const saveFilters = (key: string, f: Filters) => {
  try {
    localStorage.setItem(`filters:${key}`, JSON.stringify(f));
  } catch {}
};

export function Library({ section, initial, pinId }: { section: Section; initial?: Filters; pinId?: string }) {
  const ctx = useApp();
  const [f, setF] = useState<Filters>(initial ?? loadFilters(section.key));
  const [list, setList] = useState<Item[]>();
  const [deck, setDeck] = useState<Item[]>([]);
  const [genres, setGenres] = useState<{ key: string; title: string }[]>([]);
  const [decades, setDecades] = useState<{ key: string; title: string }[]>([]);
  const [text, setText] = useState('');
  const [pick, setPick] = useState<Item | null>(null);

  const update = (patch: Partial<Filters>) => {
    const nf = { ...f, ...patch };
    setF(nf);
    if (!pinId) saveFilters(section.key, nf);
  };

  useEffect(() => {
    let live = true;
    items(libraryQuery(section, f))
      .then((l) => live && setList(l))
      .catch((e) => ctx.error(e.message));
    return () => {
      live = false;
    };
  }, [section.key, f, ctx.refresh]);

  useEffect(() => {
    items(`/library/sections/${section.key}/onDeck`).then(setDeck, () => setDeck([]));
  }, [section.key, ctx.refresh]);

  useEffect(() => {
    directory(`/library/sections/${section.key}/genre`).then(setGenres, () => {});
    directory(`/library/sections/${section.key}/decade`).then(setDecades, () => {});
  }, [section.key]);

  const shown = useMemo(
    () => list?.filter((i) => i.title.toLowerCase().includes(text.toLowerCase())),
    [list, text],
  );
  const filtered = f.genre || f.decade || f.unwatched || text;
  useAutoFocus(!!shown);

  const randomPick = () => {
    const pool = (shown || []).filter((i) => !isWatched(i));
    const from = pool.length ? pool : shown || [];
    if (from.length) setPick(from[Math.floor(Math.random() * from.length)]);
  };

  const pinName = () =>
    [
      section.title,
      genres.find((g) => g.key === f.genre)?.title,
      decades.find((d) => d.key === f.decade)?.title,
      f.unwatched && 'Unwatched',
      f.sort !== 'titleSort' && SORTS.find(([s]) => s === f.sort)?.[1],
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <>
      <header className="libhead">
        <h1>{section.title}</h1>
        <input data-nav placeholder="Filter titles..." value={text} onChange={(e) => setText(e.target.value)} />
        <Choice label="Sort" value={f.sort} options={SORTS} onChange={(sort) => update({ sort })} />
        <Choice
          label="Genre"
          value={f.genre}
          options={[['', 'All'], ...genres.map((g) => [g.key, g.title] as [string, string])]}
          onChange={(genre) => update({ genre })}
        />
        <Choice
          label="Decade"
          value={f.decade}
          options={[['', 'All'], ...decades.map((d) => [d.key, d.title] as [string, string])]}
          onChange={(decade) => update({ decade })}
        />
        <Toggle label="Unwatched" value={f.unwatched} onChange={(unwatched) => update({ unwatched })} />
        <button className="tool" data-nav onClick={randomPick} title="Pick something you haven't seen">
          🎲 Random
        </button>
        <button className="tool" data-nav onClick={() => ctx.open({ kind: 'collections', section })}>
          🗂 Collections
        </button>
        {!pinId && (
          <button
            className="tool"
            data-nav
            title="Save this view (sort + filters) to the sidebar"
            onClick={() =>
              ctx.setPrefs({
                ui: {
                  pins: [
                    ...ctx.prefs.ui.pins,
                    { id: String(Date.now()), name: pinName(), sectionKey: section.key, filters: f },
                  ],
                },
              })
            }
          >
            📌 Pin view
          </button>
        )}
        {filtered && (
          <button className="tool" data-nav onClick={() => (setText(''), update({ genre: '', decade: '', unwatched: false }))}>
            ✕ Clear filters
          </button>
        )}
        <span className="count">{shown ? `${shown.length} items` : ''}</span>
      </header>
      {!filtered && <DeckRow items={deck} />}
      {!shown ? (
        <p className="muted">Loading...</p>
      ) : !shown.length ? (
        <p className="muted">Nothing matches these filters.</p>
      ) : (
        <div className="grid">
          {shown.map((i) => (
            <Poster key={i.ratingKey} item={i} />
          ))}
        </div>
      )}
      {pick && <RandomPick item={pick} onAnother={randomPick} onClose={() => setPick(null)} />}
    </>
  );
}

function RandomPick({ item, onAnother, onClose }: { item: Item; onAnother: () => void; onClose: () => void }) {
  const ctx = useApp();
  return (
    <Modal onClose={onClose}>
      {item.art && <div className="modal-art" style={{ backgroundImage: `url("${img(item.art, 1200, 675)}")` }} />}
      <div className="pick">
        {item.thumb && <img src={img(item.thumb, 240, 360)} />}
        <div>
          <div className="muted">🎲 How about...</div>
          <h2>{item.title}</h2>
          <div className="meta">{[item.year, item.contentRating, minutes(item.duration)].filter(Boolean).join(' · ')}</div>
          <p className="summary clamp">{item.summary}</p>
          <div className="actions">
            <button className="play" data-nav data-autofocus onClick={() => (onClose(), ctx.playItem(item))}>
              ▶ Play
            </button>
            <button className="tool" data-nav onClick={onAnother}>
              🎲 Another
            </button>
            <button
              className="tool"
              data-nav
              onClick={() => (onClose(), ctx.open({ kind: 'item', ratingKey: item.ratingKey }))}
            >
              ℹ Details
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function Collections({ section }: { section: Section }) {
  const ctx = useApp();
  const [list, setList] = useState<Item[]>();
  useEffect(() => {
    items(`/library/sections/${section.key}/collections`).then(setList, (e) => ctx.error(e.message));
  }, [section.key, ctx.refresh]);
  useAutoFocus(!!list);
  return (
    <>
      <header className="libhead">
        <h1>{section.title} · Collections</h1>
        <span className="count">{list ? `${list.length} collections` : ''}</span>
      </header>
      {!list ? (
        <p className="muted">Loading...</p>
      ) : !list.length ? (
        <p className="muted">This library has no collections.</p>
      ) : (
        <div className="grid">
          {list.map((i) => (
            <Poster key={i.ratingKey} item={i} />
          ))}
        </div>
      )}
    </>
  );
}

export function Detail({ ratingKey }: { ratingKey: string }) {
  const ctx = useApp();
  const [item, setItem] = useState<Item>();
  const [children, setChildren] = useState<Item[]>([]);
  const [next, setNext] = useState<Item | null>();

  useEffect(() => {
    items(`/library/metadata/${ratingKey}`)
      .then(([m]) => {
        setItem(m);
        if (m.type === 'show' || m.type === 'season') {
          items(`/library/metadata/${ratingKey}/children`).then(setChildren);
          nextEpisode(m).then((e) => setNext(e ?? null), () => setNext(null));
        } else {
          setNext(null);
        }
        if (m.type === 'collection') {
          items(`/library/collections/${ratingKey}/children`).then(setChildren);
        }
      })
      .catch((e) => ctx.error(e.message));
  }, [ratingKey, ctx.refresh]);

  useAutoFocus(!!item && next !== undefined); // wait for the show's next-episode button
  if (!item) return <p className="muted">Loading...</p>;
  const heading =
    item.type === 'season'
      ? `${item.parentTitle} · ${item.title}`
      : item.type === 'episode'
        ? `${item.grandparentTitle} · ${episodeLabel(item)}`
        : item.title;
  const watched = isWatched(item);
  const group = item.type === 'show' || item.type === 'season';

  return (
    <div className="detail">
      {(item.art || item.grandparentArt) && (
        <div className="backdrop" style={{ backgroundImage: `url("${img(item.art || item.grandparentArt, 1600, 900)}")` }} />
      )}
      <div className="top">
        {(item.thumb || item.composite) && (
          <img className={`cover ${item.type === 'episode' ? 'wide' : ''}`} src={img(item.thumb || item.composite, 300, 450)} />
        )}
        <div className="info">
          <h1>{heading}</h1>
          {item.type === 'episode' && <h3>{item.title}</h3>}
          <div className="meta">
            {[
              item.year,
              item.contentRating,
              minutes(item.duration),
              item.audienceRating && `★ ${item.audienceRating.toFixed(1)}`,
              item.Genre?.map((g) => g.tag).join(', '),
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="actions">
            {playable(item) && (
              <button className="play" data-nav onClick={() => ctx.playItem(item)}>
                ▶ {item.viewOffset ? `Resume from ${Math.floor(item.viewOffset / 60000)} min` : 'Play'}
              </button>
            )}
            {playable(item) && item.viewOffset ? (
              <button className="tool" data-nav onClick={() => ctx.playItem(item, { fromStart: true })}>
                ⟲ From beginning
              </button>
            ) : null}
            {group && next && (
              <button className="play" data-nav onClick={() => ctx.play(next.ratingKey)}>
                ▶ {next.viewOffset ? 'Resume' : 'Play'} {episodeLabel(next)}
              </button>
            )}
            {item.type === 'collection' && (
              <>
                <button className="play" data-nav onClick={() => ctx.playItem(item)}>
                  ▶ Play all
                </button>
                <button className="tool" data-nav onClick={() => ctx.playItem(item, { shuffle: true })}>
                  🔀 Shuffle
                </button>
              </>
            )}
            {item.type !== 'collection' && (
              <button
                className="tool"
                data-nav
                onClick={async () => {
                  await markWatched(item.ratingKey, !watched);
                  ctx.bump();
                }}
              >
                {watched ? '○ Mark unwatched' : '✓ Mark watched'}
              </button>
            )}
            {item.type === 'episode' && item.grandparentRatingKey && (
              <button className="tool" data-nav onClick={() => ctx.open({ kind: 'item', ratingKey: item.grandparentRatingKey! })}>
                📺 Go to show
              </button>
            )}
          </div>
          <p className="summary">{item.summary}</p>
        </div>
      </div>
      {children.length > 0 && (
        <div className={item.type === 'season' ? 'episodes' : 'grid'}>
          {children.map((c) =>
            c.type === 'episode' ? (
              <Poster key={c.ratingKey} wide item={c} title={`${c.index}. ${c.title}`} onClick={() => ctx.playItem(c)} />
            ) : (
              <Poster key={c.ratingKey} item={c} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

const SEARCH_TYPES = ['movie', 'show', 'episode', 'collection'];
const HUB_TITLES: Record<string, string> = { movie: 'Movies', show: 'Shows', episode: 'Episodes', collection: 'Collections' };

const OSK_ROWS = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ1234', '567890'];

// On-screen keyboard so search works from the couch with just a controller.
function Keyboard({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const key = (label: React.ReactNode, onPress: () => void, cls = '') => (
    <button className={`key ${cls}`} data-nav onClick={onPress}>
      {label}
    </button>
  );
  return (
    <div className="osk">
      {OSK_ROWS.map((row, r) => (
        <div className="osk-row" key={r}>
          {[...row].map((ch) => (
            <span key={ch}>{key(ch, () => setQuery(query + ch.toLowerCase()), r === 0 && ch === 'A' ? 'first' : '')}</span>
          ))}
          {r === 3 && (
            <>
              {key('Space', () => setQuery(query + ' '), 'wide')}
              {key('⌫', () => setQuery(query.slice(0, -1)), 'wide')}
              {key('Clear', () => setQuery(''), 'wide')}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function Search({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {  const ctx = useApp();
  const [hubs, setHubs] = useState<{ type: string; items: Item[] }[]>();
  useEffect(() => {
    if (!query.trim()) return setHubs([]);
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await get(`/hubs/search?query=${encodeURIComponent(query)}&limit=30`);
        const libs = new Set(ctx.sections.map((s) => String(s.key)));
        const out = (r.MediaContainer.Hub || [])
          .filter((h: any) => SEARCH_TYPES.includes(h.type) && h.Metadata?.length)
          .map((h: any) => ({
            type: h.type,
            items: (h.Metadata as Item[]).filter((m) => m.librarySectionID == null || libs.has(String(m.librarySectionID))),
          }))
          .filter((h: any) => h.items.length);
        if (live) setHubs(out);
      } catch (e: any) {
        ctx.error(e.message);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, ctx.refresh]);

  return (
    <>
      <header className="libhead">
        <h1>{query ? `Search: “${query}”` : 'Search'}</h1>
      </header>
      <Keyboard query={query} setQuery={setQuery} />
      {!query.trim() ? (
        <p className="muted">Type with the keyboard (press / to jump to the search box) or pick letters above with the controller.</p>
      ) : !hubs ? (
        <p className="muted">Searching...</p>
      ) : !hubs.length ? (
        <p className="muted">No results.</p>
      ) : (
        hubs.map((h) => (
          <section key={h.type} className="hub">
            <h2>{HUB_TITLES[h.type]}</h2>
            <div className={h.type === 'episode' ? 'episodes' : 'grid'}>
              {h.items.map((i) =>
                i.type === 'episode' ? (
                  <Poster
                    key={i.ratingKey}
                    item={i}
                    wide
                    title={i.grandparentTitle}
                    sub={`${episodeLabel(i)} · ${i.title}`}
                    onClick={() => ctx.playItem(i)}
                  />
                ) : (
                  <Poster key={i.ratingKey} item={i} />
                ),
              )}
            </div>
          </section>
        ))
      )}
    </>
  );
}

export function Playlist({ ratingKey, title }: { ratingKey: string; title: string }) {
  const ctx = useApp();
  const [list, setList] = useState<Item[]>();
  useEffect(() => {
    items(`/playlists/${ratingKey}/items`).then(setList, (e) => ctx.error(e.message));
  }, [ratingKey, ctx.refresh]);
  const queue = (list || []).filter(playable).map((i) => i.ratingKey);
  useAutoFocus(!!list);
  return (
    <>
      <header className="libhead">
        <h1>{title}</h1>
        <button className="play" data-nav disabled={!queue.length} onClick={() => ctx.play(queue[0], { queue })}>
          ▶ Play all
        </button>
        <button className="tool" data-nav disabled={!queue.length} onClick={() => ctx.play(queue[0], { queue, shuffle: true })}>
          🔀 Shuffle
        </button>
        <span className="count">{list ? `${list.length} items` : ''}</span>
      </header>
      {!list ? (
        <p className="muted">Loading...</p>
      ) : (
        <div className="grid">
          {list.map((i) => (
            <Poster
              key={i.ratingKey}
              item={i}
              title={i.type === 'episode' ? i.grandparentTitle : i.title}
              sub={i.type === 'episode' ? `${episodeLabel(i)} · ${i.title}` : undefined}
              onClick={() =>
                playable(i)
                  ? ctx.play(i.ratingKey, { queue, queueIndex: queue.indexOf(i.ratingKey) })
                  : ctx.open({ kind: 'item', ratingKey: i.ratingKey })
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

const LANG_OPTIONS: [string, string][] = [
  ['default', 'File default'],
  ['english', 'English'],
  ['japanese', 'Japanese'],
  ['spanish', 'Spanish'],
  ['french', 'French'],
  ['german', 'German'],
  ['italian', 'Italian'],
  ['korean', 'Korean'],
  ['chinese', 'Chinese'],
  ['portuguese', 'Portuguese'],
  ['russian', 'Russian'],
  ['hindi', 'Hindi'],
];

export function Settings({ onSignOut }: { onSignOut: () => void }) {
  const ctx = useApp();
  const p = ctx.prefs.player;
  const ui = ctx.prefs.ui;
  const setP = (patch: Partial<typeof p>) => ctx.setPrefs({ player: patch });
  const setUi = (patch: Partial<typeof ui>) => ctx.setPrefs({ ui: patch });
  const [playlists, setPlaylists] = useState<Item[]>([]);
  useEffect(() => {
    items('/playlists?playlistType=video').then(setPlaylists, () => {});
  }, []);

  return (
    <div className="settings">
      <h1>Settings</h1>

      <h2>Playback</h2>
      <div className="setting-grid">
        <Toggle label="Start in full screen" value={p.fullscreen} onChange={(fullscreen) => setP({ fullscreen })} />
        <Toggle label="Auto-play next episode" value={p.autoplay} onChange={(autoplay) => setP({ autoplay })} />
        <Choice
          label="Up-next countdown"
          value={p.countdown}
          options={[
            [3, '3 s'],
            [5, '5 s'],
            [10, '10 s'],
            [15, '15 s'],
          ]}
          onChange={(countdown) => setP({ countdown })}
        />
        <Choice
          label="Skip intro"
          value={p.skipIntro}
          options={[
            ['off', 'Off'],
            ['button', 'Show prompt (S / Y)'],
            ['auto', 'Automatically'],
          ]}
          onChange={(skipIntro) => setP({ skipIntro })}
        />
      </div>

      <h2>Audio & subtitles</h2>
      <div className="setting-grid">
        <Choice label="Audio language" value={p.audioLang} options={LANG_OPTIONS} onChange={(audioLang) => setP({ audioLang })} />
        <Choice
          label="Subtitles"
          value={p.subMode}
          options={[
            ['off', 'Off'],
            ['smart', 'Smart (forced only unless audio is foreign)'],
            ['always', 'Always on'],
          ]}
          onChange={(subMode) => setP({ subMode })}
        />
        <Choice
          label="Subtitle language"
          value={p.subLang}
          options={LANG_OPTIONS.slice(1)}
          onChange={(subLang) => setP({ subLang })}
        />
      </div>

      <h2>Video</h2>
      <div className="setting-grid">
        <Toggle label="Hardware decoding" value={p.hwdec} onChange={(hwdec) => setP({ hwdec })} />
        <Choice
          label="Upscaling"
          value={p.quality}
          options={[
            ['default', 'Default (fast)'],
            ['hq', 'High quality'],
            ['sharp', 'High quality + sharp (ewa_lanczossharp)'],
          ]}
          onChange={(quality) => setP({ quality })}
        />
        <Toggle label="Smooth motion (interpolation)" value={p.smoothMotion} onChange={(smoothMotion) => setP({ smoothMotion })} />
      </div>
      <label className="field">
        <span>GLSL shaders (full paths, one per line, e.g. FSRCNNX or Anime4K .glsl files)</span>
        <textarea data-nav rows={2} defaultValue={p.shaders} onBlur={(e) => setP({ shaders: e.target.value })} />
      </label>
      <label className="field">
        <span>Extra mpv options (one per line, each starting with --)</span>
        <textarea data-nav rows={3} defaultValue={p.extraArgs} onBlur={(e) => setP({ extraArgs: e.target.value })} />
      </label>
      <p className="muted small">Changes apply the next time something starts playing.</p>

      <h2>Sidebar</h2>
      <div className="setting-grid">
        {ctx.sections.map((s) => (
          <Toggle
            key={s.key}
            label={`Show “${s.title}”`}
            value={!ui.hiddenLibs.includes(s.key)}
            onChange={(v) => setUi({ hiddenLibs: v ? ui.hiddenLibs.filter((k) => k !== s.key) : [...ui.hiddenLibs, s.key] })}
          />
        ))}
        <Toggle
          label={`Show playlists${playlists.length ? ` (${playlists.length})` : ''}`}
          value={ui.showPlaylists}
          onChange={(showPlaylists) => setUi({ showPlaylists })}
        />
      </div>
      <h3>Pinned views</h3>
      {!ui.pins.length && <p className="muted small">Use “📌 Pin view” in any library to save its sort and filters here.</p>}
      {ui.pins.map((pin, i) => (
        <div className="pin-row" key={pin.id}>
          <input
            data-nav
            defaultValue={pin.name}
            onBlur={(e) =>
              setUi({ pins: ui.pins.map((x) => (x.id === pin.id ? { ...x, name: e.target.value || x.name } : x)) })
            }
          />
          <button
            className="tool"
            data-nav
            disabled={i === 0}
            onClick={() => {
              const pins = [...ui.pins];
              [pins[i - 1], pins[i]] = [pins[i], pins[i - 1]];
              setUi({ pins });
            }}
          >
            ↑
          </button>
          <button className="tool" data-nav onClick={() => setUi({ pins: ui.pins.filter((x) => x.id !== pin.id) })}>
            ✕ Remove
          </button>
        </div>
      ))}

      <h2>Updates</h2>
      <UpdatesSection />

      <h2>Account</h2>
      <div className="setting-grid">
        <Choice
          label="Logo layout"
          value={ui.brandLayout}
          options={[
            ['inline', '1 · Mark + name'],
            ['stacked', '2 · Mark over name'],
            ['corner', '3 · Corner mark, large name'],
            ['bold', '4 · Bold stack'],
            ['tagline', '5 · Lockup with tagline'],
            ['gilded', '6 · Gilded name'],
            ['seal', '7 · Seal'],
            ['monogram', '8 · Monogram'],
            ['row', '9 · Centered row'],
          ]}
          onChange={(brandLayout) => setUi({ brandLayout })}
        />
        <Choice
          label="Name in sidebar"
          value={ui.displayName}
          options={[
            ['username', 'Username'],
            ['title', 'Full name'],
          ]}
          onChange={(displayName) => setUi({ displayName })}
        />
        <button className="tool" data-nav onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <h2>Controls</h2>
      <table className="keys">
        <thead>
          <tr>
            <th>Action</th>
            <th>Keyboard</th>
            <th>Xbox controller</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Move', 'Arrow keys', 'D-pad / left stick'],
            ['Select', 'Enter', 'A'],
            ['Back', 'Esc / Backspace', 'B'],
            ['Item menu (watched, details…)', 'Menu key / right-click', 'Y'],
            ['Search', '/ or Ctrl+F', 'X'],
            ['Previous / next library', '', 'LB / RB'],
            ['Page up / down', 'PgUp / PgDn', 'LT / RT'],
            ['Settings', '', 'Menu ☰'],
            ['Full screen app', 'F11', 'View ⧉'],
          ].map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h3>While playing (mpv)</h3>
      <table className="keys">
        <tbody>
          {[
            ['Pause', 'Space', 'A'],
            ['Stop and return', 'Q', 'B'],
            ['Skip intro / next episode', 'S / N', 'Y'],
            ['Cycle subtitles / audio', 'J / #', 'X / D-pad up'],
            ['Seek -10 s / +30 s', '← / → (5 s)', 'D-pad left / right'],
            ['Previous / next chapter', 'PgDn / PgUp', 'LB / RB'],
            ['Volume', '9 / 0', 'LT / RT'],
            ['Show progress', 'O', 'D-pad down / Menu'],
            ['Toggle full screen', 'F', 'View'],
          ].map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Settings → Updates: when to update, the current version, and a manual check.
function UpdatesSection() {
  const ctx = useApp();
  const [u, setU] = useUpdate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!u) return null;
  const when = (t?: number) => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  const status =
    u.state === 'dev'
      ? 'Updates are turned off when running from source.'
      : u.state === 'checking'
        ? 'Checking for updates…'
        : u.state === 'none'
          ? `You're up to date${u.checkedAt ? ` (checked ${when(u.checkedAt)})` : ''}.`
          : u.state === 'available'
            ? `Vanta ${u.version} is available.`
            : u.state === 'downloading'
              ? `Downloading Vanta ${u.version}… ${u.percent ?? 0}%`
              : u.state === 'ready'
                ? `Vanta ${u.version} is ready. Restart to finish updating.`
                : u.state === 'error'
                  ? `Couldn't check for updates: ${u.error}`
                  : 'Vanta checks for updates shortly after it starts.';
  return (
    <>
      <div className="setting-grid">
        <Choice
          label="When an update is out"
          value={ctx.prefs.ui.updates}
          options={[
            ['auto', 'Install automatically'],
            ['ask', 'Ask me first'],
            ['manual', 'Only when I check'],
          ]}
          onChange={(updates) => ctx.setPrefs({ ui: { updates } })}
        />
      </div>
      <div className="update-row" style={{ marginTop: 12 }}>
        <span>
          <b>Vanta {u.current}</b> <span className="muted">· {error || status}</span>
        </span>
        {u.state === 'available' && (
          <button className="play" data-nav onClick={async () => setU(await window.plex.downloadUpdate())}>
            ⬇ Download update
          </button>
        )}
        {u.state === 'ready' && (
          <button
            className="play"
            data-nav
            onClick={async () => {
              const r = await window.plex.installUpdate();
              if (r.error) setError(r.error);
            }}
          >
            ⟳ Restart to update
          </button>
        )}
        <button
          className="tool"
          data-nav
          disabled={busy || u.state === 'dev' || u.state === 'downloading'}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            setU(await window.plex.checkUpdate());
            setBusy(false);
          }}
        >
          {busy ? 'Checking…' : '⟳ Check now'}
        </button>
      </div>
      {u.state === 'available' && u.notes && <pre className="notes">{u.notes}</pre>}
      <p className="muted small">
        Install automatically: downloads in the background and finishes the next time Vanta restarts. Ask me first: shows an
        “Update available” note in the sidebar. Updates never interrupt playback and keep your sign-in and settings.
      </p>
    </>
  );
}