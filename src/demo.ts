// Vanta by soybean_alien
// Demo mode: a sample library of public-domain films standing in for a Plex server, so the README media shows real
// poster art without any personal data. Posters are Wikimedia Commons files marked public domain; see
// demo/posters/CREDITS.md. Start it with `npm run demo` (electron . --demo).
import type { Health, Item, Prefs } from './api';
import CATALOG from '../electron/badge-catalog.json';
import { version as VERSION } from '../package.json';

const POSTERS = import.meta.glob('../demo/posters/*.{jpg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const poster = (title: string) => POSTERS[`../demo/posters/${slug(title)}.jpg`] || POSTERS[`../demo/posters/${slug(title)}.png`];

type Film = [title: string, year: number, minutes: number, genres: string[], logline: string];

// Library 1: sound-era films.
const MOVIES: Film[] = [
  ['Beat the Devil', 1953, 89, ['Comedy', 'Adventure'], 'A band of swindlers waits on the Italian coast for a ship to Africa, and a uranium scheme that keeps falling apart.'],
  ['Carnival of Souls', 1962, 78, ['Horror', 'Mystery'], 'After surviving a car crash, a church organist is drawn to an abandoned lakeside pavilion and the pale figures waiting there.'],
  ['Charade', 1963, 113, ['Thriller', 'Romance', 'Comedy'], 'A widow in Paris is chased by her late husband’s partners for stolen money, helped by a charming stranger with too many names.'],
  ['D.O.A.', 1950, 83, ['Crime', 'Film-Noir'], 'An accountant learns he has been poisoned and spends his last hours hunting the person who killed him.'],
  ['Detour', 1945, 68, ['Crime', 'Film-Noir'], 'A hitchhiking pianist heading west makes one bad decision on the highway and can’t stop paying for it.'],
  ['His Girl Friday', 1940, 92, ['Comedy', 'Romance'], 'An editor sabotages his star reporter’s engagement by sending her after the story of the year.'],
  ['Night of the Living Dead', 1968, 96, ['Horror'], 'Strangers barricade themselves in a farmhouse as the recently dead rise and surround them.'],
  ['Plan 9 from Outer Space', 1957, 79, ['Sci-Fi', 'Horror'], 'Aliens raise the dead to stop humanity from building a doomsday weapon.'],
  ['Reefer Madness', 1936, 66, ['Drama'], 'A school principal’s cautionary tale about students led astray, now remembered mostly for its excess.'],
  ['Santa Claus Conquers the Martians', 1964, 81, ['Sci-Fi', 'Family'], 'Martians kidnap Santa Claus so the children of Mars can have a Christmas too.'],
  ['The Brain That Wouldn\'t Die', 1962, 82, ['Sci-Fi', 'Horror'], 'A surgeon keeps his fiancée’s head alive after an accident and goes looking for a new body.'],
  ['The Hitch-Hiker', 1953, 71, ['Thriller', 'Film-Noir'], 'Two friends on a fishing trip pick up a stranger who turns out to be a wanted killer.'],
  ['The Man with the Golden Arm', 1955, 119, ['Drama'], 'A card dealer back from prison fights addiction and the people who profit from it.'],
  ['The Stranger', 1946, 95, ['Thriller', 'Film-Noir'], 'A war-crimes investigator tracks a fugitive to a quiet Connecticut town, where he is about to marry.'],
  ['The Terror', 1963, 81, ['Horror'], 'A lost French officer follows a mysterious woman to a baron’s castle on the Baltic coast.'],
];

// Library 2: silent classics.
const SILENTS: Film[] = [
  ['Metropolis', 1927, 153, ['Sci-Fi', 'Drama'], 'In a towering future city, the son of its ruler discovers the workers who keep it running underground.'],
  ['Our Hospitality', 1923, 74, ['Comedy'], 'A young man returns home to claim an estate and walks straight into a family feud.'],
  ['Safety Last!', 1923, 73, ['Comedy'], 'A department-store clerk climbs the outside of a skyscraper to win a publicity prize.'],
  ['Sherlock Jr.', 1924, 45, ['Comedy'], 'A projectionist who dreams of being a detective falls asleep and walks into the film on screen.'],
  ['Steamboat Bill, Jr.', 1928, 70, ['Comedy'], 'A college boy joins his riverboat-captain father just as a cyclone hits the town.'],
  ['The Cabinet of Dr. Caligari', 1920, 77, ['Horror', 'Mystery'], 'A carnival hypnotist and his sleepwalker are linked to a string of murders in a crooked, painted town.'],
  ['The General', 1926, 78, ['Comedy', 'Action'], 'A Southern railroad engineer chases the Union spies who stole his locomotive.'],
  ['The Gold Rush', 1925, 95, ['Comedy', 'Adventure'], 'A lone prospector braves the Klondike, a hungry partner and a dance-hall romance.'],
  ['The Great Train Robbery', 1903, 12, ['Western', 'Action'], 'Bandits hold up a train and a posse rides after them, in one of the first Westerns ever filmed.'],
  ['The Hunchback of Notre Dame', 1923, 133, ['Drama'], 'The bell-ringer of Notre Dame protects a dancer condemned by the city of Paris.'],
  ['The Kid', 1921, 68, ['Comedy', 'Drama'], 'A tramp takes in an abandoned baby, and five years later the authorities come for the boy.'],
  ['The Lost World', 1925, 106, ['Adventure', 'Sci-Fi'], 'An expedition to a South American plateau finds dinosaurs alive, and brings one home to London.'],
  ['The Navigator', 1924, 59, ['Comedy'], 'Two wealthy, helpless young people end up alone on an ocean liner drifting out to sea.'],
  ['The Phantom of the Opera', 1925, 93, ['Horror', 'Drama'], 'A masked figure beneath the Paris Opera House takes an interest in a young singer.'],
  ['The Thief of Bagdad', 1924, 149, ['Adventure', 'Fantasy'], 'A thief falls for a princess and sets out on a quest of magic carpets and winged horses.'],
];

// ── 2.0 details-page sample data ───────────────────────────────────────
// Two films get their real credits so the details page, Cast & Crew and person pages can be shown. Only public facts
// are used (names, characters, birth and death dates); no photos of people are bundled, so cards show initials.
// Scores are sample values for the demo, not live data.
type Person = { id: number; name: string; birthday: string; deathday?: string; place: string };
const PEOPLE: Record<string, Person> = Object.fromEntries(
  (
    [
      [1, 'Cary Grant', '1904-01-18', '1986-11-29', 'Bristol, England, UK'],
      [2, 'Audrey Hepburn', '1929-05-04', '1993-01-20', 'Ixelles, Brussels, Belgium'],
      [3, 'Walter Matthau', '1920-10-01', '2000-07-01', 'New York City, New York, USA'],
      [4, 'James Coburn', '1928-08-31', '2002-11-18', 'Laurel, Nebraska, USA'],
      [5, 'George Kennedy', '1925-02-18', '2016-02-28', 'New York City, New York, USA'],
      [6, 'Stanley Donen', '1924-04-13', '2019-02-21', 'Columbia, South Carolina, USA'],
      [7, 'Peter Stone', '1930-02-27', '2003-04-26', 'Los Angeles, California, USA'],
      [8, 'Rosalind Russell', '1907-06-04', '1976-11-28', 'Waterbury, Connecticut, USA'],
      [9, 'Ralph Bellamy', '1904-06-17', '1991-11-29', 'Chicago, Illinois, USA'],
      [10, 'Howard Hawks', '1896-05-30', '1977-12-26', 'Goshen, Indiana, USA'],
    ] as [number, string, string, string, string][]
  ).map(([id, name, birthday, deathday, place]) => [name, { id, name, birthday, deathday, place }]),
);
const role = (name: string, character?: string) => ({ id: PEOPLE[name].id, tag: name, role: character });
const DETAILS: Record<string, Partial<Item>> = {
  Charade: {
    originallyAvailableAt: '1963-12-05',
    tagline: 'You can expect the unexpected.',
    Guid: [{ id: 'imdb://tt0056923' }, { id: 'tmdb://4808' }],
    Rating: [
      { image: 'imdb://image.rating', value: 7.8, type: 'audience' },
      { image: 'rottentomatoes://image.rating.ripe', value: 9.2, type: 'critic' },
      { image: 'rottentomatoes://image.rating.upright', value: 8.9, type: 'audience' },
      { image: 'themoviedb://image.rating', value: 7.7, type: 'audience' },
    ],
    Director: [role('Stanley Donen')],
    Writer: [role('Peter Stone')],
    Role: [role('Cary Grant', 'Peter Joshua'), role('Audrey Hepburn', 'Regina Lampert'), role('Walter Matthau', 'Hamilton Bartholomew'), role('James Coburn', 'Tex Panthollow'), role('George Kennedy', 'Herman Scobie')],
  },
  'His Girl Friday': {
    originallyAvailableAt: '1940-01-18',
    tagline: 'He was her boss. And her ex-husband.',
    Guid: [{ id: 'imdb://tt0032599' }, { id: 'tmdb://3085' }],
    Rating: [
      { image: 'imdb://image.rating', value: 7.8, type: 'audience' },
      { image: 'rottentomatoes://image.rating.ripe', value: 9.9, type: 'critic' },
      { image: 'rottentomatoes://image.rating.upright', value: 8.9, type: 'audience' },
      { image: 'themoviedb://image.rating', value: 7.5, type: 'audience' },
    ],
    Director: [role('Howard Hawks')],
    Role: [role('Cary Grant', 'Walter Burns'), role('Rosalind Russell', 'Hildy Johnson'), role('Ralph Bellamy', 'Bruce Baldwin')],
  },
};
// Sample file data for every demo film, so the File section has something to show.
const sampleMedia = (title: string, year: number, minutes: number, res: string) => {
  const h = res === '4k' ? 2160 : res === '720' ? 720 : res === '480' ? 480 : 1080;
  const w = Math.round((h * 4) / 3 / 2) * 2;
  const bitrate = res === '4k' ? 42000 : res === '720' ? 4200 : res === '480' ? 1800 : 9800;
  return [
    {
      videoResolution: res,
      width: w,
      height: h,
      bitrate,
      container: 'mkv',
      videoCodec: res === '4k' ? 'hevc' : 'h264',
      Part: [
        {
          file: `${title} (${year}).mkv`,
          size: Math.round(bitrate * 125 * minutes * 60),
          container: 'mkv',
          Stream: [
            { streamType: 1, codec: res === '4k' ? 'hevc' : 'h264', bitDepth: res === '4k' ? 10 : 8, frameRate: 23.976, extendedDisplayTitle: `${res === '4k' ? '4K' : `${h}p`} (${res === '4k' ? 'HEVC Main 10' : 'H.264'})` },
            { streamType: 2, codec: 'flac', channels: 1, selected: true, language: 'English', extendedDisplayTitle: 'English (FLAC Mono)' },
            { streamType: 2, codec: 'ac3', channels: 2, language: 'English', extendedDisplayTitle: 'English Commentary (AC3 Stereo)' },
            { streamType: 3, codec: 'srt', language: 'English', extendedDisplayTitle: 'English (SRT)' },
          ],
        },
      ],
    },
  ];
};

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// ── Library ────────────────────────────────────────────────────────────
const items = new Map<string, Item & { _children?: string[]; addedAt?: number }>();
const sectionKeys: Record<string, string[]> = { '1': [], '2': [] };
// In progress, so Continue Watching has something to show.
const PROGRESS: Record<string, number> = { Charade: 0.36, 'His Girl Friday': 0.62, Metropolis: 0.48 };
const WATCHED = new Set(['Detour', 'The Hitch-Hiker', 'Night of the Living Dead', 'The General', 'Sherlock Jr.', 'The Kid', 'Safety Last!']);

const addFilms = (films: Film[], section: '1' | '2') =>
  films.forEach(([title, year, minutes, genres, logline], i) => {
    const rk = `${section === '1' ? 'm' : 's'}${i + 1}`;
    const duration = minutes * 60000;
    items.set(rk, {
      ratingKey: rk,
      key: `/library/metadata/${rk}`,
      guid: `plex://movie/demo-${rk}`,
      type: 'movie',
      title,
      year,
      summary: logline,
      thumb: poster(title),
      art: poster(title),
      duration,
      viewCount: WATCHED.has(title) ? 1 : 0,
      viewOffset: PROGRESS[title] ? Math.round(duration * PROGRESS[title]) : undefined,
      audienceRating: 6.2 + (hash(title) % 30) / 10,
      contentRating: 'NR',
      Genre: genres.map((tag) => ({ tag })),
      // Sample file resolutions so every tag color shows up.
      Media: sampleMedia(title, year, minutes, ['4k', '1080', '1080', '720', '480'][hash(title + 'res') % 5]),
      librarySectionID: Number(section),
      addedAt: 1700000000 + (hash(title + 'added') % 400) * 86400,
      // Watched films get a last-watched date this autumn (neon green on the poster).
      lastViewedAt: WATCHED.has(title) ? Date.UTC(2026, 8, 1 + (hash(title + 'seen') % 50), 21) / 1000 : undefined,
      ...(DETAILS[title] || {}),
    });
    sectionKeys[section].push(rk);
  });
addFilms(MOVIES, '1');
addFilms(SILENTS, '2');

const byTitle = (t: string) => [...items.values()].find((i) => i.title === t)!.ratingKey;
const COLLECTIONS: [rk: string, section: string, title: string, films: string[]][] = [
  ['c1', '1', 'Film Noir', ['Detour', 'D.O.A.', 'The Hitch-Hiker', 'The Stranger']],
  ['c2', '2', 'Buster Keaton', ['Our Hospitality', 'Sherlock Jr.', 'The Navigator', 'The General', 'Steamboat Bill, Jr.']],
  ['c3', '2', 'Harold Lloyd & Chaplin', ['Safety Last!', 'The Kid', 'The Gold Rush']],
];
for (const [rk, , title, films] of COLLECTIONS) {
  const kids = films.map(byTitle);
  items.set(rk, { ratingKey: rk, key: `/library/collections/${rk}`, type: 'collection', title, thumb: items.get(kids[0])!.thumb, childCount: kids.length, summary: `${kids.length} films.`, _children: kids });
}
const PLAYLIST = { ratingKey: 'p1', title: 'Friday Night Frights', kids: ['Night of the Living Dead', 'Carnival of Souls', 'The Terror', 'The Brain That Wouldn\'t Die'].map(byTitle) };

// ── Fake Plex API ──────────────────────────────────────────────────────
const strip = (i: Item & { _children?: string[] }) => {
  const { _children, ...rest } = i;
  void _children;
  return rest as Item;
};
const mc = (body: object) => ({ MediaContainer: body });

function get(path: string): any {
  const u = new URL('http://demo' + path);
  const p = u.pathname;
  const q = u.searchParams;
  let m: RegExpMatchArray | null;
  if (p === '/library/sections')
    return mc({ Directory: [{ key: '1', title: 'Movies', type: 'movie' }, { key: '2', title: 'Silent Classics', type: 'movie' }] });
  if ((m = p.match(/^\/library\/sections\/(\d)\/(\w+)$/))) {
    const list = (sectionKeys[m[1]] || []).map((k) => items.get(k)!);
    if (m[2] === 'all') {
      const out = list.filter(
        (i) =>
          (!q.get('genre') || i.Genre?.some((g) => g.tag === q.get('genre'))) &&
          (!q.get('decade') || Math.floor((i.year || 0) / 10) * 10 === Number(q.get('decade'))) &&
          (!q.get('unwatched') || !i.viewCount) &&
          (!q.get('inProgress') || !!i.viewOffset) &&
          (!q.get('actor') || !!i.Role?.some((r) => String(r.id) === q.get('actor'))) &&
          (!q.get('director') || !!i.Director?.some((r) => String(r.id) === q.get('director'))) &&
          (!q.get('writer') || !!i.Writer?.some((r) => String(r.id) === q.get('writer'))),
      );
      const sortKey = q.get('sort') || 'titleSort';
      const by: Record<string, (a: Item & { addedAt?: number }, b: Item & { addedAt?: number }) => number> = {
        titleSort: (a, b) => a.title.replace(/^The /, '').localeCompare(b.title.replace(/^The /, '')),
        'addedAt:desc': (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
        'originallyAvailableAt:desc': (a, b) => (b.year || 0) - (a.year || 0),
        'audienceRating:desc': (a, b) => (b.audienceRating || 0) - (a.audienceRating || 0),
        'lastViewedAt:desc': (a, b) => (b.viewCount || 0) - (a.viewCount || 0),
      };
      return mc({ Metadata: [...out].sort(by[sortKey] || by.titleSort).map(strip) });
    }
    if (m[2] === 'onDeck') return mc({ Metadata: list.filter((i) => i.viewOffset).map(strip) });
    if (m[2] === 'genre') return mc({ Directory: [...new Set(list.flatMap((i) => i.Genre!.map((g) => g.tag)))].sort().map((g) => ({ key: g, title: g })) });
    if (m[2] === 'decade')
      return mc({ Directory: [...new Set(list.map((i) => Math.floor(i.year! / 10) * 10))].sort().reverse().map((d) => ({ key: String(d), title: `${d}s` })) });
    if (m[2] === 'collections') return mc({ Metadata: COLLECTIONS.filter((c) => c[1] === m![1]).map(([rk]) => strip(items.get(rk)!)) });
  }
  if ((m = p.match(/^\/library\/collections\/(\w+)\/children$/))) return mc({ Metadata: items.get(m[1])!._children!.map((k) => strip(items.get(k)!)) });
  if ((m = p.match(/^\/library\/metadata\/([\w-]+)(\/children|\/allLeaves)?$/))) {
    const it = items.get(m[1]);
    if (!it) return mc({ Metadata: [] });
    if (m[2]) return mc({ Metadata: (it._children || []).map((k) => strip(items.get(k)!)) });
    return mc({ Metadata: [strip(it)] });
  }
  if (p === '/hubs/search') {
    const term = (q.get('query') || '').toLowerCase();
    return mc({ Hub: [{ type: 'movie', Metadata: [...items.values()].filter((i) => i.type === 'movie' && i.title.toLowerCase().includes(term)).map(strip) }] });
  }
  if (p === '/playlists') return mc({ Metadata: [{ ratingKey: PLAYLIST.ratingKey, title: PLAYLIST.title, type: 'playlist', leafCount: PLAYLIST.kids.length }] });
  if (p === `/playlists/${PLAYLIST.ratingKey}/items`) return mc({ Metadata: PLAYLIST.kids.map((k) => strip(items.get(k)!)) });
  if (p === '/:/scrobble' || p === '/:/unscrobble') {
    const it = items.get(q.get('key')!);
    if (it) {
      it.viewCount = p === '/:/scrobble' ? 1 : 0;
      it.viewOffset = undefined;
    }
    return {};
  }
  return { error: `demo: no sample data for ${p}` };
}

const HEALTH: Health = {
  level: 'good',
  title: 'Connected to Server',
  reason: 'LAN · 2 ms',
  detail: 'Local network (secure) · 2 ms',
  checks: [
    { label: 'Network', value: 'Ethernet', level: 'good' },
    { label: 'Server', value: 'Home Server · 2 ms', level: 'good' },
    { label: 'Route', value: 'Local network (secure)', level: 'good' },
    { label: 'Stability', value: '6/6 recent checks OK', level: 'good' },
    { label: 'Internet', value: 'Reachable', level: 'good' },
  ],
};

// Demo profile: a realistic mix of earned and in-progress badges (unreleased ones like Patron hidden, as in normal builds).
const DEMO_EARNED = ['first-light', 'opening-night', 'popcorn-ready', 'double-feature', 'night-owl', 'genre-hopper', 'binge-starter'];
const DEMO_BADGES = {
  catalog: (CATALOG as any[]).filter((b) => !b.unreleased).map(({ rule, variants, ...b }) => b),
  earned: Object.fromEntries(DEMO_EARNED.map((id, i) => [id, { at: Date.UTC(2026, 9, 1 + i * 2, 20) }])),
  favorites: ['genre-hopper', 'night-owl', 'double-feature', 'opening-night', 'first-light', 'binge-starter'],
  minutes: 1010,
  progress: {
    'time-traveler': null,
    'triple-feature': { cur: 2, max: 3, unit: 'movies in 24 hrs' },
    'quadruple-feature': { cur: 2, max: 4, unit: 'movies in 24 hrs' },
    'six-pack': { cur: 2, max: 6, unit: 'movies in 24 hrs' },
    'season-pass': { cur: 5, max: 8, unit: 'episodes' },
    marathoner: { cur: 1010, max: 2880, unit: 'min' },
  },
} as any;
for (const [k, v] of Object.entries(DEMO_BADGES.progress)) if (!v) delete DEMO_BADGES.progress[k];

const demoUnlocks: string[] = [];
const demoMine: { assign: Record<string, { key: string; name: string }>; mine: Record<string, { name: string }> } = { assign: {}, mine: {} };

// ── Demo music (fictional) ─────────────────────────────────────────────
// URL-encoded rather than base64: btoa can't take the symbols used as cover marks.
const cover = (a: string, b: string, mark: string) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="r" cx="0.7" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="300" height="300" fill="url(#g)"/><rect width="300" height="300" fill="url(#r)"/><circle cx="150" cy="150" r="78" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="3"/><text x="150" y="168" text-anchor="middle" font-family="Georgia,serif" font-size="54" fill="#fff" fill-opacity="0.9">${mark}</text></svg>`,
  );
const DEMO_MUSIC = {
  playlists: [
    { uri: 'spotify:playlist:demo1', name: 'Late Night Drive', by: 'demo_viewer', count: 48, image: cover('#1b1464', '#e0388c', '☾') },
    { uri: 'spotify:playlist:demo2', name: 'Sunday Coffee', by: 'demo_viewer', count: 31, image: cover('#7a4b1e', '#f2c46d', '☕') },
    { uri: 'spotify:playlist:demo3', name: 'Workout Fuel', by: 'demo_viewer', count: 62, image: cover('#0f5132', '#29e07b', '⚡') },
    { uri: 'spotify:playlist:demo4', name: 'Rainy Day', by: 'demo_viewer', count: 27, image: cover('#1d3557', '#8ecae6', '☂') },
    { uri: 'spotify:playlist:demo5', name: 'Movie Scores', by: 'demo_viewer', count: 54, image: cover('#2b2d42', '#e5a00d', '♫') },
  ],
  albums: [
    { uri: 'spotify:album:demo1', name: 'Neon Harbor', by: 'The Paper Lanterns', year: '2019', image: cover('#3a0ca3', '#4cc9f0', 'N') },
    { uri: 'spotify:album:demo2', name: 'Copper Skies', by: 'Mara Vell', year: '2021', image: cover('#9d0208', '#ffba08', 'C') },
    { uri: 'spotify:album:demo3', name: 'Glass Orchard', by: 'Northbound Echo', year: '2016', image: cover('#386641', '#a7c957', 'G') },
    { uri: 'spotify:album:demo4', name: 'Afterglow Motel', by: 'Juniper & Smoke', year: '2023', image: cover('#5f0f40', '#fb8b24', 'A') },
  ],
  recent: [
    { uri: 'spotify:track:demo1', name: 'Static Bloom', by: 'The Paper Lanterns', image: cover('#3a0ca3', '#4cc9f0', 'N') },
    { uri: 'spotify:track:demo2', name: 'Low Tide Lights', by: 'Mara Vell', image: cover('#9d0208', '#ffba08', 'C') },
    { uri: 'spotify:track:demo3', name: 'Paper Planes at Dusk', by: 'Juniper & Smoke', image: cover('#5f0f40', '#fb8b24', 'A') },
  ],
};
const demoNow = {
  playing: true,
  device: 'Living Room Speaker',
  name: 'Static Bloom',
  by: 'The Paper Lanterns',
  album: 'Neon Harbor',
  year: '2019',
  image: cover('#3a0ca3', '#4cc9f0', 'N'),
  playlist: 'Late Night Drive' as string | null,
  progress: 83000,
  duration: 224000,
};

export function install() {
  let prefs: Prefs = {
    player: { fullscreen: true, autoplay: true, countdown: 5, skipIntro: 'button', audioLang: 'default', subLang: 'english', subMode: 'smart', hwdec: true, quality: 'default', smoothMotion: false, shaders: '', extraArgs: '' },
    ui: { displayName: 'username', brandLayout: 'tagline', updates: 'ask', badgeSound: 'ember', badgesDuringPlayback: false, hiddenLibs: [], showPlaylists: true, groupCollections: true, pins: [], navOrder: ['lib:1', 'continue', 'lib:2', 'music'] },
  };
  const stateListeners = new Set<(s: any) => void>();
  const later = <T>(v: T, ms = 40) => new Promise<T>((r) => setTimeout(() => r(v), ms));
  const ready = { state: 'ready', user: { name: 'Demo Viewer', username: 'demo_viewer' }, server: { name: 'Home Server' } };
  (window as any).plex = {
    connect: () => later(ready),
    signIn: () => later(ready),
    signOut: () => later({ state: 'signedOut' }),
    get: (path: string) => later(get(path)),
    getPrefs: () => later(prefs),
    setPrefs: (patch: any) => {
      prefs = { player: { ...prefs.player, ...(patch.player || {}) }, ui: { ...prefs.ui, ...(patch.ui || {}) } };
      return later(prefs);
    },
    play: (rk: string) => {
      const it = items.get(rk);
      const title = `${it?.title} (${it?.year})`;
      stateListeners.forEach((cb) => cb({ playing: true, ratingKey: rk, title }));
      setTimeout(() => stateListeners.forEach((cb) => cb({ playing: false, refresh: true })), 6000);
      return later({ ok: true, title });
    },
    stop: () => later(stateListeners.forEach((cb) => cb({ playing: false, refresh: true }))),
    toggleFullscreen: () => later(undefined),
    onPlayerState: (cb: (s: any) => void) => {
      stateListeners.add(cb);
      return () => stateListeners.delete(cb);
    },
    health: () => later(HEALTH),
    checkHealth: () => later({ ...HEALTH, at: Date.now() }, 600),
    simulateHealth: () => later(HEALTH),
    onHealth: () => () => {},
    // Fresh copies each call, like real IPC, so React sees favorites change.
    // A fictional, generated avatar (no real person) for the demo account.
    avatar: () =>
      later(
        'data:image/svg+xml;base64,' +
          btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b6cb7"/><stop offset="1" stop-color="#182848"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="25" r="11" fill="#e8c9a0"/><path d="M12 60 C14 44 50 44 52 60Z" fill="#e5a00d"/></svg>',
          ),
      ),
    // No TMDB in demo mode: the sample library's folders come from its Plex-style collections only.
    tmdbStatus: () => later({ hasKey: false, cached: 0 }),
    tmdbSetKey: () => later({ error: 'TMDB lookups are off in demo mode.' }),
    tmdbCollections: () => later({ byFilm: {}, looked: 0, failed: 0 }),
    detailsStatus: () => later({ tmdb: true, trakt: false, omdb: false }),
    detailsSetKey: () => later({ error: 'Live scores are off in demo mode.' }),
    // A sample "live" Trakt score, so the green live dot shows on the films with credits.
    liveScores: (ids: { tmdb?: string }) => later(ids.tmdb ? { trakt: { value: 8.1, votes: 2140 }, errors: [], at: Date.now() } : { errors: [], at: Date.now() }),
    castLives: (req: { names: string[] }) =>
      later({
        people: Object.fromEntries(
          req.names.filter((n) => PEOPLE[n]).map((n) => [n, { id: PEOPLE[n].id, birthday: PEOPLE[n].birthday, deathday: PEOPLE[n].deathday || null, place: PEOPLE[n].place }]),
        ),
      }),
    watchLog: () => later({}),
    watchLogRecord: () => later(undefined),
    watchLogForget: () => later(undefined),
    watchLogMerge: () => later(undefined),
    exportBackup: () => later({ error: 'Backups are off in demo mode.' }),
    importBackup: () => later({ error: 'Backups are off in demo mode.' }),
    restartApp: () => later(undefined),
    traktStatus: () => later({ available: false, connected: false, user: null, autoSync: true, lastSync: null }),
    traktConnect: () => later({ error: 'Trakt is off in demo mode.' }),
    traktDisconnect: () => later({ available: false, connected: false, user: null, autoSync: true, lastSync: null }),
    traktSync: () => later({ error: 'Trakt is off in demo mode.' }),
    traktMark: () => later(undefined),
    subsEnqueue: () => later({ queued: 0 }),
    subsStatus: () => later({ found: 0, none: 0, queued: 0, enabled: true }),
    subsImport: () => later({ error: 'Subtitles are off in demo mode.' }),
    myCollections: () => later(demoMine),
    myCollectionAssign: (guid: string, key: string | null, name: string) => {
      if (!key) {
        key = `mine:${Date.now().toString(36)}`;
        demoMine.mine[key.slice(5)] = { name };
      }
      demoMine.assign[guid] = { key, name };
      return later(demoMine);
    },
    myCollectionUnassign: (guid: string) => {
      delete demoMine.assign[guid];
      return later(demoMine);
    },
    // A pretend connected Spotify: fictional artists and albums with generated cover art, so the Music page can be
    // shown and recorded without anyone's real account or copyrighted artwork.
    spotifyStatus: () => later({ hasClientId: true, connected: true, user: { name: 'demo_viewer', product: 'premium' }, redirect: 'http://127.0.0.1:43821/callback' }),
    spotifySetClientId: () => later({ error: 'Spotify is simulated in demo mode.' }),
    spotifyConnect: () => later({ error: 'Spotify is simulated in demo mode.' }),
    spotifyDisconnect: () => later({ hasClientId: true, connected: true, user: { name: 'demo_viewer' }, redirect: 'http://127.0.0.1:43821/callback' }),
    spotifyLibrary: () => later(DEMO_MUSIC),
    spotifyNowPlaying: () => later({ ...demoNow, at: Date.now() }),
    spotifyDevices: () => later([{ id: 'demo', name: 'Living Room Speaker', type: 'Speaker', active: true }]),
    spotifyPlay: (uri: string) => {
      const c = [...DEMO_MUSIC.playlists, ...DEMO_MUSIC.albums].find((x) => x.uri === uri);
      if (c) Object.assign(demoNow, { playlist: uri.includes(':playlist:') ? c.name : null, progress: 0, playing: true });
      return later({ ok: true });
    },
    spotifyControl: (a: string) => {
      if (a === 'pause') demoNow.playing = false;
      if (a === 'resume') demoNow.playing = true;
      return later({ ok: true });
    },
    badges: () => later({ ...DEMO_BADGES }),
    takeBadges: () => later(demoUnlocks.splice(0)),
    setFavoriteBadges: (ids: string[]) => {
      DEMO_BADGES.favorites = ids.slice(0, 9);
      return later({ ...DEMO_BADGES });
    },
    // Recording hook: window.__vantaDemoUnlock(['six-pack']) shows a real (non-preview) unlock ticket.
    onBadgesEarned: (cb: () => void) => {
      (window as any).__vantaDemoUnlock = (ids: string[]) => (demoUnlocks.push(...ids), cb());
      return () => {};
    },
    onBadgeShown: () => () => {},
    updateState: () => later({ state: 'none', current: VERSION, mode: prefs.ui.updates, packaged: true }),
    checkUpdate: () => later({ state: 'none', current: VERSION, mode: prefs.ui.updates, packaged: true, checkedAt: Date.now() }, 600),
    downloadUpdate: () => later({ state: 'none', current: VERSION, mode: prefs.ui.updates, packaged: true }),
    installUpdate: () => later({ ok: true }),
    onUpdate: () => () => {},
  };
}
