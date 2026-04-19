const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer via context bridge
contextBridge.exposeInMainWorld('launcherAPI', {
  // ─── Window Controls ───
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Generic send for simple actions
  send: (channel, data) => {
    const validChannels = ['overlay:open-launcher', 'overlay:relay'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // ─── Game Management ───
  game: {
    getInfo: () => ipcRenderer.invoke('game:getInfo'),
    install: () => ipcRenderer.invoke('game:install'),
    launch: () => ipcRenderer.invoke('game:launch'),
    repair: () => ipcRenderer.invoke('game:repair'),
    uninstall: () => ipcRenderer.invoke('game:uninstall'),
    isInstalled: () => ipcRenderer.invoke('game:isInstalled'),
    getInstallPath: () => ipcRenderer.invoke('game:getInstallPath')
  },

  // ─── Update System ───
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    getLocalVersion: () => ipcRenderer.invoke('updates:getLocalVersion'),
    getRemoteVersion: () => ipcRenderer.invoke('updates:getRemoteVersion'),
    installLauncher: () => ipcRenderer.invoke('updates:installLauncher')
  },

  // ─── Dependencies ───
  deps: {
    check: () => ipcRenderer.invoke('deps:check'),
    install: () => ipcRenderer.invoke('deps:install')
  },

  // ─── Settings ───
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    setStartup: (enable) => ipcRenderer.invoke('settings:setStartup', enable),
    openInstallDir: () => ipcRenderer.invoke('settings:openInstallDir'),
    selectInstallDir: () => ipcRenderer.invoke('dialog:openDirectory'),
    clearCache: () => ipcRenderer.invoke('settings:clearCache')
  },

  // ─── Discord RPC ───
  discord: {
    enable: () => ipcRenderer.invoke('discord:enable'),
    disable: () => ipcRenderer.invoke('discord:disable'),
    setActivity: (activity) => ipcRenderer.invoke('discord:setActivity', activity)
  },

  // ─── News ───
  news: {
    get: () => ipcRenderer.invoke('news:get')
  },

  // ─── Analytics ───
  analytics: {
    getHWID: () => ipcRenderer.invoke('hwid:get')
  },

  network: {
    check: () => ipcRenderer.invoke('network:check')
  },

  // ─── Power Management (H2 fix) ───
  power: {
    block: () => ipcRenderer.send('power:block'),
    unblock: () => ipcRenderer.send('power:unblock')
  },

  // ─── Event Listeners ───
  on: (channel, callback) => {
    const validChannels = [
      'download:progress',
      'download:complete',
      'download:error',
      'install:progress',
      'install:complete',
      'install:error',
      'update:status',
      'deps:progress',
      'deps:status',
      'game:status',
      'game:unauthorized',
      'toast:show',
      'overlay:data',
      'overlay:alert',
      'overlay:online'
    ];
    if (validChannels.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },

  // Remove listener (restricted to valid channels only)
  removeAllListeners: (channel) => {
    const validChannels = [
      'download:progress',
      'download:complete',
      'download:error',
      'install:progress',
      'install:complete',
      'install:error',
      'update:status',
      'deps:progress',
      'deps:status',
      'game:status',
      'game:unauthorized',
      'toast:show'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});
