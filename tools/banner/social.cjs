// Vanta by soybean_alien
// GitHub's social preview must be under 1 MB (1280x640 recommended). Scales docs/banner.png down to
// docs/social-preview.png, falling back to a high-quality JPEG if the PNG is still too big.
// Usage: node_modules/electron/dist/electron tools/banner/social.cjs
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const docs = path.join(__dirname, '..', '..', 'docs');
  const img = nativeImage.createFromPath(path.join(docs, 'banner.png')).resize({ width: 1280, height: 640, quality: 'best' });
  let out = path.join(docs, 'social-preview.png');
  let data = img.toPNG();
  if (data.length >= 1e6) {
    out = path.join(docs, 'social-preview.jpg');
    data = img.toJPEG(92);
  }
  fs.writeFileSync(out, data);
  console.log(`${path.basename(out)}: ${(data.length / 1024).toFixed(0)} KB`);
  app.quit();
});
