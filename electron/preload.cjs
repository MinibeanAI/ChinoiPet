const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds'),
  setWindowPosition: (point) => ipcRenderer.invoke('window:set-position', point),
  setWindowSize: (size) => ipcRenderer.invoke('window:set-size', size),
  setWindowBounds: (bounds) => ipcRenderer.invoke('window:set-bounds', bounds),
  saveWindowBounds: () => ipcRenderer.invoke('window:save-bounds'),
  notify: (payload) => ipcRenderer.invoke('notify', payload),
  listUpcomingCalendarEvents: () => ipcRenderer.invoke('calendar:list-upcoming'),
  getPermissionStatus: () => ipcRenderer.invoke('permissions:get-status'),
  testNotification: () => ipcRenderer.invoke('permissions:test-notification'),
  requestCalendarAccess: () => ipcRenderer.invoke('permissions:request-calendar'),
  openSystemSettings: (target) => ipcRenderer.invoke('system:open-settings', target),
  openContextMenu: () => ipcRenderer.invoke('context-menu:open'),
  onToggleSettings: (callback) => {
    ipcRenderer.on('settings:toggle', callback);
    return () => ipcRenderer.removeListener('settings:toggle', callback);
  },
  onPlayAnimation: (callback) => {
    ipcRenderer.on('animation:play', callback);
    return () => ipcRenderer.removeListener('animation:play', callback);
  }
});
