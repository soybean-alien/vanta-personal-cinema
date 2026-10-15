// Vanta by soybean_alien
// Couch navigation: arrow keys / D-pad move focus spatially between [data-nav] elements,
// and an Xbox controller is translated into the same key events the keyboard produces.

type Dir = 'up' | 'down' | 'left' | 'right';

// The topmost open menu or dialog traps navigation; otherwise the whole page is in scope.
function scope(): ParentNode {
  const scopes = document.querySelectorAll('[data-nav-scope]');
  return scopes.length ? scopes[scopes.length - 1] : document;
}

function candidates(): HTMLElement[] {
  return [...scope().querySelectorAll<HTMLElement>('[data-nav]')].filter(
    (el) => !el.closest('.behind') && !(el as HTMLButtonElement).disabled && el.checkVisibility(),
  );
}

export function focusEl(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

export function focusFirst(root: ParentNode | null = document.querySelector('.view:not(.behind)')) {
  focusEl(
    root?.querySelector<HTMLElement>('[data-autofocus], .play:not(:disabled)') ||
      root?.querySelector<HTMLElement>('.poster') ||
      root?.querySelector<HTMLElement>('[data-nav]:not(.back)'),
  );
}

// Focus was lost (e.g. the element we were on belonged to a view that just closed or got hidden).
export const focusLost = () => {
  const a = document.activeElement;
  return !a || a === document.body || !!a.closest('.behind') || !a.isConnected;
};

const gap = (a1: number, a2: number, b1: number, b2: number) => (b2 < a1 ? a1 - b2 : b1 > a2 ? b1 - a2 : 0);

export function move(dir: Dir) {
  const list = candidates();
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !list.includes(cur)) {
    // First press lands on the content (first poster if there is one), not the filter box.
    const inView = list.filter((e) => e.closest('.view'));
    focusEl(inView.find((e) => e.classList.contains('poster')) || inView[0] || list[0]);
    return;
  }
  const a = cur.getBoundingClientRect();
  let best: HTMLElement | undefined;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    let main: number;
    let cross: number;
    if (dir === 'left' || dir === 'right') {
      const ahead = dir === 'right' ? b.left + b.width / 2 > a.left + a.width / 2 + 1 : b.left + b.width / 2 < a.left + a.width / 2 - 1;
      if (!ahead) continue;
      main = Math.max(0, dir === 'right' ? b.left - a.right : a.left - b.right);
      cross = gap(a.top, a.bottom, b.top, b.bottom);
    } else {
      const ahead = dir === 'down' ? b.top + b.height / 2 > a.top + a.height / 2 + 1 : b.top + b.height / 2 < a.top + a.height / 2 - 1;
      if (!ahead) continue;
      main = Math.max(0, dir === 'down' ? b.top - a.bottom : a.top - b.bottom);
      cross = gap(a.left, a.right, b.left, b.right);
    }
    // Same row/column wins; the left edge breaks ties so moving into a grid lands on its first column.
    const score = main + cross * 3 + Math.abs(b.left - a.left) * 0.01;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) focusEl(best);
}

export interface KeyActions {
  back(): void;
  search(fromPad: boolean): void;
  settings(): void;
  libStep(delta: number): void;
}

const isTyping = (el: Element | null) =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'checkbox'));

export function installKeys(actions: KeyActions) {
  const onKey = (e: KeyboardEvent) => {
    document.documentElement.classList.add('kbd');
    if (e.defaultPrevented) return;
    const el = document.activeElement as HTMLElement | null;
    const typing = isTyping(el);
    const dirs: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const k = e.key;
    if (dirs[k]) {
      // Real keyboard arrows edit text inside inputs; controller (synthetic) arrows always navigate.
      if (typing && e.isTrusted && (k === 'ArrowLeft' || k === 'ArrowRight' || el!.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      move(dirs[k]);
    } else if (k === 'Enter') {
      if (typing || !el || el === document.body) return;
      // Real Enter on a <button> already clicks; synthetic (controller) events and focusable divs need help.
      if (!e.isTrusted || el.tagName !== 'BUTTON') {
        e.preventDefault();
        el.click();
      }
    } else if (k === 'Escape' || k === 'BrowserBack' || (k === 'Backspace' && !typing)) {
      e.preventDefault();
      if (typing) el!.blur();
      else actions.back();
    } else if (k === 'ContextMenu' || k === 'GamepadY') {
      if (!el || el === document.body) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }),
      );
    } else if ((k === '/' && !typing) || (k === 'f' && e.ctrlKey) || k === 'GamepadX') {
      e.preventDefault();
      actions.search(k === 'GamepadX');
    } else if (k === 'F11' || k === 'GamepadView') {
      e.preventDefault();
      window.plex.toggleFullscreen();
    } else if (k === 'GamepadMenu') {
      actions.settings();
    } else if (k === 'GamepadLB' || k === 'GamepadRB') {
      actions.libStep(k === 'GamepadLB' ? -1 : 1);
    } else if ((k === 'PageDown' || k === 'PageUp' || k === 'GamepadLT' || k === 'GamepadRT') && !typing) {
      e.preventDefault();
      const dir: Dir = k === 'PageDown' || k === 'GamepadRT' ? 'down' : 'up';
      for (let i = 0; i < 3; i++) move(dir);
    }
  };
  // Mouse "back" side button.
  const onMouse = (e: MouseEvent) => {
    document.documentElement.classList.remove('kbd');
    if (e.button === 3) {
      e.preventDefault();
      actions.back();
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('mouseup', onMouse);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('mouseup', onMouse);
  };
}

// Standard-mapping Xbox controller (Xbox One / Series X|S over USB or Bluetooth).
const BUTTONS: Record<number, string> = {
  0: 'Enter', // A
  1: 'Escape', // B
  2: 'GamepadX',
  3: 'GamepadY',
  4: 'GamepadLB',
  5: 'GamepadRB',
  6: 'GamepadLT',
  7: 'GamepadRT',
  8: 'GamepadView',
  9: 'GamepadMenu',
  12: 'ArrowUp',
  13: 'ArrowDown',
  14: 'ArrowLeft',
  15: 'ArrowRight',
};
const REPEATS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'GamepadLT', 'GamepadRT']);

export function installGamepad(isBlocked: () => boolean) {
  const held = new Map<string, number>(); // key -> next repeat time
  let raf = 0;
  const fire = (key: string) => {
    const target = (document.activeElement as HTMLElement) || document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const pad = [...navigator.getGamepads()].find((p) => p && p.connected);
    if (!pad) return;
    const down = new Set<string>();
    pad.buttons.forEach((b, i) => {
      if (BUTTONS[i] && (b.pressed || b.value > 0.5)) down.add(BUTTONS[i]);
    });
    const [x = 0, y = 0] = pad.axes;
    if (x < -0.55) down.add('ArrowLeft');
    if (x > 0.55) down.add('ArrowRight');
    if (y < -0.55) down.add('ArrowUp');
    if (y > 0.55) down.add('ArrowDown');

    const now = performance.now();
    // Ignore the pad while mpv is playing or the app isn't the focused window.
    const blocked = isBlocked() || !document.hasFocus();
    for (const key of down) {
      const next = held.get(key);
      if (next === undefined) {
        held.set(key, now + 380);
        if (!blocked) fire(key);
      } else if (REPEATS.has(key) && now >= next) {
        held.set(key, now + 95);
        if (!blocked) fire(key);
      }
    }
    for (const key of [...held.keys()]) if (!down.has(key)) held.delete(key);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
