// Vanta by soybean_alien
// The badge toast drawn *inside* mpv during playback (mpv's window covers Vanta's, so an in-app toast would be hidden).
// It is the same unlock ticket the app shows, rasterized by the UI to raw premultiplied BGRA and placed with mpv's
// overlay-add: top-left, just below the line mpv uses for its own messages ("Up next…", "Skip intro…").
const IMG_ID = 7;
const TICKET_W = 620; // design size (src/badges.tsx TICKET)

// Sizes are designed at 1080p and scaled to the actual video window.
function layout(w, h) {
  const s = Math.max(0.5, Math.min(w / 1920, h / 1080));
  return { s, x: Math.round(14 * s), y: Math.round(72 * s), width: Math.round(TICKET_W * s) };
}

// send(...) is the player's mpv IPC writer; image = { file, w, h }.
function show(send, dims, image) {
  const L = layout(dims.w, dims.h);
  send('overlay-add', IMG_ID, L.x, L.y, image.file, 0, 'bgra', image.w, image.h, image.w * 4);
}

function hide(send) {
  send('overlay-remove', IMG_ID);
}

module.exports = { layout, show, hide };
