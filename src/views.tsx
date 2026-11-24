// Vanta by soybean_alien
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_FILTERS,
  Filters,
  Folder,
  Folders,
  Item,
  TmdbStatus,
  collectionFolders,
  folderCover,
  releaseOrder,
  ResTier,
  resolutionOf,
  showResolutions,
  SORTS,
  Section,
  directory,
  cleanTitle,
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
  shownTitle,
  titlesFor,
  watchedOn,
  watchedOnWithTime,
  lastEpisodeWatchedWithTime,
  loadWatchLog,
  TraktStatus,
} from './api';
import { AddToCollection, askDelete, BackupPanel, Choice, Modal, Poster, PosterSize, THEMES, applyTheme, navEntries, Switch, Toggle, playFolder, useApp, useAutoFocus, useUpdate } from './components';
import { CHIMES, playChime, previewBadgeToast } from './badges';
import { CastAndCrew, FileInfo, Scores, useTitleIds } from './details';
import { SpotifySettings } from './music';

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
  const [genres, setGenres] = useState<{ key: string; title: string }[]>([]);
  const [decades, setDecades] = useState<{ key: string; title: string }[]>([]);
  const [text, setText] = useState('');
  const [pick, setPick] = useState<Item | null>(null);
  // Select mode (movie libraries): tick several films, then put them all in one collection at once.
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const stopSelecting = () => (setSelecting(false), setSel(new Set()));
  useEffect(stopSelecting, [section.key]);

  const update = (patch: Partial<Filters>) => {
    const nf = { ...f, ...patch };
    setF(nf);
    if (!pinId) saveFilters(section.key, nf);
  };

  useEffect(() => {
    let live = true;
    items(libraryQuery(section, f))
      .then((l) => {
        if (!live) return;
        setList(l);
        // Background subtitle check for the films shown (the main process skips ones already handled).
        if (section.type === 'movie') window.plex.subsEnqueue(l.filter((i) => i.type === 'movie').map((i) => i.ratingKey));
      })
      .catch((e) => ctx.error(e.message));
    return () => {
      live = false;
    };
  }, [section.key, f, ctx.refresh]);

  // Show libraries: each show's resolution tag comes from its episodes (one cached request per library).
  const [showRes, setShowRes] = useState<Record<string, ResTier>>({});
  useEffect(() => {
    setShowRes({});
    if (section.type === 'show') showResolutions(section.key).then(setShowRes, () => {});
  }, [section.key, section.type]);

  useEffect(() => {
    directory(`/library/sections/${section.key}/genre`).then(setGenres, () => {});
    directory(`/library/sections/${section.key}/decade`).then(setDecades, () => {});
  }, [section.key]);

  const shown = useMemo(
    () => list?.filter((i) => i.title.toLowerCase().includes(text.toLowerCase())),
    [list, text],
  );

  // Movie libraries: fold each of your collections into one folder poster (its cover and name, neon red edge),
  // placed where its first matching film would sit in the current sort. Only collections you made fold anything
  // (collectionFolders), and a film is in one at most.
  // While you type in the filter box, matching films show as themselves, so a film inside a collection is found.
  const grouping = section.type === 'movie' && ctx.prefs.ui.groupCollections;
  const [folders, setFolders] = useState<Folders>();
  useEffect(() => {
    setFolders(undefined);
    if (grouping) collectionFolders(ctx.refresh, ctx.prefs.ui.hiddenLibs || []).then(setFolders, () => {});
  }, [grouping, ctx.refresh, ctx.prefs.ui.hiddenLibs]);
  const tiles = useMemo((): { item: Item; folder?: Folder }[] | undefined => {
    if (!shown) return undefined;
    if (!grouping || !folders || text.trim() || selecting) return shown.map((item) => ({ item }));
    const placed = new Set<Folder>();
    const out: { item: Item; folder?: Folder }[] = [];
    for (const i of shown) {
      const fo = folders.byFilm[i.ratingKey];
      if (!fo) out.push({ item: i });
      else if (!placed.has(fo)) {
        placed.add(fo);
        out.push({ item: fo.col, folder: fo });
      }
    }
    return out;
  }, [shown, folders, grouping, text, selecting]);
  const picked = (shown || []).filter((i) => sel.has(i.ratingKey));
  const toggleSel = (rk: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (!n.delete(rk)) n.add(rk);
      return n;
    });
  const folded = tiles?.filter((t) => t.folder).length ?? 0;
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
        {section.type === 'movie' && !selecting && (
          <button className="tool" data-nav title="Tick several films and put them in a collection at once" onClick={() => setSelecting(true)}>
            ☑ Select
          </button>
        )}
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
        <span className="count">
          {shown
            ? `${shown.length} items${
                grouping && !folders ? '' : folded ? ` · ${folded} collection${folded === 1 ? '' : 's'}` : ''
              }`
            : ''}
        </span>
        <PosterSize />
      </header>
      {selecting && (
        <div className="select-bar" data-nav-scope>
          <span>
            <b>{sel.size}</b> {sel.size === 1 ? 'film' : 'films'} selected. Click posters to tick them; collections are opened up while you select.
          </span>
          <button className="tool primary" data-nav disabled={!picked.length} onClick={() => setAdding(true)}>
            🗂 Add to collection…
          </button>
          <button className="tool" data-nav onClick={() => setSel(new Set((shown || []).map((i) => i.ratingKey)))}>
            Select all shown
          </button>
          {sel.size > 0 && (
            <button className="tool" data-nav onClick={() => setSel(new Set())}>
              Clear
            </button>
          )}
          <button className="tool" data-nav onClick={stopSelecting}>
            Done
          </button>
        </div>
      )}
      {!tiles ? (
        <p className="muted">Loading...</p>
      ) : !tiles.length ? (
        <p className="muted">Nothing matches these filters.</p>
      ) : (
        <div className="grid">
          {tiles.map(({ item: i, folder }) =>
            folder ? (
              <Poster key={i.ratingKey} item={i} folder={folder} money={section.type === 'movie'} />
            ) : (
              <Poster
                key={i.ratingKey}
                item={i}
                res={i.type === 'show' ? showRes[i.ratingKey] : resolutionOf(i.Media)}
                money={i.type === 'movie'}
                noYear={i.type === 'show'}
                selected={selecting ? sel.has(i.ratingKey) : undefined}
                onClick={selecting ? () => toggleSel(i.ratingKey) : undefined}
              />
            ),
          )}
        </div>
      )}
      {pick && <RandomPick item={pick} onAnother={randomPick} onClose={() => setPick(null)} />}
      {adding && <AddToCollection items={picked} onClose={() => setAdding(false)} onDone={stopSelecting} />}
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

// A movie library's Collections page: every collection you made, A to Z, with films from all your movie libraries.
// TV libraries list their Plex collections.
export function Collections({ section }: { section: Section }) {
  if (section.type === 'movie') return <FolderSummary section={section} />;
  return <PlexCollections section={section} />;
}

function FolderSummary({ section }: { section: Section }) {
  const ctx = useApp();
  const [folders, setFolders] = useState<Folder[]>();
  useEffect(() => {
    collectionFolders(ctx.refresh, ctx.prefs.ui.hiddenLibs || []).then((f) => setFolders(f.list), (e) => ctx.error(e.message));
  }, [ctx.refresh, ctx.prefs.ui.hiddenLibs]);
  useAutoFocus(!!folders);
  const films = (folders || []).reduce((n, f) => n + f.films.length, 0);
  return (
    <>
      <header className="libhead">
        <h1>{section.title} · Collections</h1>
        <span className="count">{folders ? `${folders.length} collections · ${films} films` : 'Loading...'}</span>
      </header>
      <p className="muted small" style={{ marginTop: -8 }}>
        Your collections only: Vanta never groups films by itself. To put a film in one (or start one), right-click it (or press Y) and choose 🗂 Add to collection.
      </p>
      {!folders ? (
        <p className="muted">Loading...</p>
      ) : !folders.length ? (
        <p className="muted">No collections yet.</p>
      ) : (
        <div className="grid">
          {folders.map((f) => (
            <Poster key={f.key} item={f.col} folder={f} sub={`${f.films.length} ${f.films.length === 1 ? 'film' : 'films'}`} />
          ))}
        </div>
      )}
    </>
  );
}

function PlexCollections({ section }: { section: Section }) {
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

// Optional TMDB key (cast ages, live scores, official posters, covers for your collections). The key is checked
// with TMDB, then kept encrypted by the main process; the UI only ever learns whether one is set.
function TmdbKey() {
  const ctx = useApp();
  const [status, setStatus] = useState<TmdbStatus>();
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    window.plex.tmdbStatus().then(setStatus);
  }, []);
  const save = async (key: string) => {
    setMsg(key ? 'Checking the key with TMDB...' : '');
    const r = await window.plex.tmdbSetKey(key);
    if ('error' in r) return setMsg(r.error);
    setStatus(r);
    setDraft('');
    setMsg(key ? 'Key saved.' : 'Key removed.');
    ctx.bump();
  };
  return (
    <div className="field" style={{ marginTop: 12 }}>
      <span>
        TMDB key (optional) for cast ages, posters and collection covers: {status?.hasKey ? '✓ key saved' : 'no key'}
        {status?.cached ? ` · ${status.cached} films checked` : ''}
      </span>
      <div className="pin-row">
        <input
          data-nav
          type="password"
          placeholder={status?.hasKey ? 'Paste a new key to replace it' : 'Paste your TMDB API key or read access token'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="tool" data-nav disabled={!draft.trim()} onClick={() => save(draft)}>
          Save key
        </button>
        {status?.hasKey && (
          <button className="tool" data-nav onClick={() => save('')}>
            ✕ Remove
          </button>
        )}
      </div>
      <p className="muted small">
        {msg ||
          'Free from themoviedb.org (Settings → API). This one key gives every cast member’s birthday and age on details pages, the live TMDB score, official posters, and cover art for your collections (looked up by the collection’s name; TMDB never decides what is in one). Vanta sends TMDB only TMDB or IMDb ids and collection names and saves the answers on this PC. Nothing is written to Plex or your files.'}
      </p>
      <p className="muted small">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </div>
  );
}

// An optional key for the details page's live scores (Trakt, OMDb): checked with the service, then kept encrypted
// by the main process, like the TMDB key.
function ServiceKey({ service, label, placeholder, hint }: { service: 'trakt' | 'omdb'; label: string; placeholder: string; hint: string }) {
  const [has, setHas] = useState<boolean>();
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    window.plex.detailsStatus().then((s) => setHas(s[service]));
  }, []);
  const save = async (key: string) => {
    setMsg(key ? 'Checking the key...' : '');
    const r = await window.plex.detailsSetKey(service, key);
    if ('error' in r) return setMsg(r.error);
    setHas(r[service]);
    setDraft('');
    setMsg(key ? 'Key saved. Scores update the next time a details page opens.' : 'Key removed.');
  };
  return (
    <div className="field" style={{ marginTop: 12 }}>
      <span>
        {label}: {has ? '✓ key saved' : 'no key'}
      </span>
      <div className="pin-row">
        <input data-nav type="password" placeholder={has ? 'Paste a new key to replace it' : placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="tool" data-nav disabled={!draft.trim()} onClick={() => save(draft)}>
          Save key
        </button>
        {has && (
          <button className="tool" data-nav onClick={() => save('')}>
            ✕ Remove
          </button>
        )}
      </div>
      <p className="muted small">{msg || hint}</p>
    </div>
  );
}

// One of your collections: its films from every library, kept in step with Add to collection, and renamed or
// deleted here. Deleting removes only the grouping; the films stay in your libraries.
// Settings: delete every collection at once, so every film is its own poster again. Two clicks; the previous file is
// kept as my-collections.json.bak, and backups made before still hold them.
function StartCollectionsOver() {
  const ctx = useApp();
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState('');
  const go = async () => {
    if (!sure) return setSure(true);
    setSure(false);
    const r = await window.plex.myCollectionReset();
    if ('error' in r) return setMsg(r.error);
    setMsg('Done: no collections left, every film is its own poster.');
    ctx.bump();
  };
  return (
    <div className="field">
      <button className="tool" data-nav onClick={go} onBlur={() => setSure(false)}>
        {sure ? 'Click again to delete every collection' : '🗂 Start collections from scratch'}
      </button>
      <p className="muted small">{msg || 'Deletes all your collections (the films stay in your libraries).'}</p>
    </div>
  );
}

export function FolderView({ folder: opened }: { folder: Folder }) {
  const ctx = useApp();
  const [folder, setFolder] = useState(opened);
  const [gone, setGone] = useState(false);
  const [name, setName] = useState<string>();
  const [sure, setSure] = useState(false);
  useEffect(() => {
    collectionFolders(ctx.refresh, ctx.prefs.ui.hiddenLibs || []).then(
      (f) => {
        const now = f.all.find((x) => x.key === opened.key);
        if (now) setFolder(now);
        else setGone(true);
      },
      () => {},
    );
  }, [ctx.refresh]);
  useAutoFocus(true);
  const { col, films } = folder;
  const first = films[0];
  const years = [first?.year, films[films.length - 1]?.year].filter(Boolean);
  const cover = folderCover(folder, ctx.prefs.ui.officialCovers !== false);
  const done = (r: unknown) => {
    if (r && typeof r === 'object' && 'error' in r) return ctx.error(String((r as { error: string }).error));
    ctx.bump();
  };
  const rename = async () => {
    const n = (name || '').trim();
    setName(undefined);
    if (n && n !== col.title) done(await window.plex.myCollectionRename(folder.key, n));
  };
  const remove = async () => {
    if (!sure) return setSure(true);
    done(await window.plex.myCollectionDelete(folder.key));
  };
  if (gone)
    return (
      <div className="detail">
        <p className="muted">“{col.title}” was deleted. Its films are still in your libraries.</p>
      </div>
    );
  return (
    <div className="detail">
      {first?.art && <div className="backdrop" style={{ backgroundImage: `url("${img(first.art, 1600, 900)}")` }} />}
      <div className="top">
        {cover && <img className="cover collection-cover" src={img(cover, 300, 450)} />}
        <div className="info">
          {name === undefined ? (
            <h1>{col.title}</h1>
          ) : (
            <input
              className="rename"
              data-nav
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') rename();
                if (e.key === 'Escape') setName(undefined);
              }}
              onBlur={rename}
            />
          )}
          <div className="meta">
            {[`${films.length} film${films.length === 1 ? '' : 's'}`, years.length && [...new Set(years)].join('–'), 'Your collection'].filter(Boolean).join(' · ')}
          </div>
          <div className="actions">
            {first && (
              <>
                <button className="play" data-nav onClick={() => playFolder(ctx, folder)}>
                  ▶ Play all
                </button>
                <button className="tool" data-nav onClick={() => playFolder(ctx, folder, true)}>
                  🔀 Shuffle
                </button>
              </>
            )}
            <button className="tool" data-nav onClick={() => setName(col.title)}>
              ✎ Rename
            </button>
            <button className="tool" data-nav onClick={remove} onBlur={() => setSure(false)}>
              {sure ? 'Click again to delete it' : '🗑 Delete collection'}
            </button>
          </div>
          {!first && <p className="muted">No films in it. Right-click a film (or press Y) and choose 🗂 Add to collection.</p>}
        </div>
      </div>
      <div className="grid">
        {films.map((f) => (
          <Poster key={f.ratingKey} item={f} res={resolutionOf(f.Media)} />
        ))}
      </div>
    </div>
  );
}

export function Detail({ ratingKey }: { ratingKey: string }) {
  const ctx = useApp();
  const [item, setItem] = useState<Item>();
  const [children, setChildren] = useState<Item[]>([]);
  const [next, setNext] = useState<Item | null>();

  useEffect(() => {
    items(`/library/metadata/${ratingKey}?includeGuids=1`)
      .then(([m]) => {
        setItem(m);
        if (m.type === 'show' || m.type === 'season') {
          items(`/library/metadata/${ratingKey}/children`).then(setChildren);
          nextEpisode(m).then((e) => setNext(e ?? null), () => setNext(null));
        } else {
          setNext(null);
        }
        if (m.type === 'collection') {
          items(`/library/collections/${ratingKey}/children`).then((c) => setChildren(releaseOrder(c)));
        }
      })
      .catch((e) => ctx.error(e.message));
  }, [ratingKey, ctx.refresh]);

  useAutoFocus(!!item && next !== undefined); // wait for the show's next-episode button
  if (!item) return <p className="muted">Loading...</p>;
  return <DetailBody item={item} kids={children} next={next} />;
}

// "1 h 31 min", and the clock time it would end if started (or resumed) now.
const runtime = (ms?: number) => {
  if (!ms) return '';
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
const endsAt = (i: Item) =>
  i.duration ? `Ends at ${new Date(Date.now() + i.duration - (i.viewOffset || 0)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : '';

function DetailBody({ item, kids: children, next }: { item: Item; kids: Item[]; next: Item | null | undefined }) {
  const ctx = useApp();
  const ids = useTitleIds(item);
  const names = (l?: { tag: string }[]) => l?.map((p) => p.tag).join(', ');
  const heading =
    item.type === 'season'
      ? `${item.parentTitle} · ${item.title}`
      : item.type === 'episode'
        ? `${item.grandparentTitle} · ${episodeLabel(item)}`
        : cleanTitle(item.title);
  const watched = isWatched(item);
  const group = item.type === 'show' || item.type === 'season';
  // A collection's cover is its first film's poster, matching its folder in the movie grid.
  const cover = (item.type === 'collection' && children[0]?.thumb) || item.thumb || item.composite;

  return (
    <div className="detail item-detail">
      {(item.art || item.grandparentArt) && (
        <div className="backdrop" style={{ backgroundImage: `url("${img(item.art || item.grandparentArt, 1600, 900)}")` }} />
      )}
      <div className="top">
        {cover && (
          <img
            className={`cover ${item.type === 'episode' ? 'wide' : ''} ${item.type === 'collection' ? 'collection-cover' : ''}`}
            src={img(cover, 300, 450)}
          />
        )}
        <div className="info">
          <h1>{heading}</h1>
          {item.type === 'episode' && <h3>{item.title}</h3>}
          {(item.Director?.length || item.Writer?.length) && (
            <div className="credits-line">
              {item.Director?.length ? <span>Directed by <b className="director">{names(item.Director)}</b></span> : null}
              {item.Writer?.length ? <span>Written by <b>{names(item.Writer.slice(0, 3))}</b></span> : null}
            </div>
          )}
          <div className="meta">
            {item.contentRating && <span className="cert">{item.contentRating.replace(/^[a-z]{2}\//i, '')}</span>}
            <span>
              {[
                item.year,
                runtime(item.duration),
                !item.Rating?.length && item.audienceRating && `★ ${item.audienceRating.toFixed(1)}`,
                item.Genre?.map((g) => g.tag).join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {playable(item) && item.duration ? <span className="ends">{endsAt(item)}</span> : null}
            {watchedOn(item) && (
              <span className="watched-on" title="Last watched (New York time)">
                ✓ Watched {watchedOnWithTime(item)}
              </span>
            )}
            {lastEpisodeWatchedWithTime(item) && (
              <span className="watched-on" title="When you last watched an episode (New York time)">
                Last watched {lastEpisodeWatchedWithTime(item)}
              </span>
            )}
          </div>
          <Scores item={item} ids={ids} />
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
                  await markWatched(item.ratingKey, !watched, item);
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
            {(item.type === 'movie' || item.type === 'episode') && (
              <button className="tool" data-nav onClick={() => askDelete(item)} title="Delete from the library and from the server's storage">
                🗑 Delete
              </button>
            )}
          </div>
          {item.tagline && <p className="tagline">{item.tagline}</p>}
          <p className="summary">{item.summary}</p>
          {playable(item) && <FileInfo item={item} ids={ids} />}
        </div>
      </div>
      {item.type !== 'collection' && <CastAndCrew item={item} ids={ids} />}
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

// The old "paste a Trakt client ID" field, shown only while this build has no Trakt app id of its own.
function TraktKeyIfNeeded() {
  const [builtIn, setBuiltIn] = useState(true);
  useEffect(() => {
    window.plex.detailsStatus().then((s) => setBuiltIn(!!s.traktBuiltIn));
  }, []);
  if (builtIn) return null;
  return (
    <ServiceKey
      service="trakt"
      label="Trakt scores (optional)"
      placeholder="Paste your Trakt client ID"
      hint="Free from trakt.tv (Settings → Your API Apps → New Application; any redirect URI). Vanta sends Trakt only each title’s IMDb id."
    />
  );
}

// Settings → Trakt: sign in on Trakt's own page (no key to paste, no secret anywhere), then Vanta keeps your Trakt
// history in step: each watch as it happens, and Sync now for everything. Plex's watched status is never changed.
function TraktSection() {
  const ctx = useApp();
  const [s, setS] = useState<TraktStatus>();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(''); // the device code shown while waiting for approval on trakt.tv
  useEffect(() => {
    window.plex.traktStatus().then(setS);
  }, []);
  if (!s?.available) return null;
  const syncNow = async () => {
    setBusy(true);
    setMsg('Syncing with Trakt... (a big library can take a minute)');
    const r = await window.plex.traktSync();
    setBusy(false);
    if ('error' in r) return setMsg(r.error);
    setMsg(`Synced: ${r.pushed} sent to Trakt, ${r.pulled} watch dates from Trakt.${r.notFound ? ` ${r.notFound} titles Trakt didn't recognise.` : ''}`);
    setS(await window.plex.traktStatus());
    await loadWatchLog();
    ctx.bump();
  };
  return (
    <>
      <h2>Trakt</h2>
      <div className="field" style={{ marginTop: 4 }}>
        <span>Trakt: {s.connected ? `✓ connected as ${s.user?.name || s.user?.username}` : code ? 'waiting for you to approve on Trakt…' : 'not connected'}</span>
        {code && (
          <div className="trakt-code" title="Click to copy" onClick={() => navigator.clipboard?.writeText(code).catch(() => {})}>
            {code}
          </div>
        )}
        <div className="pin-row">
          {!s.connected ? (
            code ? (
              <button
                className="tool"
                data-nav
                onClick={async () => {
                  setS(await window.plex.traktConnectCancel());
                  setCode('');
                  setMsg('');
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                className="play"
                data-nav
                disabled={busy}
                onClick={async () => {
                  // Device sign-in: show the code, open trakt.tv/activate, then wait for the approval.
                  const r = await window.plex.traktConnect();
                  if ('error' in r) return setMsg(r.error);
                  setCode(r.userCode);
                  setMsg(
                    `Enter this code at ${r.url.replace(/^https?:\/\//, '')} (it’s open in your browser) and approve Vanta. Have more than one Trakt account? Use a private window so the right one approves.`,
                  );
                  const w = await window.plex.traktConnectWait();
                  setCode('');
                  if ('error' in w) return setMsg(w.error);
                  setS(w);
                  setMsg(`Connected as ${w.user?.name || w.user?.username}. Run Sync now once to bring both sides in step.`);
                }}
              >
                Connect Trakt
              </button>
            )
          ) : (
            <>
              <button className="play" data-nav disabled={busy} onClick={syncNow}>
                ⟳ Sync now
              </button>
              <button
                className="tool"
                data-nav
                disabled={busy}
                onClick={async () => {
                  setS(await window.plex.traktDisconnect());
                  setMsg('Disconnected. Vanta no longer keeps any Trakt sign-in on this PC.');
                }}
              >
                Disconnect
              </button>
            </>
          )}
        </div>
        {s.connected && (
          <div style={{ marginTop: 6 }}>
            <Switch
              label="Send what I watch to Trakt"
              hint="On: each film or episode Vanta marks watched (80% or Mark watched) is added to your Trakt history right away; Mark unwatched removes it."
              value={s.autoSync}
              onChange={(traktAutoSync) => {
                ctx.setPrefs({ ui: { traktAutoSync } });
                setS({ ...s, autoSync: traktAutoSync });
              }}
            />
          </div>
        )}
        <p className="muted small">
          {msg ||
            (s.connected
              ? `${s.lastSync ? `Last sync ${new Date(s.lastSync.at).toLocaleString()}: ${s.lastSync.pushed} sent, ${s.lastSync.pulled} dates from Trakt. ` : ''}Sync now sends your Plex watch history to Trakt and copies Trakt's dates into Vanta's watch log. It never changes watched status in Plex.`
              : 'Click Connect Trakt, then enter the code Vanta shows at trakt.tv/activate. There’s no key to paste and no password for Vanta to see. Only the sign-in Trakt gives back is kept on this PC, encrypted, and Disconnect deletes it.')}
        </p>
      </div>
    </>
  );
}

// Settings → Audio & subtitles: English subtitles found automatically for files that have none.
function AutoSubs({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const [s, setS] = useState<{ found: number; none: number; queued: number }>();
  useEffect(() => {
    const load = () => window.plex.subsStatus().then(setS, () => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div style={{ marginTop: 12 }}>
        <Switch
          label="Find English subtitles automatically"
          hint={
            on
              ? 'On: films and episodes with no English subtitles get the best match for your exact file, kept on this PC. No account needed.'
              : 'Off: only the subtitles inside your files (or next to them on the server) are used.'
          }
          value={on}
          onChange={onChange}
        />
      </div>
      <p className="muted small">
        {s ? `${s.found} found so far${s.queued ? `, ${s.queued} waiting to be checked` : ''}${s.none ? `, ${s.none} with no match yet (tried again weekly)` : ''}. ` : ''}
        Exact matches use the file’s fingerprint, so they’re in sync. Otherwise the closest release wins; if one drifts, press Z / X in the
        player to nudge it. Your own .srt: right-click a title → 💬 Add subtitle file.
      </p>
    </>
  );
}

// Settings → Sidebar → Order: move Continue Watching, the libraries and Music up or down. Saved as you go.
function NavOrder() {
  const ctx = useApp();
  const list = navEntries(ctx.sections, ctx.prefs.ui.hiddenLibs, ctx.prefs.ui.navOrder);
  const move = (i: number, d: number) => {
    const ids = list.map((e) => e.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    ctx.setPrefs({ ui: { navOrder: ids } });
  };
  return (
    <div className="nav-order">
      {list.map((e, i) => (
        <div key={e.id} className="nav-order-row">
          <span className="nav-order-n">{i + 1}</span>
          <span className="icon">{e.icon}</span>
          <span className="nav-order-label">{e.label}</span>
          <button className="tool" data-nav disabled={i === 0} aria-label={`Move ${e.label} up`} onClick={() => move(i, -1)}>
            ↑
          </button>
          <button className="tool" data-nav disabled={i === list.length - 1} aria-label={`Move ${e.label} down`} onClick={() => move(i, 1)}>
            ↓
          </button>
        </div>
      ))}
    </div>
  );
}

// Continue Watching, its own page: everything started but not finished (under 80%, see player.cjs) across every
// video library, most recently watched first, plus the next episode of each show you're part-way through.
export function ContinueWatching() {
  const ctx = useApp();
  const [list, setList] = useState<Item[]>();
  useEffect(() => {
    const libs = ctx.sections.filter((s) => !ctx.prefs.ui.hiddenLibs.includes(s.key));
    Promise.all(
      libs.flatMap((s) => [
        items(`/library/sections/${s.key}/all?type=${s.type === 'show' ? 4 : 1}&inProgress=1`).catch(() => [] as Item[]),
        s.type === 'show' ? items(`/library/sections/${s.key}/onDeck`).catch(() => [] as Item[]) : Promise.resolve([] as Item[]),
      ]),
    ).then((all) => {
      const seen = new Set<string>();
      const out = all.flat().filter((i) => !seen.has(i.ratingKey) && seen.add(i.ratingKey));
      setList(out.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0)));
    });
  }, [ctx.refresh]);
  useAutoFocus(!!list);
  return (
    <div>
      <header className="libhead">
        <h1>Continue Watching</h1>
        <span className="count">{list ? `${list.length} unfinished` : ''}</span>
      </header>
      {!list ? (
        <p className="muted">Loading...</p>
      ) : !list.length ? (
        <p className="muted">Nothing unfinished. Anything you stop before 80% shows up here.</p>
      ) : (
        <div className="episodes">
          {list.map((i) => (
            <Poster
              key={i.ratingKey}
              item={i}
              wide
              title={i.type === 'episode' ? i.grandparentTitle : i.title}
              sub={
                i.type === 'episode'
                  ? `${episodeLabel(i)} · ${i.viewOffset ? `${Math.round(((i.duration || 0) - i.viewOffset) / 60000)} min left` : 'Up next'}`
                  : i.viewOffset && i.duration
                    ? `${Math.round((i.duration - i.viewOffset) / 60000)} min left · ${Math.round((i.viewOffset / i.duration) * 100)}%`
                    : minutes(i.duration)
              }
              onClick={() => ctx.playItem(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// The sidebar title picker, for accounts that have unlocked titles: pick one (or none), then Save.
function TitlePicker({ username }: { username: string }) {
  const ctx = useApp();
  const titles = titlesFor(username);
  const saved = shownTitle(username, ctx.prefs.ui.title) || 'none';
  const [draft, setDraft] = useState(saved);
  const [msg, setMsg] = useState('');
  if (!titles.length) return null;
  return (
    <>
      <h2>Title</h2>
      <div className="pin-row">
        <Choice
          label="Shown under your name"
          value={draft}
          options={[...titles.map((t) => [t, t] as [string, string]), ['none', 'No title']]}
          onChange={(v) => {
            setDraft(v);
            setMsg('');
          }}
        />
        <button
          className="tool"
          data-nav
          disabled={draft === saved}
          onClick={() => {
            ctx.setPrefs({ ui: { title: draft } });
            setMsg(draft === 'none' ? 'Title hidden.' : `Saved. Your title is now ${draft}.`);
          }}
        >
          Save title
        </button>
      </div>
      <p className="muted small">{msg || `${titles.length} ${titles.length === 1 ? 'title' : 'titles'} unlocked. More titles are coming.`}</p>
    </>
  );
}

export function Settings({ onSignOut, username }: { onSignOut: () => void; username: string }) {
  const ctx = useApp();
  const p = ctx.prefs.player;
  const ui = ctx.prefs.ui;
  const setP = (patch: Partial<typeof p>) => ctx.setPrefs({ player: patch });
  const setUi = (patch: Partial<typeof ui>) => ctx.setPrefs({ ui: patch });
  const [playlists, setPlaylists] = useState<Item[]>([]);
  const [devBuild, setDevBuild] = useState(false);
  useEffect(() => {
    items('/playlists?playlistType=video').then(setPlaylists, () => {});
    window.plex.badges().then((b) => setDevBuild(!!b.dev), () => {});
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
      <AutoSubs on={p.autoSubs !== false} onChange={(autoSubs) => setP({ autoSubs })} />

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

      <h2>Library</h2>
      <Switch
        label="Fold my collections in movie libraries"
        hint={
          ui.groupCollections
            ? 'On: the films of each collection you made share one folder poster in the grid. Vanta never groups films by itself.'
            : 'Off: every film gets its own poster. Your collections are still under 🗂 Collections.'
        }
        value={ui.groupCollections}
        onChange={(groupCollections) => setUi({ groupCollections })}
      />
      <StartCollectionsOver />
      <Switch
        label="Official release posters"
        hint={
          ui.officialCovers !== false
            ? 'On: every movie and show shows its official poster from TMDB (needs the TMDB key below), so covers match the real release instead of fan art. Plex is not changed.'
            : 'Off: covers are the ones chosen in Plex.'
        }
        value={ui.officialCovers !== false}
        onChange={(officialCovers) => setUi({ officialCovers })}
      />
      <TmdbKey />

      <h2>Scores and cast</h2>
      <p className="muted small">
        Cast birthdays and ages need only the TMDB key in Library above; nothing here affects them. Without any key
        here, the details page shows the IMDb, Rotten Tomatoes and TMDB scores Plex already has. The optional OMDb key
        below only makes the IMDb and Rotten Tomatoes scores live and adds Metacritic.
      </p>
      {/* With Vanta's own Trakt app id built in, Trakt scores need no key. */}
      <TraktKeyIfNeeded />
      <ServiceKey
        service="omdb"
        label="Live IMDb, Rotten Tomatoes and Metacritic (optional)"
        placeholder="Paste your OMDb API key"
        hint="Scores only, not ages. Free from omdbapi.com (1,000 lookups a day). Vanta sends OMDb only each title’s IMDb id; scores are kept for 12 hours."
      />

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
      <h3>Order</h3>
      <NavOrder />
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

      <h2>Badges</h2>
      <Switch
        label="Show badges during playback"
        hint={
          ui.badgesDuringPlayback
            ? 'On: a badge appears in the corner of the video the moment you earn it.'
            : 'Off: Vanta holds badges until the gap between episodes, or until you’re back in the library.'
        }
        value={ui.badgesDuringPlayback}
        onChange={(badgesDuringPlayback) => setUi({ badgesDuringPlayback })}
      />
      <div className="setting-grid" style={{ marginTop: 12 }}>
        <Choice label="Unlock sound" value={ui.badgeSound} options={CHIMES} onChange={(badgeSound) => (setUi({ badgeSound }), playChime(badgeSound))} />
        <button className="tool" data-nav onClick={() => playChime(ui.badgeSound)}>
          ▶ Play sound
        </button>
        {devBuild && (
          <button className="tool" data-nav title="Development builds only, until donations are set up" onClick={() => window.plex.devGrantBadge?.('patron')}>
            ♥ Grant Patron (dev)
          </button>
        )}
        {devBuild && (
          <button className="tool" data-nav title="Development builds only: simulate a pledge that wasn't renewed" onClick={() => window.plex.devPatronLapse?.()}>
            Patron lapses (dev)
          </button>
        )}
        <button className="tool" data-nav onClick={() => previewBadgeToast(['first-light', 'night-owl', 'season-pass', 'marathoner', 'patron', 'patron:lapsed'][Math.floor(Math.random() * 6)])}>
          🏅 Show a test badge
        </button>
      </div>
      <p className="muted small">Badges are earned by watching in Vanta. The unlock sound is original to Vanta and plays softly.</p>

      <TraktSection />

      <h2>Music</h2>
      <SpotifySettings />

      <h2>Your data</h2>
      <BackupPanel />

      <h2>Updates</h2>
      <UpdatesSection />

      <h2>Theme</h2>
      <div className="theme-swatches">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-swatch ${(ui.theme || 'vanta') === t.id ? 'on' : ''}`}
            data-nav
            onClick={() => {
              applyTheme(t.id);
              setUi({ theme: t.id });
            }}
          >
            <span className="chips">
              {t.swatch.map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
            {t.name}
          </button>
        ))}
      </div>
      <p className="muted small">Changes colors only. Applies right away and is remembered.</p>

      <TitlePicker username={username} />

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