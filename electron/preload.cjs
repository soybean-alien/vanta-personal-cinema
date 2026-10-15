// Vanta by soybean_alien
const { contextBridge, ipcRenderer } = require('electron');

// Demo mode ("npm run demo") swaps in a sample library from src/demo.ts, so nothing real is exposed.
if (!new URLSearchParams(location.search).has('demo')) contextBridge.exposeInMainWorld('plex', {
  connect: () => ipcRenderer.invoke('auth:connect'),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  get: (path) => ipcRenderer.invoke('pms:get', path),
  getPrefs: () => ipcRenderer.invoke('prefs:get'),
  setPrefs: (patch) => ipcRenderer.invoke('prefs:set', patch),
  play: (ratingKey, opts) => ipcRenderer.invoke('player:play', ratingKey, opts),
  stop: () => ipcRenderer.invoke('player:stop'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  health: () => ipcRenderer.invoke('health:get'),
  checkHealth: () => ipcRenderer.invoke('health:check'),
  simulateHealth: (level) => ipcRenderer.invoke('health:simulate', level),
  onHealth: (cb) => {
    const listener = (_e, h) => cb(h);
    ipcRenderer.on('health', listener);
    return () => ipcRenderer.removeListener('health', listener);
  },
  onPlayerState: (cb) => {
    const listener = (_e, s) => cb(s);
    ipcRenderer.on('player:state', listener);
    return () => ipcRenderer.removeListener('player:state', listener);
  },
});
