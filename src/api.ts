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
  languageCode?: string;
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
  probed?: boolean; // details read from the file by Vanta, because Plex never analyzed it
  unreadable?: boolean; // neither Plex nor Vanta could open the file (damaged or incomplete)
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

export interface TmdbStatus {
  hasKey: boolean;
  cached: number;
}

// The details page's optional live sources (see electron/details.cjs).
export interface DetailsStatus {
  tmdb: boolean;
  trakt: boolean;
  traktBuiltIn?: boolean; // Vanta's own Trakt app id is set, so no Trakt key is needed
  omdb: boolean;
}

// Trakt sign-in and sync (electron/trakt.cjs).
export interface TraktStatus {
  available: boolean;
  connected: boolean;
  user: { username: string; name?: string } | null;
  autoSync: boolean;
  lastSync: { pulled: number; pushed: number; notFound: number; at: number } | null;
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
export interface BoxOffice {
  budget: number | null;
  opening: number | null; // domestic (US) opening weekend
  worldwide: number | null;
  src: string[];
}
export interface Life {
  id: number;
  birthday: string | null; // 'YYYY-MM-DD'
  deathday: string | null;
  place: string | null;
  src?: string | null; // where the birthday came from: TMDB, Wikidata, Trakt or TVmaze
  deathSrc?: string | null; // set only when the death came from a different source than TMDB
  birthYear?: number | null; // only when no source has the exact birthday; ages from it are shown as estimated
  yearSrc?: string | null;
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

// Collections are yours alone: Vanta groups nothing on its own (no TMDB series, no Plex collections, no sort order
// from Plex). Every film of every movie library shown in the sidebar is read into one pool, so a collection holds
// films from any library ("Movies" and "New Arrivals" alike). A film is in one collection at most
// (electron/my-collections.cjs), and in the movie grid it folds into that collection's tile.
export interface Folder {
  key: string; // 'mine:<id>' (electron/my-collections.cjs)
  col: Item; // a stand-in item for the collection ('mine-<id>')
  films: Item[]; // release order, from every library
  poster?: string;
}
// A collection's cover: TMDB's poster for a collection of exactly that name ("Saw" finds the Saw Collection's), with
// Official release posters on; else its first film's. Only the art comes from TMDB, never which films are in it.
export const folderCover = (f: Folder, official: boolean) => (official && f.poster) || f.films[0]?.thumb;
// Your collections (electron/my-collections.cjs): films by Plex guid.
export interface MyCollections {
  mine: Record<string, { name: string; films: string[] }>;
}
export interface Folders {
  byFilm: Record<string, Folder>; // ratingKey -> the collection the film folds into in the grid
  list: Folder[]; // collections with films, A to Z
  all: Folder[]; // every collection, empty ones too (the Add to collection picker)
}
let folderCache: { sig: string; p: Promise<Folders> } | undefined;
export function collectionFolders(refresh: number, hidden: string[]): Promise<Folders> {
  const sig = JSON.stringify([refresh, [...hidden].sort()]);
  if (folderCache?.sig === sig) return folderCache.p;
  const p = (async () => {
    const mine: MyCollections = await window.plex.myCollections().catch(() => ({ mine: {} }));
    const ids = Object.entries(mine.mine || {}).sort((a, b) => a[1].name.localeCompare(b[1].name));
    const wanted = new Set(ids.flatMap(([, m]) => m.films));
    // Every copy of a film (the same film can sit in two libraries) folds into its collection.
    const copies = new Map<string, Item[]>();
    if (wanted.size) {
      const libs = (await sections()).filter((s) => s.type === 'movie' && !hidden.includes(s.key));
      for (const m of (await Promise.all(libs.map((s) => items(`/library/sections/${s.key}/all?type=1`)))).flat())
        if (m.guid && wanted.has(m.guid)) copies.set(m.guid, [...(copies.get(m.guid) || []), m]);
    }
    const byFilm: Record<string, Folder> = {};
    const all: Folder[] = [];
    for (const [id, m] of ids) {
      const films = releaseOrder(m.films.map((g) => copies.get(g)?.[0]).filter((i): i is Item => !!i));
      const folder: Folder = { key: `mine:${id}`, col: { ratingKey: `mine-${id}`, key: '', type: 'collection', title: m.name }, films };
      all.push(folder);
      for (const g of m.films)
        for (const c of copies.get(g) || []) byFilm[c.ratingKey] ??= folder;
    }
    const list = all.filter((f) => f.films.length);
    await Promise.all(
      list.map(async (f) => {
        f.poster = (await window.plex.tmdbCollectionPoster(f.col.title).catch(() => null)) || undefined;
      }),
    );
    return { byFilm, list, all };
  })();
  p.catch(() => {
    if (folderCache?.p === p) folderCache = undefined;
  });
  folderCache = { sig, p };
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
  officialCovers?: boolean; // TMDB's main poster for every movie and show instead of Plex's (default on)
  pins: Pin[];
  navOrder?: string[]; // sidebar order: 'continue', 'music', 'lib:<key>' (components.tsx navEntries)
  theme?: string; // color theme id (components.tsx THEMES); unset = Vanta Gold
  traktAutoSync?: boolean; // send each watch to Trakt as it happens (default on once connected)
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
      deleteItem(ratingKey: string): Promise<{ ok: true } | { error: string }>;
      canDelete(): Promise<boolean | null | { error: string }>;
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
      tmdbCollectionPoster(name: string): Promise<string | null>;
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
        subtitles?: number;
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
        subtitlesAdded?: number;
        secrets?: boolean;
        uiStorage?: Record<string, string>;
        from?: string;
        error?: string;
      }>;
      restartApp(): Promise<void>;
      traktStatus(): Promise<TraktStatus>;
      traktConnect(): Promise<{ userCode: string; url: string; expiresIn: number } | { error: string }>;
      traktConnectWait(): Promise<TraktStatus | { error: string }>;
      traktConnectCancel(): Promise<TraktStatus>;
      traktDisconnect(): Promise<TraktStatus>;
      traktSync(): Promise<{ pulled: number; pushed: number; notFound: number; at: number } | { error: string }>;
      traktMark(ratingKey: string, watched: boolean): Promise<void>;
      subsEnqueue(ratingKeys: string[]): Promise<{ queued: number } | { error: string }>;
      subsStatus(): Promise<{ found: number; none: number; queued: number; enabled: boolean }>;
      subsImport(meta: { guid?: string; title: string }): Promise<{ ok?: boolean; canceled?: boolean; name?: string; error?: string }>;
      myCollections(): Promise<MyCollections>;
      myCollectionAdd(guid: string | string[], key: string | null, name: string): Promise<MyCollections | { error: string }>;
      myCollectionDrop(guid: string, key: string): Promise<MyCollections | { error: string }>;
      myCollectionRename(key: string, name: string): Promise<MyCollections | { error: string }>;
      myCollectionDelete(key: string): Promise<MyCollections | { error: string }>;
      myCollectionReset(): Promise<MyCollections | { error: string }>;
      spotifyStatus(): Promise<import('./music').SpotifyStatus>;
      spotifySetClientId(id: string): Promise<import('./music').SpotifyStatus | { error: string }>;
      spotifyConnect(): Promise<import('./music').SpotifyStatus | { error: string }>;
      spotifyDisconnect(): Promise<import('./music').SpotifyStatus>;
      spotifyLibrary(): Promise<any>;
      spotifyNowPlaying(): Promise<any>;
      spotifyDevices(): Promise<any>;
      spotifyPlay(uri: string, deviceId?: string): Promise<{ ok?: boolean; error?: string }>;
      spotifyControl(action: 'pause' | 'resume' | 'next' | 'previous'): Promise<{ ok?: boolean; error?: string }>;
      castLives(req: { kind: 'movie' | 'show'; tmdb?: string; names: string[]; token?: string }): Promise<{ people: Record<string, Life>; noKey?: boolean; keyRejected?: boolean } | { error: string }>;
      onCastLife(cb: (token: string, name: string, life: Life) => void): () => void;
      titleLanguage(ids: { kind: 'movie' | 'show'; tmdb?: string }): Promise<{ lang: string | null } | { error: string }>;
      // File details read from the file itself when Plex never analyzed it (null when Plex already has them).
      fileDetails?(ratingKey: string): Promise<Media[] | null | { error: string }>;
      // Budget, US opening weekend and worldwide gross in dollars (null where unknown), for the movie grid.
      boxOffice?(ratingKey: string): Promise<BoxOffice | null | { error: string }>;
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
  window.plex.traktMark(rk, watched).catch?.(() => {}); // Trakt history too, when connected (best effort)
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
const watchedAt = (i: Item) => {
  const logged = (i.guid && watchLog[i.guid]) || 0;
  const plexAt = isWatched(i) && i.lastViewedAt ? i.lastViewedAt * 1000 : 0;
  const at = Math.max(logged, plexAt);
  return !at || i.viewOffset || (!isWatched(i) && !logged) ? 0 : at;
};
export const watchedOn = (i: Item) => {
  const at = watchedAt(i);
  if (!at) return '';
  const d = new Date(at);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

// The same moment with the time, in New York time (12-hour, no seconds), for the details page: "10/22/2026 9:41 PM".
const NY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const nyTime = (at: number) => {
  const p = Object.fromEntries(NY.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.month}/${p.day}/${p.year} ${p.hour}:${p.minute} ${p.dayPeriod}`;
};
export const watchedOnWithTime = (i: Item) => {
  const at = watchedAt(i);
  return at ? nyTime(at) : '';
};
// A show or season you're part-way through: when you last watched any of its episodes (Plex's lastViewedAt).
export const lastEpisodeWatchedWithTime = (i: Item) =>
  (i.type === 'show' || i.type === 'season') && !isWatched(i) && i.lastViewedAt ? nyTime(i.lastViewedAt * 1000) : '';

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

// Part of every artwork URL, so switching Official release posters reloads the covers instead of reusing old ones.
let coverMode = '';
export const setCoverMode = (official: boolean) => {
  coverMode = official ? '' : '&plex=1';
};
// Titles Plex took from a file name ("Antichrist.2009.1080p.BluRay.x265-RARBG") shown as the name alone ("Antichrist").
// Only names that look like release files are touched: real titles with years in them ("Blade Runner 2049", "1917")
// stay as they are.
const RELEASE_TAG =
  /^(\d{3,4}p|4k|uhd|hdr\d*|dv|dovi|sdr|blu-?ray|bdrip|brrip|bdremux|remux|web(-?dl|-?rip)?|hdrip|dvd(rip|scr)?|hdtv|x26[45]|h\.?26[45]|hevc|avc|xvid|divx|aac\d*|ac3|e?ac-?3|dts(-?hd)?|truehd|atmos|ddp?\d*|\d\.\d|10bit|8bit|proper|repack|extended|unrated|uncut|remastered|imax|yify|yts|rarbg|mkv|mp4|avi)$/i;
export function cleanTitle(title: string | undefined) {
  const t = String(title || '').trim();
  const words = t.split(/[._\s]+/).filter(Boolean);
  const fileLike = /[._]/.test(t) && !/\s/.test(t.replace(/[._]/g, '')) && words.length > 1;
  if (!fileLike || !words.some((w) => RELEASE_TAG.test(w) || /^[([]?(19|20)\d{2}[)\]]?$/.test(w))) return t;
  const firstTag = words.findIndex((w) => RELEASE_TAG.test(w.replace(/-.*$/, '')));
  const head = firstTag > 0 ? words.slice(0, firstTag) : words;
  const now = new Date().getFullYear() + 1;
  // The release year is the last year-shaped word with a name before it.
  let cut = head.length;
  head.forEach((w, i) => {
    const y = Number(w.replace(/[()[\]]/g, ''));
    if (i > 0 && /^[([]?\d{4}[)\]]?$/.test(w) && y >= 1900 && y <= now) cut = i;
  });
  return head.slice(0, cut).join(' ').replace(/\s*-\s*$/, '') || t;
}

export const img = (thumb: string | undefined, w: number, h: number) =>
  // Plex artwork paths start with '/', and cast photos live on Plex's metadata host; both go through the server's
  // transcoder. Anything else (demo-mode bundled posters) is already a usable URL.
  !thumb
    ? undefined
    : !thumb.startsWith('/') && !thumb.startsWith('https://metadata-static.plex.tv/') && !thumb.startsWith('https://image.tmdb.org/t/p/')
      ? thumb
      : `plximg://img/?u=${encodeURIComponent(thumb)}&w=${w}&h=${h}${coverMode}`;

export const minutes = (ms?: number) => (ms ? `${Math.round(ms / 60000)} min` : '');

export const episodeLabel = (e: Item) => `S${e.parentIndex ?? '?'} · E${e.index ?? '?'}`;
