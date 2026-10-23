// Vanta by soybean_alien
export type User = { name: string; username: string; thumb?: string };

export type ConnectResult =
  | { state: 'signedOut' }
  | { state: 'ready'; user: User; server: { name: string } }
  | { error: string };

export interface Section {
  key: string;
  title: string;
  type: string;
}

export interface Item {
  ratingKey: string;
  key: string;
  type: 'movie' | 'show' | 'season' | 'episode' | 'collection' | 'playlist' | string;
  subtype?: string;
  title: string;
  year?: number;
  summary?: string;
  thumb?: string;
  art?: string;
  composite?: string;
  grandparentThumb?: string;
  grandparentArt?: string;
  index?: number;
  parentIndex?: number;
  parentTitle?: string;
  parentRatingKey?: string;
  grandparentTitle?: string;
  grandparentRatingKey?: string;
  duration?: number;
  viewOffset?: number;
  viewCount?: number;
  leafCount?: number;
  viewedLeafCount?: number;
  childCount?: number;
  smart?: boolean | string | number;
  guid?: string;
  Guid?: { id: string }[];
  originallyAvailableAt?: string;
  contentRating?: string;
  audienceRating?: number;
  rating?: number;
  librarySectionID?: number | string;
  Genre?: { tag: string }[];
  Media?: { videoResolution?: string; width?: number; height?: number }[];
  OnDeck?: { Metadata?: Item | Item[] };
}

// File resolution as a tier for the library grid's corner tag. Plex reports videoResolution as '4k', '1080',
// '720', '576', '480' or 'sd'; width is the fallback (scope films like 1920x800 are still 1080p). Best version wins.
export type ResTier = { label: string; tier: '4k' | '1080' | '720' | 'low' };
const tierOf = (m: { videoResolution?: string; width?: number }): number => {
  const r = (m.videoResolution || '').toLowerCase();
  if (r === '4k' || (m.width ?? 0) >= 3200) return 4;
  if (r === '1080' || (m.width ?? 0) >= 1700) return 3;
  if (r === '720' || (m.width ?? 0) >= 1200) return 2;
  return r || m.width ? 1 : 0;
};
export function resolutionOf(media?: Item['Media']): ResTier | null {
  if (!media?.length) return null;
  const best = media.reduce((a, m) => (tierOf(m) > tierOf(a) ? m : a));
  const t = tierOf(best);
  if (t === 4) return { label: '4K', tier: '4k' };
  if (t === 3) return { label: '1080p', tier: '1080' };
  if (t === 2) return { label: '720p', tier: '720' };
  if (t === 1) {
    const r = (best.videoResolution || '').toLowerCase();
    return { label: /^\d+$/.test(r) ? `${r}p` : 'SD', tier: 'low' };
  }
  return null;
}

// TV shows carry no file info, so a show's tag comes from its episodes: the most common tier (ties go to the
// higher one). One request per show library, cached for the session.
const showResCache = new Map<string, Promise<Record<string, ResTier>>>();
export function showResolutions(sectionKey: string): Promise<Record<string, ResTier>> {
  if (!showResCache.has(sectionKey)) {
    const p = items(`/library/sections/${sectionKey}/all?type=4`).then((eps) => {
      const counts: Record<string, Record<string, { n: number; res: ResTier; rank: number }>> = {};
      const rank = { '4k': 4, '1080': 3, '720': 2, low: 1 };
      for (const e of eps) {
        const res = resolutionOf(e.Media);
        if (!res || !e.grandparentRatingKey) continue;
        const show = (counts[e.grandparentRatingKey] ??= {});
        const c = (show[res.label] ??= { n: 0, res, rank: rank[res.tier] });
        c.n++;
      }
      return Object.fromEntries(
        Object.entries(counts).map(([rk, c]) => [rk, Object.values(c).sort((a, b) => b.n - a.n || b.rank - a.rank)[0].res]),
      );
    });
    p.catch(() => showResCache.delete(sectionKey));
    showResCache.set(sectionKey, p);
  }
  return showResCache.get(sectionKey)!;
}

// Release order (oldest first), for a collection's films: the first film's poster becomes the folder cover.
const released = (i: Item) => i.originallyAvailableAt || (i.year ? String(i.year) : '9999');
export const releaseOrder = (list: Item[]) => [...list].sort((a, b) => released(a).localeCompare(released(b)));

// A movie's TMDB or IMDb id as Plex knows it: the new Plex agent lists them in Guid (with includeGuids=1),
// the legacy agents put one in guid ('com.plexapp.agents.themoviedb://603?lang=en', '...imdb://tt0133093?...').
export function movieRef(i: Item): string | undefined {
  const ids = [...(i.Guid || []).map((g) => g.id), i.guid || ''];
  for (const id of ids) {
    const m = id.match(/^(?:tmdb|com\.plexapp\.agents\.themoviedb):\/\/(\d+)/);
    if (m) return `tmdb:${m[1]}`;
  }
  for (const id of ids) {
    const m = id.match(/^(?:imdb|com\.plexapp\.agents\.imdb):\/\/(tt\d+)/);
    if (m) return `imdb:${m[1]}`;
  }
}

export interface TmdbStatus {
  hasKey: boolean;
  cached: number;
}

// Movie grid folders, built from two read-only sources (nothing is written to Plex):
//  - the collections Plex already has (smart collections are saved filters, not franchises, so they're skipped)
//  - TMDB's franchise collections, when a TMDB key is set (looked up by the main process, cached on this PC)
// A film in several collections goes into the smallest one (the most specific, e.g. a trilogy over a 30-film
// universe). Collections that end up with fewer than 2 films stay as plain posters. Cached per library and refresh.
export interface Folder {
  col: Item; // a Plex collection, or a stand-in for a TMDB one (ratingKey 'tmdb-<id>')
  films: Item[]; // release order
  source: 'plex' | 'tmdb';
}
export interface Folders {
  byFilm: Record<string, Folder>;
  list: Folder[];
  tmdb?: { looked: number; failed: number; error?: string };
}
const folderCache = new Map<string, { refresh: number; p: Promise<Folders> }>();
export function collectionFolders(sectionKey: string, refresh: number): Promise<Folders> {
  const hit = folderCache.get(sectionKey);
  if (hit && hit.refresh === refresh) return hit.p;
  const p = (async () => {
    const cols = (await items(`/library/sections/${sectionKey}/collections`)).filter((c) => !Number(c.smart) && c.smart !== true);
    const all: { col: Item; films: Item[]; source: Folder['source'] }[] = await Promise.all(
      cols.map(async (col) => ({
        col,
        films: (await items(`/library/collections/${col.ratingKey}/children`)).filter((i) => i.type === 'movie'),
        source: 'plex' as const,
      })),
    );
    // Always asked: without a key, the main process answers from its cache only.
    let tmdb: Folders['tmdb'];
    {
      const movies = await items(`/library/sections/${sectionKey}/all?type=1&includeGuids=1`);
      const refs: Record<string, string> = {};
      for (const m of movies) {
        const r = movieRef(m);
        if (r) refs[m.ratingKey] = r;
      }
      const r = await window.plex.tmdbCollections(refs);
      if ('error' in r) tmdb = { looked: 0, failed: 0, error: r.error };
      else {
        tmdb = { looked: r.looked, failed: r.failed };
        const groups = new Map<number, { name: string; films: Item[] }>();
        for (const m of movies) {
          const c = r.byFilm[m.ratingKey];
          if (!c) continue;
          if (!groups.has(c.id)) groups.set(c.id, { name: c.name, films: [] });
          groups.get(c.id)!.films.push(m);
        }
        for (const [id, g] of groups)
          all.push({ col: { ratingKey: `tmdb-${id}`, key: '', type: 'collection', title: g.name }, films: g.films, source: 'tmdb' });
      }
    }
    const home: Record<string, (typeof all)[number]> = {};
    for (const c of all)
      for (const f of c.films) if (!home[f.ratingKey] || c.films.length < home[f.ratingKey].films.length) home[f.ratingKey] = c;
    const list: Folder[] = [];
    const byFilm: Record<string, Folder> = {};
    for (const c of all) {
      const films = releaseOrder(c.films.filter((f) => home[f.ratingKey] === c));
      if (films.length < 2) continue;
      const folder = { col: c.col, films, source: c.source };
      list.push(folder);
      for (const f of films) byFilm[f.ratingKey] = folder;
    }
    return { byFilm, list, tmdb };
  })();
  p.catch(() => folderCache.delete(sectionKey));
  folderCache.set(sectionKey, { refresh, p });
  return p;
}

export interface PlayerPrefs {
  fullscreen: boolean;
  autoplay: boolean;
  countdown: number;
  skipIntro: 'off' | 'button' | 'auto';
  audioLang: string;
  subLang: string;
  subMode: 'off' | 'smart' | 'always';
  hwdec: boolean;
  quality: 'default' | 'hq' | 'sharp';
  smoothMotion: boolean;
  shaders: string;
  extraArgs: string;
}

// A saved library view pinned to the sidebar.
export interface Pin {
  id: string;
  name: string;
  sectionKey: string;
  filters: Filters;
}

export interface UiPrefs {
  displayName: 'username' | 'title';
  brandLayout: 'inline' | 'stacked' | 'corner' | 'bold' | 'tagline' | 'gilded' | 'seal' | 'monogram' | 'row';
  updates: 'auto' | 'ask' | 'manual';
  badgeSound: string;
  badgesDuringPlayback: boolean;
  hiddenLibs: string[];
  showPlaylists: boolean;
  groupCollections: boolean;
  pins: Pin[];
}

export interface Prefs {
  player: PlayerPrefs;
  ui: UiPrefs;
}

export interface Filters {
  sort: string;
  genre: string;
  decade: string;
  unwatched: boolean;
}

export interface PlayOpts {
  queue?: string[];
  queueIndex?: number;
  shuffle?: boolean;
  fromStart?: boolean;
}

export interface Health {
  level: 'good' | 'warn' | 'bad';
  title: string;
  reason?: string;
  detail: string;
  checks: { label: string; value: string; level: 'good' | 'warn' | 'bad' }[];
  at?: number;
}

export interface UpdateState {
  state: 'idle' | 'dev' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error';
  current: string;
  mode: 'auto' | 'ask' | 'manual';
  packaged: boolean;
  version?: string;
  notes?: string;
  percent?: number;
  error?: string;
  checkedAt?: number;
  justUpdated?: { version: string; notes: string };
}

export interface PlayerState {
  playing: boolean;
  ratingKey?: string;
  title?: string;
  refresh?: boolean;
  error?: string;
}

declare global {
  interface Window {
    plex: {
      connect(): Promise<ConnectResult>;
      signIn(): Promise<ConnectResult>;
      signOut(): Promise<ConnectResult>;
      get(path: string): Promise<any>;
      getPrefs(): Promise<Prefs>;
      setPrefs(patch: { player?: Partial<PlayerPrefs>; ui?: Partial<UiPrefs> }): Promise<Prefs>;
      play(ratingKey: string, opts?: PlayOpts): Promise<{ ok?: boolean; title?: string; error?: string }>;
      stop(): Promise<void>;
      toggleFullscreen(): Promise<void>;
      onPlayerState(cb: (s: PlayerState) => void): () => void;
      health(): Promise<Health>;
      checkHealth(): Promise<Health>;
      simulateHealth(level: 'warn' | 'bad' | null): Promise<Health>;
      onHealth(cb: (h: Health) => void): () => void;
      badges(): Promise<import('./badges').BadgeState>;
      takeBadges(): Promise<string[]>;
      setFavoriteBadges(ids: string[]): Promise<import('./badges').BadgeState>;
      avatar(): Promise<string | null | { error: string }>;
      tmdbStatus(): Promise<TmdbStatus>;
      tmdbSetKey(key: string): Promise<TmdbStatus | { error: string }>;
      tmdbCollections(
        refs: Record<string, string>,
      ): Promise<{ byFilm: Record<string, { id: number; name: string }>; looked: number; failed: number } | { error: string }>;
      devGrantBadge?(id: string): Promise<void>;
      devPatronLapse?(): Promise<boolean>;
      onBadgesEarned(cb: () => void): () => void;
      onBadgeShown(cb: (id: string) => void): () => void;
      updateState(): Promise<UpdateState>;
      checkUpdate(): Promise<UpdateState>;
      downloadUpdate(): Promise<UpdateState>;
      installUpdate(): Promise<{ ok?: boolean; error?: string }>;
      onUpdate(cb: (s: UpdateState) => void): () => void;
    };
  }
}

export async function get<T = any>(path: string): Promise<T> {
  const r = await window.plex.get(path);
  if (r && r.error) throw new Error(r.error);
  return r;
}

// Only video libraries are shown: music and photo sections are stripped out on purpose.
export async function sections(): Promise<Section[]> {
  const r = await get('/library/sections');
  return (r.MediaContainer.Directory || []).filter((d: Section) => d.type === 'movie' || d.type === 'show');
}

export async function items(path: string): Promise<Item[]> {
  const r = await get(path);
  return r.MediaContainer.Metadata || [];
}

export async function directory(path: string): Promise<{ key: string; title: string }[]> {
  const r = await get(path);
  return r.MediaContainer.Directory || [];
}

export const SORTS: [string, string][] = [
  ['titleSort', 'Title'],
  ['addedAt:desc', 'Recently added'],
  ['originallyAvailableAt:desc', 'Release date'],
  ['audienceRating:desc', 'Rating'],
  ['lastViewedAt:desc', 'Recently watched'],
];

export const DEFAULT_FILTERS: Filters = { sort: 'titleSort', genre: '', decade: '', unwatched: false };

export function libraryQuery(section: Section, f: Filters) {
  const q = new URLSearchParams({ sort: f.sort });
  if (f.genre) q.set('genre', f.genre);
  if (f.decade) q.set('decade', f.decade);
  if (f.unwatched) q.set(section.type === 'show' ? 'unwatchedLeaves' : 'unwatched', '1');
  return `/library/sections/${section.key}/all?${q}`;
}

export const markWatched = (rk: string, watched: boolean) =>
  get(`/:/${watched ? 'scrobble' : 'unscrobble'}?key=${rk}&identifier=com.plexapp.plugins.library`);

export const isWatched = (i: Item) =>
  i.type === 'show' || i.type === 'season' ? !!i.leafCount && i.leafCount === i.viewedLeafCount : !!i.viewCount;

export const playable = (i: Item) => i.type === 'movie' || i.type === 'episode';

// For a show or season: the episode to play next (Plex's On Deck), else the first unwatched, else the first.
export async function nextEpisode(i: Item): Promise<Item | undefined> {
  if (i.type === 'show') {
    const [m] = await items(`/library/metadata/${i.ratingKey}?includeOnDeck=1`);
    // Plex returns OnDeck.Metadata as a single object here, not an array.
    const deck = m?.OnDeck?.Metadata;
    const ep = Array.isArray(deck) ? deck[0] : deck;
    if (ep) return ep;
  }
  const leaves = await items(`/library/metadata/${i.ratingKey}/allLeaves`);
  return leaves.find((e) => !e.viewCount) || leaves[0];
}

export const img = (thumb: string | undefined, w: number, h: number) =>
  // Plex artwork paths start with '/'; anything else (demo-mode bundled posters) is already a usable URL.
  !thumb ? undefined : !thumb.startsWith('/') ? thumb : `plximg://img/?u=${encodeURIComponent(thumb)}&w=${w}&h=${h}`;

export const minutes = (ms?: number) => (ms ? `${Math.round(ms / 60000)} min` : '');

export const episodeLabel = (e: Item) => `S${e.parentIndex ?? '?'} · E${e.index ?? '?'}`;
