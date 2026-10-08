const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  arch: process.arch,

  // Window & Navigation
  getScreenSources: () => ipcRenderer.invoke('get-sources'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  openMainWindow: (route) => ipcRenderer.send('open-main-window', { route }),

  // Native Transparent Screen Overlay Controls
  openOverlay: (region) => ipcRenderer.send('open-overlay', { region }),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  toggleOverlay: () => ipcRenderer.send('toggle-overlay'),
  setInteractive: (isInteractive) => ipcRenderer.send('set-overlay-interactive', isInteractive),
  setOverlayClickThrough: (flag) => ipcRenderer.send('set-overlay-click-through', flag),
  getDisplayBounds: () => ipcRenderer.invoke('get-display-bounds'),

  // Desktop Teaching Mode Controls
  toggleTeachingSession: () => ipcRenderer.send('toggle-teaching-mode'),

  // Listeners for Global Hotkeys & Perception Streaming
  onScreenPerceptionUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('screen-perception-update', subscription);
    return () => ipcRenderer.removeListener('screen-perception-update', subscription);
  },
  onTeachingModeToggle: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('teaching-mode-toggle', subscription);
    return () => ipcRenderer.removeListener('teaching-mode-toggle', subscription);
  },
  onHudVisibilityToggle: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('hud-visibility-toggle', subscription);
    return () => ipcRenderer.removeListener('hud-visibility-toggle', subscription);
  },
  onInteractionModeToggle: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('interaction-mode-toggle', subscription);
    return () => ipcRenderer.removeListener('interaction-mode-toggle', subscription);
  },

  // System
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});

// Generic IPC bridge fallback
contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => {
    const subscription = (event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
});
