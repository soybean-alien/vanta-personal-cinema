// Vanta by soybean_alien
// Crash-safe JSON files for data that must not be lost (badges, the watch log). A save writes a temp file and
// renames it over the real one (a crash mid-write never leaves half a file), after copying the last good version
// to <name>.bak. A load falls back to the .bak when the main file is missing or unreadable.
const fs = require('fs');

function readJson(file) {
  for (const f of [file, file + '.bak']) {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch {}
  }
  return null;
}

function writeJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  try {
    // Only a file that still parses becomes the backup, so a damaged file never replaces a good .bak.
    if (fs.existsSync(file)) {
      JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.copyFileSync(file, file + '.bak');
    }
  } catch {}
  fs.renameSync(tmp, file);
}

module.exports = { readJson, writeJson };
