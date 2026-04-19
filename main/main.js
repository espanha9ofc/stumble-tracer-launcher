const { app, BrowserWindow, ipcMain, shell, dialog, powerSaveBlocker } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc-handlers');
const { initSettings, getSettings } = require('./modules/settings-manager');
const { initLogger, log } = require('./utils/logger');
const { PATHS } = require('./utils/paths');
const discordRpc = require('./modules/discord-rpc');
const { setStartupLaunch } = require('./modules/shortcut-manager');
const { autoUpdater } = require('electron-updater');

// Configure autoUpdater
autoUpdater.autoDownload = true; // Auto-download in background
autoUpdater.allowPrerelease = false;

let mainWindow = null;
let splashWindow = null;
let psbId = null;

function setPowerSaveBlocker(active) {
  if (active && psbId === null) {
    psbId = powerSaveBlocker.start('prevent-app-suspension');
  } else if (!active && psbId !== null) {
    powerSaveBlocker.stop(psbId);
    psbId = null;
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));
  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0F0A1A',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // need fs access for game management
      webviewTag: false, // Security: Disable webview tag
      disableBlinkFeatures: 'Auxclick', // Security: Disable auxclick
      enableRemoteModule: false // Security: Disable remote module
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // ═══════════════ LAUNCHER SECURITY ═══════════════

  // 1. Set CSP (Content Security Policy)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.socket.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: https://sg-prime-game-launcher.onrender.com; connect-src 'self' https: https://sg-prime-game-launcher.onrender.com wss://sg-prime-game-launcher.onrender.com"
        ]
      }
    });
  });

  // 2. Disable DevTools in production
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Block Ctrl+Shift+I, Ctrl+Shift+J, F12, Ctrl+U
    if (input.key === 'F12' ||
      (input.control && input.shift && (input.key === 'I' || input.key === 'J' || input.key === 'C')) ||
      (input.control && input.key === 'U')) {
      if (!app.isPackaged) return; // Allow in dev mode
      event.preventDefault();
    }
  });

  // 3. Prevent navigation to external URLs (anti-phishing)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedPrefixes = [
      'file://',
      'https://sg-prime-game-launcher.onrender.com',
      'http://localhost'
    ];
    const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix));
    if (!isAllowed) {
      event.preventDefault();
      log('warn', `Blocked navigation to: ${url}`);
    }
  });

  // 4. Prevent new window creation (only allow external links via shell)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow https links to be opened externally
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    } else {
      log('warn', `Blocked window open to: ${url}`);
    }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }, 2500); // Show splash for at least 2.5s
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC handlers
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

// Open external URL in system browser (C2 fix)
ipcMain.handle('shell:openExternal', async (_, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

// Launch on Startup toggle (H3 fix)
ipcMain.handle('settings:setStartup', async (_, enable) => {
  return setStartupLaunch(enable);
});

// Power save blocker for downloads (H2 fix)
ipcMain.on('power:block', () => setPowerSaveBlocker(true));
ipcMain.on('power:unblock', () => setPowerSaveBlocker(false));

// Dialog handlers
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(async () => {
  // Initialize systems
  initLogger();
  log('info', 'Launcher starting...');

  await initSettings();

  // Create windows
  createSplashWindow();
  createMainWindow();

  // Register IPC handlers
  registerIpcHandlers();

  // Auto-init Discord RPC if enabled (C3 fix)
  const settings = getSettings();
  if (settings.discordRPC) {
    discordRpc.enableRPC().catch(err => {
      log('warn', 'Discord RPC auto-init failed (Discord may not be running)');
    });
  }

  // Sync Windows startup entry on boot (H3 fix)
  if (settings.launchOnStartup) {
    setStartupLaunch(true);
  }

  // ═══════════════ AUTO-UPDATER SETUP ═══════════════
  autoUpdater.on('checking-for-update', () => {
    log('info', 'Checking for launcher updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log('info', 'Launcher update available', info);
    mainWindow?.webContents.send('update:status', { 
      type: 'launcher', 
      status: 'available', 
      version: info.version 
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log('info', 'Launcher is up to date');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    log('info', `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
    mainWindow?.webContents.send('update:status', { 
      type: 'launcher', 
      status: 'downloading', 
      percent: progressObj.percent 
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log('info', 'Launcher update downloaded');
    mainWindow?.webContents.send('update:status', { 
      type: 'launcher', 
      status: 'ready', 
      version: info.version 
    });
  });

  autoUpdater.on('error', (err) => {
    log('error', 'Error in auto-updater', { error: err.message });
  });

  // Check for updates shortly after startup
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log('error', 'Failed to initial check for launcher updates', { error: err.message });
    });
  }, 5000);

  log('info', 'Launcher initialized successfully');
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', async () => {
  log('info', 'Launcher shutting down...');
  // M5: Clean up Discord RPC on quit
  await discordRpc.destroyRPC().catch(() => { });
});
