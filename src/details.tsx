// Vanta by soybean_alien
// The richer parts of the details page:
//  - Scores: IMDb, Rotten Tomatoes (critics and audience), Metacritic, TMDB and Trakt. Live from OMDb/TMDB/Trakt
//    when their keys are set, else the scores Plex's agent saved. Each chip says where its number came from.
//  - File: what's actually in the file (resolution, HDR, codecs, container, size, every audio and subtitle track).
//  - Cast & Crew: Plex's cast with TMDB birthdays, today's age (or the date they died, and at what age), and how old
//    they were when this film came out. Clicking someone lists everything with them in your library.
import { useEffect, useMemo, useState } from 'react';
import { DetailsStatus, Item, Life, LiveScores, Media, Person, Stream, externalIds, img, items, resolutionOf } from './api';
import { Poster, ScrollRow, useApp, useAutoFocus } from './components';

// --- ids --------------------------------------------------------------------------------------------------------

// Scores and credits belong to the film or the show (an episode or season borrows its show's ids).
export function useTitleIds(item: Item) {
  const [show, setShow] = useState<Item | null>();
  const showKey = item.type === 'episode' ? item.grandparentRatingKey : item.type === 'season' ? item.parentRatingKey : undefined;
  useEffect(() => {
    if (!showKey) return setShow(null);
    items(`/library/metadata/${showKey}?includeGuids=1`).then(([s]) => setShow(s ?? null), () => setShow(null));
  }, [showKey]);
  return useMemo(() => {
    if (item.type === 'movie') return { kind: 'movie' as const, ...externalIds(item), ready: true };
    if (item.type === 'show') return { kind: 'show' as const, ...externalIds(item), ready: true };
    if (showKey) return { kind: 'show' as const, ...(show ? externalIds(show) : {}), ready: show !== undefined };
    return null;
  }, [item, show, showKey]);
}

// --- scores -----------------------------------------------------------------------------------------------------

type Chip = { id: string; icon: React.ReactNode; value: string; title: string; live: boolean };

const fmtVotes = (n?: number) => (n ? ` · ${n.toLocaleString()} votes` : '');
const plexScore = (item: Item, test: RegExp) => item.Rating?.find((r) => test.test(r.image));

// Small original marks in each service's colors (no logo files are bundled).
const Icons = {
  imdb: <span className="sc-imdb">IMDb</span>,
  tomato: (fresh: boolean) => (
    <svg viewBox="0 0 20 20" className="sc-svg" aria-hidden>
      {fresh ? (
        <>
          <circle cx="10" cy="11.5" r="7.5" fill="#fa320a" />
          <path d="M6 4.5c1.6.4 2.8 1.2 4 2.4 1.2-1.3 2.6-2 4.3-2.2-1 1.1-1.6 2-1.8 3-1.6-.6-3.2-.7-5 0C7.2 6.6 6.8 5.6 6 4.5z" fill="#00912d" />
        </>
      ) : (
        <path d="M10 2.5l2 3.6 4-1.4-1 4.1 3.6 2-3.8 1.6.9 4.1-4-1.7L9.3 18l-1-4.2-4.2.8 2-3.7L2.6 8.6l4.1-.6-.5-4.2z" fill="#0ac855" />
      )}
    </svg>
  ),
  popcorn: (upright: boolean) => (
    <svg viewBox="0 0 20 20" className="sc-svg" aria-hidden style={upright ? undefined : { transform: 'rotate(-28deg)' }}>
      <circle cx="6.5" cy="6.2" r="2.6" fill={upright ? '#ffe9a8' : '#9aa0ab'} />
      <circle cx="10" cy="4.8" r="2.9" fill={upright ? '#fff3c9' : '#b0b5be'} />
      <circle cx="13.6" cy="6.2" r="2.6" fill={upright ? '#ffe9a8' : '#9aa0ab'} />
      <path d="M4.2 8h11.6l-1.6 10H5.8z" fill={upright ? '#fa320a' : '#6d727c'} />
      <path d="M7.6 8l.5 10M12.4 8l-.5 10" stroke="#fff" strokeWidth="1.3" />
    </svg>
  ),
  metacritic: (v: number) => <span className={`sc-meta ${v >= 61 ? 'good' : v >= 40 ? 'mixed' : 'bad'}`}>{Math.round(v)}</span>,
  tmdb: <span className="sc-tmdb">TMDB</span>,
  trakt: (
    <svg viewBox="0 0 20 20" className="sc-svg" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="#ed1c24" />
      <circle cx="10" cy="10" r="5.6" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M7.4 9.4l2 2 4-4" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
};

function buildChips(item: Item, live?: LiveScores): Chip[] {
  const out: Chip[] = [];
  const imdb = live?.imdb ?? (plexScore(item, /^imdb:/) && { value: plexScore(item, /^imdb:/)!.value });
  if (imdb)
    out.push({ id: 'imdb', icon: Icons.imdb, value: imdb.value.toFixed(1), title: `IMDb rating ${imdb.value.toFixed(1)}/10${fmtVotes(imdb.votes)}`, live: !!live?.imdb });

  const rtPlex = plexScore(item, /^rottentomatoes:.*\.(ripe|rotten)$/);
  const rt = live?.rt?.value ?? (rtPlex ? rtPlex.value * 10 : undefined);
  if (rt !== undefined) {
    const fresh = rt >= 60;
    out.push({ id: 'rt', icon: Icons.tomato(fresh), value: `${Math.round(rt)}%`, title: `Rotten Tomatoes Tomatometer (critics): ${Math.round(rt)}% ${fresh ? 'Fresh' : 'Rotten'}`, live: !!live?.rt });
  }
  const aud = plexScore(item, /^rottentomatoes:.*\.(upright|spilled)$/);
  if (aud) {
    const upright = /upright$/.test(aud.image);
    out.push({ id: 'rta', icon: Icons.popcorn(upright), value: `${Math.round(aud.value * 10)}%`, title: `Rotten Tomatoes Popcornmeter (audience): ${Math.round(aud.value * 10)}%`, live: false });
  }
  if (live?.metacritic)
    out.push({ id: 'mc', icon: Icons.metacritic(live.metacritic.value), value: '', title: `Metacritic Metascore ${Math.round(live.metacritic.value)}/100`, live: true });

  const tmdb = live?.tmdb ?? (plexScore(item, /^themoviedb:/) && { value: plexScore(item, /^themoviedb:/)!.value });
  if (tmdb) out.push({ id: 'tmdb', icon: Icons.tmdb, value: `${Math.round(tmdb.value * 10)}%`, title: `TMDB user score ${Math.round(tmdb.value * 10)}%${fmtVotes(tmdb.votes)}`, live: !!live?.tmdb });
  if (live?.trakt) out.push({ id: 'trakt', icon: Icons.trakt, value: `${Math.round(live.trakt.value * 10)}%`, title: `Trakt rating ${Math.round(live.trakt.value * 10)}%${fmtVotes(live.trakt.votes)}`, live: true });
  return out;
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export function Scores({ item, ids }: { item: Item; ids: ReturnType<typeof useTitleIds> }) {
  const [live, setLive] = useState<LiveScores>();
  useEffect(() => {
    setLive(undefined);
    if (!ids?.ready || (!ids.imdb && !ids.tmdb)) return;
    let alive = true;
    window.plex.liveScores({ kind: ids.kind, imdb: ids.imdb, tmdb: ids.tmdb }).then((r) => alive && !('error' in r) && setLive(r));
    return () => {
      alive = false;
    };
  }, [ids?.ready, ids?.imdb, ids?.tmdb]);
  // An episode's own Plex scores are about the episode; live ones are the show's, so they aren't mixed.
  const chips = buildChips(item, item.type === 'episode' || item.type === 'season' ? undefined : live);
  if (!chips.length) return null;
  const anyLive = chips.some((c) => c.live);
  return (
    <div className="scores">
      {chips.map((c) => (
        <span key={c.id} className="score" title={`${c.title}\n${c.live ? `Live${live ? `, updated ${ago(live.at)}` : ''}` : "From Plex's metadata"}`}>
          {c.icon}
          {c.value && <b>{c.value}</b>}
        </span>
      ))}
      {anyLive && <span className="live-dot" title={`Live scores, updated ${ago(live!.at)}`} />}
    </div>
  );
}

// --- file -------------------------------------------------------------------------------------------------------

const gb = (bytes?: number) => (!bytes ? '' : bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`);
const hdrOf = (v?: Stream) =>
  !v ? '' : v.DOVIPresent ? `Dolby Vision${v.DOVIProfile ? ` ${v.DOVIProfile}` : ''}` : v.colorTrc === 'smpte2084' ? 'HDR10' : v.colorTrc === 'arib-std-b67' ? 'HLG' : '';
const CODEC: Record<string, string> = { hevc: 'HEVC', h264: 'H.264', av1: 'AV1', vp9: 'VP9', mpeg2video: 'MPEG-2', vc1: 'VC-1', mpeg4: 'MPEG-4' };
const AUDIO: Record<string, string> = { truehd: 'TrueHD', eac3: 'Dolby Digital+', ac3: 'Dolby Digital', dca: 'DTS', 'dca-ma': 'DTS-HD MA', aac: 'AAC', flac: 'FLAC', opus: 'Opus', mp3: 'MP3', pcm: 'PCM' };
const channels = (s: Stream) => {
  const n = s.channels || 0;
  return n === 8 ? '7.1' : n === 6 ? '5.1' : n === 2 ? 'Stereo' : n === 1 ? 'Mono' : n ? `${n} ch` : '';
};
const atmos = (s: Stream) => /atmos/i.test(`${s.title || ''} ${s.extendedDisplayTitle || ''} ${s.profile || ''}`);
const dtsx = (s: Stream) => /dts:?x/i.test(`${s.title || ''} ${s.extendedDisplayTitle || ''} ${s.profile || ''}`);
const audioName = (s: Stream) => (s.codec === 'dca' && /ma/i.test(s.profile || '') ? 'DTS-HD MA' : AUDIO[s.codec || ''] || (s.codec || '').toUpperCase());

// The version that plays: the best-resolution one (same pick as the grid's corner tag).
function bestMedia(media?: Media[]): Media | undefined {
  const res = resolutionOf(media);
  return media?.find((m) => resolutionOf([m])?.label === res?.label) ?? media?.[0];
}

export function FileInfo({ item }: { item: Item }) {
  // Files Plex never analyzed have no tracks in its metadata: Vanta reads them from the file itself (probe.cjs).
  const missing = !!item.Media?.length && item.Media.some((x) => !x.Part?.[0]?.Stream?.length);
  const [probed, setProbed] = useState<Media[] | null>();
  useEffect(() => {
    setProbed(undefined);
    if (!missing || !window.plex.fileDetails) return;
    let alive = true;
    window.plex.fileDetails(item.ratingKey).then(
      (r) => alive && setProbed(Array.isArray(r) ? r : null),
      () => alive && setProbed(null),
    );
    return () => {
      alive = false;
    };
  }, [item.ratingKey, missing]);
  const reading = missing && !!window.plex.fileDetails && probed === undefined;
  const m = bestMedia(probed || item.Media);
  const part = m?.Part?.[0];
  const streams = part?.Stream || [];
  if (!m) return null;
  const v = streams.find((s) => s.streamType === 1);
  const audio = streams.filter((s) => s.streamType === 2);
  const subs = streams.filter((s) => s.streamType === 3);
  const mainAudio = audio.find((s) => s.selected) || audio.find((s) => s.default) || audio[0];
  const res = resolutionOf([m]);
  const tags = [
    res && { t: res.label, cls: `res-${res.tier}` },
    hdrOf(v) && { t: hdrOf(v), cls: 'hdr' },
    (v?.codec || m.videoCodec) && { t: `${CODEC[v?.codec || m.videoCodec!] || (v?.codec || m.videoCodec!).toUpperCase()}${v?.bitDepth && v.bitDepth > 8 ? ` ${v.bitDepth}-bit` : ''}`, cls: 'vcodec' },
    mainAudio && { t: `${audioName(mainAudio)} ${channels(mainAudio)}`.trim(), cls: 'acodec' },
    mainAudio && atmos(mainAudio) && { t: 'Atmos', cls: 'hdr' },
    mainAudio && dtsx(mainAudio) && { t: 'DTS:X', cls: 'hdr' },
    (part?.container || m.container) && { t: (part?.container || m.container)!.toUpperCase(), cls: 'container' },
    part?.size && { t: gb(part.size), cls: 'size' },
  ].filter(Boolean) as { t: string; cls?: string }[];
  const trackName = (s: Stream) => s.extendedDisplayTitle || s.displayTitle || s.language || 'Unknown';

  return (
    <div className="file-info">
      <div className="tech-tags">
        {tags.map((x) => (
          <span key={x.t} className={`tech ${x.cls || ''}`}>
            {x.t}
          </span>
        ))}
        {item.Media!.length > 1 && <span className="tech">{item.Media!.length} versions</span>}
        {reading && <span className="muted small file-reading">Reading the file's details…</span>}
      </div>
      {m.unreadable && (
        <p className="muted small file-unreadable">Plex and Vanta couldn't read this file's tracks. It may be damaged or incomplete on the server.</p>
      )}
      {streams.length > 0 && <dl className="specs" title={m.probed ? "Read from the file by Vanta (Plex hasn't analyzed it)" : undefined}>
        {v && (
          <>
            <dt>Video</dt>
            <dd>{trackName(v)}</dd>
          </>
        )}
        <dt>Audio</dt>
        <dd>
          {audio.length ? (
            <TrackList list={audio.map((s) => ({ name: trackName(s), main: s === mainAudio }))} />
          ) : (
            <span className="muted">None</span>
          )}
        </dd>
        <dt>Subtitles</dt>
        <dd>
          {subs.length ? (
            <TrackList list={subs.map((s) => ({ name: `${trackName(s)}${s.forced ? ' · Forced' : ''}${s.hearingImpaired ? ' · SDH' : ''}`, main: !!s.selected }))} />
          ) : (
            <span className="muted">None</span>
          )}
        </dd>
      </dl>}
    </div>
  );
}

// The first three tracks, then "+N more" with the rest in its tooltip.
function TrackList({ list }: { list: { name: string; main: boolean }[] }) {
  const shown = list.slice(0, 3);
  const rest = list.slice(3);
  return (
    <span className="tracks">
      {shown.map((t, i) => (
        <span key={i} className={t.main ? 'main' : ''}>
          {t.name}
        </span>
      ))}
      {rest.length > 0 && (
        <span className="more" title={rest.map((t) => t.name).join('\n')}>
          +{rest.length} more
        </span>
      )}
    </span>
  );
}

// --- cast -------------------------------------------------------------------------------------------------------

// TMDB dates are calendar days ('1959-04-01'): read them as local dates so no time zone shifts the day.
const day = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const ageOn = (birth: string, on: Date) => {
  const b = day(birth);
  let a = on.getFullYear() - b.getFullYear();
  if (on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())) a--;
  return a;
};
export const longDate = (s: string) => day(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const isBirthdayToday = (birth: string) => {
  const b = day(birth);
  const t = new Date();
  return b.getMonth() === t.getMonth() && b.getDate() === t.getDate();
};

// When the title came out, for "age in this film". Plex gives a full date; a bare year counts as mid-year.
function releaseOf(item: Item): Date | undefined {
  if (item.originallyAvailableAt) return day(item.originallyAvailableAt);
  if (item.year) return new Date(item.year, 6, 1);
}

type Credit = { person: Person; job: 'actor' | 'director' | 'writer'; label?: string };

export function CastAndCrew({ item, ids }: { item: Item; ids: ReturnType<typeof useTitleIds> }) {
  const ctx = useApp();
  const credits: Credit[] = useMemo(
    () => [
      ...(item.Role || []).map((p) => ({ person: p, job: 'actor' as const, label: p.role })),
      ...(item.Director || []).map((p) => ({ person: p, job: 'director' as const, label: 'Director' })),
      ...(item.Writer || []).map((p) => ({ person: p, job: 'writer' as const, label: 'Writer' })),
    ],
    [item],
  );
  const [lives, setLives] = useState<Record<string, Life>>();
  const [noKey, setNoKey] = useState(false);
  useEffect(() => {
    setLives(undefined);
    if (!ids?.ready || !credits.length) return;
    if (!ids.tmdb) return setLives({});
    let alive = true;
    window.plex.castLives({ kind: ids.kind, tmdb: ids.tmdb, names: [...new Set(credits.map((c) => c.person.tag))] }).then((r) => {
      if (!alive) return;
      if ('error' in r) return setLives({});
      setNoKey(!!r.noKey);
      setLives(r.people);
    });
    return () => {
      alive = false;
    };
  }, [ids?.ready, ids?.tmdb, credits]);

  if (!credits.length) return null;
  const release = releaseOf(item);
  const inThis = item.type === 'episode' ? 'in this episode' : item.type === 'show' || item.type === 'season' ? 'at the premiere' : 'in this film';
  return (
    <section className="cast">
      <div className="cast-head">
        <h2>Cast &amp; Crew</h2>
        {noKey && <span className="muted small">Add a TMDB key in Settings → Library to see birthdays and ages.</span>}
      </div>
      <ScrollRow className="cast-row" trackClass="cast-track" count={credits.length}>
        {credits.map((c, i) => (
          <CastCard
            key={`${c.job}-${c.person.tag}-${i}`}
            credit={c}
            life={lives?.[c.person.tag]}
            loading={!lives && !!ids?.tmdb}
            release={release}
            inThis={inThis}
            onOpen={() => ctx.open({ kind: 'person', person: c.person, job: c.job, life: lives?.[c.person.tag] })}
          />
        ))}
      </ScrollRow>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function CastCard({ credit, life, loading, release, inThis, onOpen }: { credit: Credit; life?: Life; loading: boolean; release?: Date; inThis: string; onOpen: () => void }) {
  const { person, label } = credit;
  const [broken, setBroken] = useState(false);
  const dead = !!life?.deathday;
  const birth = life?.birthday;
  const ageNow = birth && !dead ? ageOn(birth, new Date()) : undefined;
  const ageAtDeath = birth && dead ? ageOn(birth, day(life!.deathday!)) : undefined;
  const ageThen = birth && release && release >= day(birth) ? ageOn(birth, release) : undefined;
  const bday = birth && !dead && isBirthdayToday(birth);
  const tip = [
    person.tag,
    label,
    life?.place && `Born in ${life.place}`,
    birth && life?.src && `Birthday from ${life.src}`,
    dead && life?.deathSrc && `Death from ${life.deathSrc}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button className={`cast-card ${dead ? 'dead' : ''}`} data-nav title={tip} onClick={onOpen}>
      <span className="cast-photo">
        {person.thumb && !broken ? <img src={img(person.thumb, 240, 240)} loading="lazy" onError={() => setBroken(true)} /> : <span className="cast-initials">{initials(person.tag)}</span>}
        {ageThen !== undefined && <span className="age-then" title={`Age ${ageThen} ${inThis}`}>{ageThen}</span>}
      </span>
      <span className="cast-name">{person.tag}</span>
      {label && <span className="cast-role">{label}</span>}
      <span className="cast-life">
        {loading ? (
          <span className="shimmer" />
        ) : birth ? (
          <>
            <span className="born">
              {bday ? '🎂 Birthday today · ' : ''}
              {longDate(birth)}
            </span>
            {dead ? (
              <span className="died">
                † {longDate(life!.deathday!)}
                {ageAtDeath !== undefined && <> · aged {ageAtDeath}</>}
              </span>
            ) : (
              <span className="now">Age {ageNow}</span>
            )}
            {ageThen !== undefined && (
              <span className="then">
                {ageThen} {inThis}
              </span>
            )}
          </>
        ) : life?.deathday ? (
          <span className="died">† {longDate(life.deathday)}</span>
        ) : null}
      </span>
    </button>
  );
}

// --- person page ------------------------------------------------------------------------------------------------

// Everything in your video libraries with this person, newest first, using Plex's own actor/director/writer filters.
export function PersonView({ person, job, life }: { person: Person; job: 'actor' | 'director' | 'writer'; life?: Life }) {
  const ctx = useApp();
  const [list, setList] = useState<Item[]>();
  useEffect(() => {
    if (!person.id) return setList([]);
    Promise.all(
      ctx.sections.map((s) =>
        items(`/library/sections/${s.key}/all?type=${s.type === 'show' ? 2 : 1}&${job}=${person.id}&sort=originallyAvailableAt:desc`).catch(() => [] as Item[]),
      ),
    ).then((all) => setList(all.flat().sort((a, b) => (b.originallyAvailableAt || String(b.year || '')).localeCompare(a.originallyAvailableAt || String(a.year || '')))));
  }, [person.id, job]);
  useAutoFocus(!!list);
  const dead = !!life?.deathday;
  const word = job === 'actor' ? 'With' : job === 'director' ? 'Directed by' : 'Written by';
  return (
    <div className="person-page">
      <div className="person-head">
        <span className="cast-photo big">{person.thumb ? <img src={img(person.thumb, 320, 320)} /> : <span className="cast-initials">{initials(person.tag)}</span>}</span>
        <div>
          <h1>{person.tag}</h1>
          {life?.birthday && (
            <p className="person-life">
              Born {longDate(life.birthday)}
              {life.place ? ` in ${life.place}` : ''}
              {dead ? ` · Died ${longDate(life.deathday!)}, aged ${ageOn(life.birthday, day(life.deathday!))}` : ` · Age ${ageOn(life.birthday, new Date())}`}
            </p>
          )}
          <p className="muted">
            {list ? `${word} ${person.tag}: ${list.length} ${list.length === 1 ? 'title' : 'titles'} in your library` : 'Looking through your library...'}
          </p>
        </div>
      </div>
      {list && (
        <div className="grid">
          {list.map((i) => (
            <PersonPoster key={i.ratingKey} item={i} life={life} />
          ))}
        </div>
      )}
    </div>
  );
}

// A poster with how old the person was when that title came out.
function PersonPoster({ item, life }: { item: Item; life?: Life }) {
  const r = releaseOf(item);
  const age = life?.birthday && r && r >= day(life.birthday) ? ageOn(life.birthday, r) : undefined;
  return <Poster item={item} res={resolutionOf(item.Media)} sub={age !== undefined ? `${item.year ?? ''} · age ${age}` : undefined} />;
}

export type { DetailsStatus };
