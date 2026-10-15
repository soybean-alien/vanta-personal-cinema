// Vanta by soybean_alien
// The Badges page: a pinned header, then one row per category ("2 of 4 unlocked", View all) whose badges scroll
// sideways (arrow buttons, Shift+wheel / trackpad, keyboard or controller), with page dots. Earned badges show their
// art, name and date and can be favorited (up to 6) for the sidebar showcase; unearned ones are silhouettes with
// progress, and secret ones stay "???" with a hint.
import { useEffect, useRef, useState } from 'react';
import { BadgeArt, BadgeDef, BadgeState, rarityLabel } from './badges';
import { useApp, useAutoFocus } from './components';

const CATEGORY_ORDER = ['Getting Started', 'Movie Nights', 'Series', 'Dedication', 'Supporters'];
export const SHOWCASE_MAX = 6;

// Anything that changes badges (favorites, grants) announces it so the sidebar and the page both refresh.
export const announceBadgesChanged = () => window.dispatchEvent(new Event('vanta:badges-changed'));

function useBadgeState() {
  const [state, setState] = useState<BadgeState>();
  useEffect(() => {
    const load = () => window.plex.badges().then(setState);
    load();
    window.addEventListener('vanta:badges-changed', load);
    return () => window.removeEventListener('vanta:badges-changed', load);
  }, []);
  return state;
}

function grouped(state: BadgeState): [string, BadgeDef[]][] {
  const map = new Map<string, BadgeDef[]>();
  for (const b of state.catalog) {
    const c = b.category || 'Other';
    if (!map.has(c)) map.set(c, []);
    map.get(c)!.push(b);
  }
  const rank = (c: string) => (CATEGORY_ORDER.indexOf(c) + 1 || 99);
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

const progressText = (p: { cur: number; max: number; unit: string }) =>
  p.unit === 'min' && p.max >= 120 ? `${Math.floor(p.cur / 60)}/${p.max / 60} hours` : `${Math.min(p.cur, p.max)}/${p.max} ${p.unit}`;

export function BadgesPage() {
  const state = useBadgeState();
  const ctx = useApp();
  useAutoFocus(!!state);
  if (!state) return <p className="muted">Loading…</p>;
  const earnedCount = state.catalog.filter((b) => state.earned[b.id]).length;
  return (
    <div className="badges-page">
      <header className="badges-header">
        <h1>Badges</h1>
        <span className="badges-total">
          {earnedCount} of {state.catalog.length} unlocked
        </span>
      </header>
      {grouped(state).map(([name, list]) => (
        <CategoryRow key={name} name={name} list={list} state={state} onViewAll={() => ctx.open({ kind: 'badgeCategory', category: name })} />
      ))}
    </div>
  );
}

// "View all": the whole category as a grid.
export function BadgeCategoryPage({ category }: { category: string }) {
  const state = useBadgeState();
  useAutoFocus(!!state);
  if (!state) return <p className="muted">Loading…</p>;
  const list = state.catalog.filter((b) => (b.category || 'Other') === category);
  const earned = list.filter((b) => state.earned[b.id]).length;
  return (
    <div className="badges-page">
      <header className="badges-header">
        <h1>{category}</h1>
        <span className="badges-total">
          {earned} of {list.length} unlocked
        </span>
      </header>
      <div className="badge-grid">
        {list.map((b) => (
          <BadgeCard key={b.id} badge={b} state={state} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ name, list, state, onViewAll }: { name: string; list: BadgeDef[]; state: BadgeState; onViewAll: () => void }) {
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
    // Sideways scrolling: trackpads (deltaX) and Shift+wheel move the row; a plain wheel keeps scrolling the page.
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
  }, [list.length]);
  const step = (dir: number) => track.current!.scrollBy({ left: dir * track.current!.clientWidth * 0.9, behavior: 'smooth' });
  const earned = list.filter((b) => state.earned[b.id]).length;

  return (
    <section className="badge-cat">
      <div className="badge-cat-head">
        <div>
          <h2>{name}</h2>
          <span className="badge-cat-count">
            {earned} of {list.length} unlocked
          </span>
        </div>
        <button className="view-all" data-nav onClick={onViewAll}>
          View all
        </button>
      </div>
      <div className="badge-row">
        {page > 0 && (
          <button className="row-arrow left" data-nav aria-label="Previous" onClick={() => step(-1)}>
            ‹
          </button>
        )}
        <div className="badge-track" ref={track} onScroll={update}>
          {list.map((b) => (
            <BadgeCard key={b.id} badge={b} state={state} />
          ))}
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
    </section>
  );
}

export function BadgeCard({ badge, state }: { badge: BadgeDef; state: BadgeState }) {
  const ctx = useApp();
  const earned = state.earned[badge.id];
  const fav = state.favorites.includes(badge.id);
  const secret = !!badge.secret && !earned;
  const progress = state.progress?.[badge.id];

  const toggleFavorite = async () => {
    if (!earned) return;
    if (!fav && state.favorites.length >= SHOWCASE_MAX) {
      ctx.error(`Your showcase holds ${SHOWCASE_MAX} badges. Remove one first (right-click or Y on a starred badge).`);
      return;
    }
    await window.plex.setFavoriteBadges(fav ? state.favorites.filter((id) => id !== badge.id) : [...state.favorites, badge.id]);
    announceBadgesChanged();
  };

  return (
    <div
      className={`badge-card ${earned ? 'earned' : 'locked'} ${fav ? 'fav' : ''}`}
      tabIndex={0}
      data-nav
      title={secret ? badge.hint : badge.earned}
      onClick={toggleFavorite}
      onContextMenu={(e) => {
        e.preventDefault();
        if (earned) ctx.menu(e.clientX, e.clientY, [{ label: fav ? '☆ Remove from showcase' : '★ Add to showcase', action: toggleFavorite }]);
      }}
    >
      {earned && <span className="fav-star">{fav ? '★' : '☆'}</span>}
      <BadgeArt badge={badge} size={104} locked={!earned} secret={secret} />
      <div className="badge-name">{secret ? '???' : badge.name}</div>
      {earned ? (
        <div className="badge-sub">
          {new Date(earned.at).toLocaleDateString()} <span className={`rarity-dot ${badge.rarity}`} title={rarityLabel(badge.rarity)} />
        </div>
      ) : progress ? (
        <>
          <div className="badge-sub">{progressText(progress)}</div>
          <div className="badge-progress">
            <span style={{ width: `${Math.min(100, (progress.cur / progress.max) * 100)}%` }} />
          </div>
        </>
      ) : (
        <div className="badge-sub">{secret ? 'Secret' : rarityLabel(badge.rarity)}</div>
      )}
    </div>
  );
}
