// Vanta by soybean_alien
// The badge toast drawn *inside* mpv during playback (mpv's window covers Vanta's, so an in-app toast would be hidden).
// It's an ASS-drawn gold card (osd-overlay) plus the medallion as a raw BGRA image (overlay-add), top-left, sitting
// just below the line mpv uses for its own messages ("Up next…", "Skip intro…").
const OSD_ID = 62;
const IMG_ID = 7;
const TIERS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

// All sizes are designed at 1080p and scaled to the actual video window.
function layout(w, h) {
  const s = Math.max(0.6, Math.min(w / 1920, h / 1080) * 1.0);
  const r = (n) => Math.round(n * s);
  return { s, x: r(28), y: r(70), bw: r(600), bh: r(150), img: r(108), pad: r(22), radius: r(18) };
}

const ass = (t) => String(t).replace(/[{}\\]/g, '');

// Word-wrap for ASS text; \pos events don't wrap to the card, so wrap by an estimated character width.
function wrap(text, maxChars) {
  const lines = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + word).length <= maxChars) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

function roundedRect(x, y, w, h, r) {
  const X = x + w;
  const Y = y + h;
  return `m ${x + r} ${y} l ${X - r} ${y} b ${X} ${y} ${X} ${y} ${X} ${y + r} l ${X} ${Y - r} b ${X} ${Y} ${X} ${Y} ${X - r} ${Y} l ${x + r} ${Y} b ${x} ${Y} ${x} ${Y} ${x} ${Y - r} l ${x} ${y + r} b ${x} ${y} ${x} ${y} ${x + r} ${y}`;
}

// ASS events for one card. `badge` = { name, tier }, `more` = extra badges summarised on this card.
function card(dims, badge, more = 0) {
  const L = layout(dims.w, dims.h);
  const fade = ''; // osd-overlay events have no timeline, so \fad would leave them transparent
  const box = `{\\an7\\pos(0,0)\\bord0\\shad0\\1c&H0B3D86&\\1a&H50&\\p1${fade}}${roundedRect(L.x + 3, L.y + 5, L.bw, L.bh, L.radius)}{\\p0}`; // soft shadow
  const face = `{\\an7\\pos(0,0)\\bord${Math.max(1, Math.round(L.s * 1.5))}\\3c&H5EE0FF&\\shad0\\1c&H0DA0E5&\\p1${fade}}${roundedRect(L.x, L.y, L.bw, L.bh, L.radius)}{\\p0}`;
  const tx = L.x + L.pad + L.img + L.pad;
  // ASS font sizes render at roughly 0.72x their nominal pixel size, so these are set larger than the visual target.
  const kickerSize = Math.round(21 * L.s);
  const lineSize = Math.round(36 * L.s);
  const kicker = more ? "AND THAT'S NOT ALL" : `CONGRATULATIONS! · ${TIERS[badge.tier] || ''}`.toUpperCase();
  const textWidth = L.bw - (tx - L.x) - L.pad;
  const sentence = more ? `You've unlocked ${more} more badges!` : `You've just unlocked the ${ass(badge.name)} badge!`;
  // Keep the badge name on one line: wrap with non-breaking spaces inside it, then restore them.
  const nbName = ass(badge?.name || '').replace(/ /g, '\u00a0');
  const lines = wrap(more ? sentence : sentence.replace(ass(badge.name), nbName), Math.max(12, Math.floor(textWidth / (lineSize * 0.36)))).map((l) => l.replace(/\u00a0/g, ' '));
  const textTop = L.y + Math.round((L.bh - (kickerSize * 1.4 + lines.length * lineSize * 1.25)) / 2);
  const style = `\\an7\\fnSegoe UI\\bord0\\shad0\\1c&H04141D&${fade}`;
  const out = [box, face, `{${style}\\pos(${tx},${textTop})\\fs${kickerSize}\\b1\\fsp${Math.round(2 * L.s)}\\1a&H40&}${kicker}`];
  const name = ass(badge?.name || '');
  lines.forEach((ln, i) => {
    const y = textTop + Math.round(kickerSize * 1.4 + i * lineSize * 1.25);
    // bold the badge name wherever it lands in the wrapped text
    const body = !more && name && ln.includes(name) ? ln.replace(name, `{\\b1}${name}{\\b0}`) : ln;
    out.push(`{${style}\\pos(${tx},${y})\\fs${lineSize}\\b0}${body}`);
  });
  return out.join('\n');
}

// send(...) is the player's mpv IPC writer. `image` = { file, size } (raw premultiplied BGRA).
function show(send, dims, badge, image, more = 0) {
  const L = layout(dims.w, dims.h);
  send({ name: 'osd-overlay', id: OSD_ID, format: 'ass-events', data: card(dims, badge, more), res_x: dims.w, res_y: dims.h, z: 50 });
  if (image) send('overlay-add', IMG_ID, L.x + L.pad, L.y + Math.round((L.bh - image.size) / 2), image.file, 0, 'bgra', image.size, image.size, image.size * 4);
}

function hide(send) {
  send({ name: 'osd-overlay', id: OSD_ID, format: 'none', data: '' });
  send('overlay-remove', IMG_ID);
}

module.exports = { layout, card, show, hide };
