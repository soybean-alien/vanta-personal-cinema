// Vanta by soybean_alien
// Renders an HTML page or SVG to PNG with Electron's own Chromium (no extra tools needed).
//   electron design/icons/render.cjs <input.html|input.svg> <out.png> [width] [height]
// For an SVG, width/height is the icon size (default 512). For HTML, height defaults to the full page.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const [input, output, w, h] = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== '.' && !a.endsWith('render.cjs'));

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const isSvg = input.endsWith('.svg');
  const width = Number(w) || (isSvg ? 512 : 1500);
  // Transparent so an icon's rounded corners stay see-through instead of white.
  const win = new BrowserWindow({
    show: false,
    width,
    height: Number(h) || width,
    useContentSize: true,
    transparent: isSvg,
    backgroundColor: isSvg ? '#00000000' : '#0b0c0f',
    webPreferences: { offscreen: true },
  });
  if (isSvg) {
    const size = width;
    const svg = fs.readFileSync(input, 'utf8');
    const html = `<html><body style="margin:0;background:transparent"><img style="display:block" width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`;
    win.setContentSize(size, size);
    await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
  } else {
    await win.loadFile(path.resolve(input));
    const full = Number(h) || (await win.webContents.executeJavaScript('document.documentElement.scrollHeight'));
    win.setContentSize(width, full);
  }
  await new Promise((r) => setTimeout(r, 600));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(output, img.toPNG());
  console.log('wrote', output, img.getSize());
  app.quit();
});
