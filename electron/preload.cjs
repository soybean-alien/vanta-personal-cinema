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
  avatar: () => ipcRenderer.invoke('user:avatar'),
  tmdbStatus: () => ipcRenderer.invoke('tmdb:status'),
  tmdbSetKey: (key) => ipcRenderer.invoke('tmdb:setKey', key),
  tmdbCollections: (refs) => ipcRenderer.invoke('tmdb:collections', refs),
  detailsStatus: () => ipcRenderer.invoke('details:status'),
  detailsSetKey: (service, key) => ipcRenderer.invoke('details:setKey', service, key),
  liveScores: (ids) => ipcRenderer.invoke('details:scores', ids),
  castLives: (req) => ipcRenderer.invoke('details:cast', req),
  fileDetails: (ratingKey) => ipcRenderer.invoke('details:file', ratingKey),
  boxOffice: (ratingKey) => ipcRenderer.invoke('details:boxOffice', ratingKey),
  watchLog: () => ipcRenderer.invoke('history:all'),
  watchLogRecord: (meta) => ipcRenderer.invoke('history:record', meta),
  watchLogForget: (guid) => ipcRenderer.invoke('history:forget', guid),
  watchLogMerge: (entries) => ipcRenderer.invoke('history:merge', entries),
  exportBackup: (opts) => ipcRenderer.invoke('backup:export', opts),
  importBackup: (opts) => ipcRenderer.invoke('backup:import', opts),
  restartApp: () => ipcRenderer.invoke('backup:restart'),
  traktStatus: () => ipcRenderer.invoke('trakt:status'),
  traktConnect: () => ipcRenderer.invoke('trakt:connect'),
  traktConnectWait: () => ipcRenderer.invoke('trakt:connectWait'),
  traktConnectCancel: () => ipcRenderer.invoke('trakt:connectCancel'),
  traktDisconnect: () => ipcRenderer.invoke('trakt:disconnect'),
  traktSync: () => ipcRenderer.invoke('trakt:sync'),
  traktMark: (ratingKey, watched) => ipcRenderer.invoke('trakt:mark', ratingKey, watched),
  subsEnqueue: (rks) => ipcRenderer.invoke('subs:enqueue', rks),
  subsStatus: () => ipcRenderer.invoke('subs:status'),
  subsImport: (meta) => ipcRenderer.invoke('subs:import', meta),
  myCollections: () => ipcRenderer.invoke('mycol:get'),
  myCollectionAssign: (guid, key, name) => ipcRenderer.invoke('mycol:assign', guid, key, name),
  myCollectionUnassign: (guid) => ipcRenderer.invoke('mycol:unassign', guid),
  spotifyStatus: () => ipcRenderer.invoke('spotify:status'),
  spotifySetClientId: (id) => ipcRenderer.invoke('spotify:setClientId', id),
  spotifyConnect: () => ipcRenderer.invoke('spotify:connect'),
  spotifyDisconnect: () => ipcRenderer.invoke('spotify:disconnect'),
  spotifyLibrary: () => ipcRenderer.invoke('spotify:library'),
  spotifyNowPlaying: () => ipcRenderer.invoke('spotify:nowPlaying'),
  spotifyDevices: () => ipcRenderer.invoke('spotify:devices'),
  spotifyPlay: (uri, deviceId) => ipcRenderer.invoke('spotify:play', uri, deviceId),
  spotifyControl: (action) => ipcRenderer.invoke('spotify:control', action),
  badges: () => ipcRenderer.invoke('badges:get'),
  takeBadges: () => ipcRenderer.invoke('badges:take'),
  setFavoriteBadges: (ids) => ipcRenderer.invoke('badges:setFavorites', ids),
  devGrantBadge: (id) => ipcRenderer.invoke('badges:devGrant', id),
  devPatronLapse: () => ipcRenderer.invoke('badges:devPatronLapse'),
  onBadgeShown: (cb) => {
    const listener = (_e, id) => cb(id);
    ipcRenderer.on('badges:shown', listener);
    return () => ipcRenderer.removeListener('badges:shown', listener);
  },
  onBadgesEarned: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('badges:earned', listener);
    return () => ipcRenderer.removeListener('badges:earned', listener);
  },
  updateState: () => ipcRenderer.invoke('update:get'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => {
    const listener = (_e, s) => cb(s);
    ipcRenderer.on('update', listener);
    return () => ipcRenderer.removeListener('update', listener);
  },
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
