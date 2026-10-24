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
  lastViewedAt?: number; // unix seconds; Plex sets it whenever the item is marked watched
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
  tagline?: string;
  studio?: string;
  // Scores Plex's agent saved: image is e.g. 'imdb://image.rating', 'rottentomatoes://image.rating.ripe'
  // (critics; .rotten when under 60%), 'rottentomatoes://image.rating.upright' (audience; .spilled), 'themoviedb://image.rating'.
  Rating?: { image: string; value: number; type: 'critic' | 'audience' | string }[];
  Director?: Person[];
  Writer?: Person[];
  Producer?: Person[];
  Role?: Person[];
  Media?: Media[];
  OnDeck?: { Metadata?: Item | Item[] };
}

export interface Person {
  id?: number;
  tag: string; // the name
  role?: string; // the character, for cast
  thumb?: string;
}

export interface Stream {
  streamType: number; // 1 video, 2 audio, 3 subtitles
  codec?: string;
  language?: string;
  displayTitle?: string;
  extendedDisplayTitle?: string;
  title?: string;
  selected?: boolean;
  default?: boolean;
  forced?: boolean;
  channels?: number;
  audioChannelLayout?: string;
  bitDepth?: number;
  bitrate?: number;
  samplingRate?: number;
  frameRate?: number;
  colorTrc?: string;
  colorPrimaries?: string;
  DOVIPresent?: boolean;
  DOVIProfile?: number;
  profile?: string;
  hearingImpaired?: boolean;
}

export interface Media {
  videoResolution?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  videoFrameRate?: string;
  videoProfile?: string;
  Part?: { file?: string; size?: number; container?: string; Stream?: Stream[] }[];
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

// The details page's optional live sources (see electron/details.cjs).
export interface DetailsStatus {
  tmdb: boolean;
  trakt: boolean;
  omdb: boolean;
}
type Score = { value: number; votes?: number };
export interface LiveScores {
  tmdb?: Score;
  trakt?: Score;
  imdb?: Score;
  rt?: Score; // Tomatometer, percent
  metacritic?: Score; // 0-100
  errors: string[];
  at: number;
}
export interface Life {
  id: number;
  birthday: string | null; // 'YYYY-MM-DD'
  deathday: string | null;
  place: string | null;
}

// A title's IMDb and TMDB ids, from Plex's Guid list.
export function externalIds(i: Item): { imdb?: string; tmdb?: string } {
  const ids = [...(i.Guid || []).map((g) => g.id), i.guid || ''];
  const pick = (re: RegExp) => ids.map((id) => id.match(re)?.[1]).find(Boolean);
  return {
    imdb: pick(/^(?:imdb|com\.plexapp\.agents\.imdb):\/\/(tt\d+)/),
    tmdb: pick(/^(?:tmdb|com\.plexapp\.agents\.themoviedb):\/\/(\d+)/),
  };
}

// Movie grid folders, built from two read-only sources (nothing is written to Plex):
//  - the collections Plex already has (smart collections are saved filters, not franchises, so they're skipped)
//  - TMDB's franchise collections, when a TMDB key is set (looked up by the main process, cached on this PC)
// A film in several collections goes into the smallest one (the most specific, e.g. a trilogy over a 30-film
// universe). Collections that end up with fewer than 2 films stay as plain posters. Cached per library and refresh.
export interface Folder {
  key: string; // 'plex:<ratingKey>' | 'tmdb:<id>' | 'mine:<id>' (what "Add to collection" remembers)
  col: Item; // a Plex collection, or a stand-in for a TMDB one ('tmdb-<id>') or one of yours ('mine-<id>')
  films: Item[]; // release order
  source: 'plex' | 'tmdb' | 'mine';
}
// "Add to collection" choices (electron/my-collections.cjs), keyed by film guid.
export interface MyCollections {
  assign: Record<string, { key: string; name: string }>;
  mine: Record<string, { name: string }>;
}
export interface Folders {
  byFilm: Record<string, Folder>;
  list: Folder[];
  all: Folder[]; // every collection, including ones with a single film (the Collections page)
  tmdb?: { looked: number; failed: number; error?: string };
}
const folderCache = new Map<string, { refresh: number; p: Promise<Folders> }>();
export function collectionFolders(sectionKey: string, refresh: number): Promise<Folders> {
  const hit = folderCache.get(sectionKey);
  if (hit && hit.refresh === refresh) return hit.p;
  const p = (async () => {
    const cols = (await items(`/library/sections/${sectionKey}/collections`)).filter((c) => !Number(c.smart) && c.smart !== true);
    const all: { key: string; col: Item; films: Item[]; source: Folder['source'] }[] = await Promise.all(
      cols.map(async (col) => ({
        key: `plex:${col.ratingKey}`,
        col,
        films: (await items(`/library/collections/${col.ratingKey}/children`)).filter((i) => i.type === 'movie'),
        source: 'plex' as const,
      })),
    );
    let movies: Item[] = [];
    // Always asked: without a key, the main process answers from its cache only.
    let tmdb: Folders['tmdb'];
    {
      movies = await items(`/library/sections/${sectionKey}/all?type=1&includeGuids=1`);
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
          all.push({ key: `tmdb:${id}`, col: { ratingKey: `tmdb-${id}`, key: '', type: 'collection', title: g.name }, films: g.films, source: 'tmdb' });
      }
    }
    // Your own choices win over Plex and TMDB: a film you put in a collection lives there.
    const mine: MyCollections = await window.plex.myCollections().catch(() => ({ assign: {}, mine: {} }));
    const byKey = new Map(all.map((c) => [c.key, c]));
    const chosen: Record<string, (typeof all)[number]> = {};
    for (const m of movies) {
      const a = m.guid && mine.assign[m.guid];
      if (!a) continue;
      let target = byKey.get(a.key);
      if (!target && a.key.startsWith('mine:')) {
        const id = a.key.slice(5);
        target = { key: a.key, col: { ratingKey: `mine-${id}`, key: '', type: 'collection', title: mine.mine[id]?.name || a.name }, films: [], source: 'mine' };
        all.push(target);
        byKey.set(a.key, target);
      }
      if (!target) continue; // its Plex collection or TMDB series is gone: the film goes back to normal grouping
      if (!target.films.some((f) => f.ratingKey === m.ratingKey)) target.films.push(m);
      chosen[m.ratingKey] = target;
    }
    const home: Record<string, (typeof all)[number]> = { ...chosen };
    for (const c of all)
      for (const f of c.films) if (!chosen[f.ratingKey] && (!home[f.ratingKey] || c.films.length < home[f.ratingKey].films.length)) home[f.ratingKey] = c;
    const list: Folder[] = [];
    const every: Folder[] = [];
    const byFilm: Record<string, Folder> = {};
    for (const c of all) {
      const films = releaseOrder(c.films.filter((f) => home[f.ratingKey] === c));
      if (!films.length) continue;
      const folder = { key: c.key, col: c.col, films, source: c.source };
      every.push(folder);
      if (films.length < 2) continue;
      list.push(folder);
      for (const f of films) byFilm[f.ratingKey] = folder;
    }
    every.sort((a, b) => a.col.title.localeCompare(b.col.title));
    return { byFilm, list, all: every, tmdb };
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
  autoSubs?: boolean; // find English subtitles for files that have none (electron/subtitles.cjs); default on
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
  navOrder?: string[]; // sidebar order: 'continue', 'music', 'lib:<key>' (components.tsx navEntries)
  theme?: string; // color theme id (components.tsx THEMES); unset = Vanta Gold
  posterSize?: number; // poster grid cover width in px (the library header's slider)
  title?: string; // the chosen sidebar title; unset = the first one unlocked, 'none' = no title
}

// Sidebar titles shown under a username, unlocked per Plex username (unique on plex.tv). Only these accounts see
// the title picker in Settings. More titles get added here as they're handed out.
const USER_TITLES: Record<string, string[]> = { soybean_alien: ['<Dev>'] };
export const titlesFor = (username?: string) => (username && USER_TITLES[username]) || [];
// Accounts whose name itself is drawn in bright gold in the sidebar.
export const goldName = (username?: string) => username === 'soybean_alien';
export const shownTitle = (username: string | undefined, chosen?: string) => {
  const list = titlesFor(username);
  if (chosen === 'none') return '';
  return chosen && list.includes(chosen) ? chosen : list[0] || '';
};

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
      detailsStatus(): Promise<DetailsStatus>;
      detailsSetKey(service: 'trakt' | 'omdb', key: string): Promise<DetailsStatus | { error: string }>;
      liveScores(ids: { kind: 'movie' | 'show'; imdb?: string; tmdb?: string }): Promise<LiveScores | { error: string }>;
      watchLog(): Promise<Record<string, number> | { error: string }>;
      watchLogRecord(meta: { guid: string; title: string; type: string }): Promise<void>;
      watchLogForget(guid: string): Promise<void>;
      watchLogMerge(entries: Record<string, { at: number; title: string; type: string }>): Promise<void>;
      exportBackup(opts: { password?: string; uiStorage: Record<string, string> }): Promise<{
        canceled?: boolean;
        file?: string;
        badges?: number;
        watched?: number;
        collections?: number;
        secrets?: boolean;
        error?: string;
      }>;
      importBackup(opts: { again?: boolean; password?: string }): Promise<{
        canceled?: boolean;
        needsPassword?: boolean;
        file?: string;
        badgesAdded?: number;
        watchedAdded?: number;
        collectionsAdded?: number;
        secrets?: boolean;
        uiStorage?: Record<string, string>;
        from?: string;
        error?: string;
      }>;
      restartApp(): Promise<void>;
      subsEnqueue(ratingKeys: string[]): Promise<{ queued: number } | { error: string }>;
      subsStatus(): Promise<{ found: number; none: number; queued: number; enabled: boolean }>;
      subsImport(meta: { guid?: string; title: string }): Promise<{ ok?: boolean; canceled?: boolean; name?: string; error?: string }>;
      myCollections(): Promise<MyCollections>;
      myCollectionAssign(guid: string, key: string | null, name: string): Promise<MyCollections | { error: string }>;
      myCollectionUnassign(guid: string): Promise<MyCollections | { error: string }>;
      spotifyStatus(): Promise<import('./music').SpotifyStatus>;
      spotifySetClientId(id: string): Promise<import('./music').SpotifyStatus | { error: string }>;
      spotifyConnect(): Promise<import('./music').SpotifyStatus | { error: string }>;
      spotifyDisconnect(): Promise<import('./music').SpotifyStatus>;
      spotifyLibrary(): Promise<any>;
      spotifyNowPlaying(): Promise<any>;
      spotifyDevices(): Promise<any>;
      spotifyPlay(uri: string, deviceId?: string): Promise<{ ok?: boolean; error?: string }>;
      spotifyControl(action: 'pause' | 'resume' | 'next' | 'previous'): Promise<{ ok?: boolean; error?: string }>;
      castLives(req: { kind: 'movie' | 'show'; tmdb?: string; names: string[] }): Promise<{ people: Record<string, Life>; noKey?: boolean } | { error: string }>;
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
  const list: Item[] = r.MediaContainer.Metadata || [];
  keepWatchDates(list);
  return list;
}

// Vanta's own watch log (electron/history.cjs): guid -> last watched (ms). Loaded at startup; it keeps the
// last-watched dates even if Plex's database loses them.
let watchLog: Record<string, number> = {};
export const loadWatchLog = () =>
  window.plex.watchLog().then((l) => {
    if (l && !('error' in l)) watchLog = l as Record<string, number>;
  });

// Copies the dates Plex has into the log as lists load (only new or newer ones, so it's quiet after the first time).
function keepWatchDates(list: Item[]) {
  const fresh: Record<string, { at: number; title: string; type: string }> = {};
  for (const i of list) {
    if (!i.guid || !i.lastViewedAt || !isWatched(i) || i.type === 'season') continue;
    const at = i.lastViewedAt * 1000;
    if ((watchLog[i.guid] ?? 0) >= at) continue;
    watchLog[i.guid] = at;
    fresh[i.guid] = { at, title: i.title, type: i.type };
  }
  if (Object.keys(fresh).length) window.plex.watchLogMerge(fresh);
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

// Also updates Vanta's watch log: marking watched stamps today's date, marking unwatched removes the date.
export const markWatched = async (rk: string, watched: boolean, item?: Item) => {
  const r = await get(`/:/${watched ? 'scrobble' : 'unscrobble'}?key=${rk}&identifier=com.plexapp.plugins.library`);
  if (item?.guid && (item.type === 'movie' || item.type === 'episode' || item.type === 'show')) {
    if (watched) {
      watchLog[item.guid] = Date.now();
      window.plex.watchLogRecord({ guid: item.guid, title: item.title, type: item.type });
    } else {
      delete watchLog[item.guid];
      window.plex.watchLogForget(item.guid);
    }
  }
  return r;
};

export const isWatched = (i: Item) =>
  i.type === 'show' || i.type === 'season' ? !!i.leafCount && i.leafCount === i.viewedLeafCount : !!i.viewCount;

// When a title was last watched, as MM/DD/YYYY: the newer of Plex's date and Vanta's log. Vanta's log alone is
// enough (Plex may have lost its record); an item part-way through a rewatch shows no date ('' = nothing to show).
export const watchedOn = (i: Item) => {
  const logged = (i.guid && watchLog[i.guid]) || 0;
  const plexAt = isWatched(i) && i.lastViewedAt ? i.lastViewedAt * 1000 : 0;
  const at = Math.max(logged, plexAt);
  if (!at || i.viewOffset || (!isWatched(i) && !logged)) return '';
  const d = new Date(at);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

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
  // Plex artwork paths start with '/', and cast photos live on Plex's metadata host; both go through the server's
  // transcoder. Anything else (demo-mode bundled posters) is already a usable URL.
  !thumb
    ? undefined
    : !thumb.startsWith('/') && !thumb.startsWith('https://metadata-static.plex.tv/')
      ? thumb
      : `plximg://img/?u=${encodeURIComponent(thumb)}&w=${w}&h=${h}`;

export const minutes = (ms?: number) => (ms ? `${Math.round(ms / 60000)} min` : '');

export const episodeLabel = (e: Item) => `S${e.parentIndex ?? '?'} · E${e.index ?? '?'}`;
