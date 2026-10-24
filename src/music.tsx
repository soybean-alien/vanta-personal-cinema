// Vanta by soybean_alien
// Music, through Spotify (electron/spotify.cjs): your playlists, saved albums and recently played, played on one of
// your Spotify devices via Spotify Connect, with a now-playing bar. Connected in Settings → Music.
import { useEffect, useState } from 'react';
import { ScrollRow, useApp, useAutoFocus } from './components';

export interface SpotifyStatus {
  hasClientId: boolean;
  connected: boolean;
  user: { name: string; product?: string } | null;
  redirect: string;
}
type Card = { uri: string; id?: string; name: string; by?: string; count?: number; year?: string; image: string | null; ms?: number };
interface SpotifyLibrary {
  playlists: Card[];
  albums: Card[];
  recent: Card[];
}
interface NowPlaying {
  playing: boolean;
  device: string | null;
  name?: string;
  by?: string;
  album?: string;
  year?: string | null;
  image?: string | null;
  playlist?: string | null;
  progress?: number;
  duration?: number;
  at?: number;
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <path d={d} fill="currentColor" />
  </svg>
);

const clock = (ms = 0) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

// The now-playing hero: big cover art over a blurred glow of itself, then song, artist, album and year, and the
// playlist it's playing from (only when it is). Progress runs smoothly between the 5-second checks.
function NowPlayingHero({ now, onControl }: { now: NowPlaying; onControl: (a: 'pause' | 'resume' | 'next' | 'previous') => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!now.playing) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [now.playing, now.at]);
  const pos = Math.min(now.duration || 0, (now.progress || 0) + (now.playing && now.at ? Date.now() - now.at : 0));
  return (
    <section className={`np ${now.playing ? 'on' : 'paused'}`}>
      {now.image && <div className="np-glow" style={{ backgroundImage: `url("${now.image}")` }} />}
      <div className="np-art">
        {now.image ? <img src={now.image} /> : <span className="music-noart">♪</span>}
        {now.playing && (
          <span className="np-eq" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
      <div className="np-info">
        <span className="np-label">{now.playing ? 'Now playing' : 'Paused'}{now.device ? ` · ${now.device}` : ''}</span>
        <h2 className="np-song">{now.name}</h2>
        <div className="np-artist">{now.by}</div>
        <div className="np-album">
          <span>{now.album}</span>
          {now.year && <span className="np-year">{now.year}</span>}
        </div>
        {now.playlist && (
          <div className="np-playlist">
            <span className="np-pl-icon" aria-hidden>
              ≡
            </span>
            From playlist <b>{now.playlist}</b>
          </div>
        )}
        {now.duration ? (
          <div className="np-time">
            <span>{clock(pos)}</span>
            <span className="np-bar">
              <span style={{ width: `${(pos / now.duration) * 100}%` }} />
            </span>
            <span>{clock(now.duration)}</span>
          </div>
        ) : null}
        <div className="np-controls">
          <button className="np-btn" data-nav aria-label="Previous" onClick={() => onControl('previous')}>
            <Icon d="M7 6h2v12H7zM20 6v12l-9-6z" />
          </button>
          <button className="np-btn big" data-nav aria-label={now.playing ? 'Pause' : 'Play'} onClick={() => onControl(now.playing ? 'pause' : 'resume')}>
            <Icon d={now.playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'} />
          </button>
          <button className="np-btn" data-nav aria-label="Next" onClick={() => onControl('next')}>
            <Icon d="M15 6h2v12h-2zM4 6v12l9-6z" />
          </button>
        </div>
      </div>
    </section>
  );
}

type Err = { error: string };
const isErr = (r: unknown): r is Err => !!r && typeof r === 'object' && 'error' in r;

export function MusicPage() {
  const ctx = useApp();
  const [status, setStatus] = useState<SpotifyStatus>();
  const [lib, setLib] = useState<SpotifyLibrary | Err>();
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    window.plex.spotifyStatus().then((s) => {
      setStatus(s);
      if (s.connected) window.plex.spotifyLibrary().then(setLib);
    });
  }, [ctx.refresh]);

  // Now playing, every 5 s while the page is open.
  useEffect(() => {
    if (!status?.connected) return;
    const tick = () => window.plex.spotifyNowPlaying().then((r) => setNow(isErr(r) ? null : r));
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [status?.connected]);
  useAutoFocus(!!lib);

  const play = async (uri: string) => {
    setMsg('');
    const r = await window.plex.spotifyPlay(uri);
    if (isErr(r)) setMsg(r.error);
    else setTimeout(() => window.plex.spotifyNowPlaying().then((n) => !isErr(n) && setNow(n)), 800);
  };
  const control = async (a: 'pause' | 'resume' | 'next' | 'previous') => {
    const r = await window.plex.spotifyControl(a);
    if (isErr(r)) setMsg(r.error);
    setTimeout(() => window.plex.spotifyNowPlaying().then((n) => !isErr(n) && setNow(n)), 500);
  };

  if (!status) return <p className="muted">Loading...</p>;
  if (!status.connected)
    return (
      <div className="music-page">
        <header className="libhead">
          <h1>Music</h1>
        </header>
        <div className="music-empty">
          <span className="spotify-mark" aria-hidden />
          <p>Connect Spotify to see your playlists and albums here and play them on your Spotify devices.</p>
          <button className="play" data-nav onClick={() => ctx.open({ kind: 'settings' })}>
            Connect in Settings → Music
          </button>
        </div>
      </div>
    );

  return (
    <div className="music-page">
      <header className="libhead">
        <h1>Music</h1>
        <span className="count">Spotify · {status.user?.name}</span>
      </header>
      {now?.name && <NowPlayingHero now={now} onControl={control} />}
      {msg && <p className="music-msg">{msg}</p>}
      {!lib ? (
        <p className="muted">Loading your music...</p>
      ) : isErr(lib) ? (
        <p className="music-msg">{lib.error}</p>
      ) : (
        <>
          <MusicRow title="Your playlists" list={lib.playlists} sub={(c) => [c.by, c.count != null && `${c.count} tracks`].filter(Boolean).join(' · ')} onPlay={play} />
          <MusicRow title="Saved albums" list={lib.albums} sub={(c) => [c.by, c.year].filter(Boolean).join(' · ')} onPlay={play} />
          <MusicRow title="Recently played" list={lib.recent} sub={(c) => c.by || ''} onPlay={play} />
        </>
      )}
    </div>
  );
}

function MusicRow({ title, list, sub, onPlay }: { title: string; list: Card[]; sub: (c: Card) => string; onPlay: (uri: string) => void }) {
  if (!list.length) return null;
  return (
    <section className="music-row">
      <h2>{title}</h2>
      <ScrollRow trackClass="music-track" count={list.length}>
        {list.map((c) => (
          <button key={c.uri} className="music-card" data-nav title={`Play ${c.name}`} onClick={() => onPlay(c.uri)}>
            <span className="music-art">{c.image ? <img src={c.image} loading="lazy" /> : <span className="music-noart">♪</span>}</span>
            <span className="music-name">{c.name}</span>
            <span className="music-sub">{sub(c)}</span>
          </button>
        ))}
      </ScrollRow>
    </section>
  );
}

// Settings → Music: the Client ID, then Connect (Spotify's sign-in page in the browser).
export function SpotifySettings() {
  const ctx = useApp();
  const [s, setS] = useState<SpotifyStatus>();
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    window.plex.spotifyStatus().then(setS);
  }, []);
  const saveId = async (id: string) => {
    const r = await window.plex.spotifySetClientId(id);
    if (isErr(r)) return setMsg(r.error);
    setS(r);
    setDraft('');
    setMsg(id ? 'Client ID saved. Now click Connect Spotify.' : 'Spotify removed.');
  };
  const connect = async () => {
    setMsg('Spotify’s sign-in page is open in your browser. Approve Vanta there, then come back.');
    const r = await window.plex.spotifyConnect();
    if (isErr(r)) return setMsg(r.error);
    setS(r);
    setMsg(`Connected as ${r.user?.name}.${r.user?.product && r.user.product !== 'premium' ? ' Playing on your devices needs Spotify Premium; browsing works without it.' : ''}`);
    ctx.bump();
  };
  return (
    <>
      <div className="field" style={{ marginTop: 4 }}>
        <span>
          Spotify:{' '}
          {s?.connected ? `✓ connected as ${s.user?.name}${s.user?.product ? ` (${s.user.product})` : ''}` : s?.hasClientId ? 'Client ID saved, not connected' : 'not set up'}
        </span>
        {!s?.connected && (
          <div className="pin-row">
            <input
              data-nav
              type="password"
              placeholder={s?.hasClientId ? 'Paste a new Client ID to replace it' : 'Paste your Spotify Client ID'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="tool" data-nav disabled={!draft.trim()} onClick={() => saveId(draft)}>
              Save Client ID
            </button>
          </div>
        )}
        <div className="pin-row">
          {s?.hasClientId && !s.connected && (
            <button className="play" data-nav onClick={connect}>
              Connect Spotify
            </button>
          )}
          {s?.connected && (
            <button
              className="tool"
              data-nav
              onClick={async () => {
                setS(await window.plex.spotifyDisconnect());
                setMsg('Disconnected. Your Client ID is kept.');
                ctx.bump();
              }}
            >
              Disconnect
            </button>
          )}
          {s?.hasClientId && (
            <button className="tool" data-nav onClick={() => saveId('')}>
              ✕ Remove Spotify
            </button>
          )}
        </div>
        <p className="muted small">
          {msg || (
            <>
              One-time setup: at developer.spotify.com → Dashboard → Create app, add the redirect URI <b>{s?.redirect}</b>,
              tick Web API, then copy the app’s Client ID here. Sign-in happens on Spotify’s own page; Vanta never sees your
              password, and the sign-in is stored encrypted on this PC. Playback runs on your Spotify app or speaker and needs
              Spotify Premium.
            </>
          )}
        </p>
      </div>
    </>
  );
}
