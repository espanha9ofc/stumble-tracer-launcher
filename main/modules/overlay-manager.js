const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const os = require('os');
const { log } = require('../utils/logger');

let overlayWindow = null;
let timerInterval = null;
let startTime = 0;
let lastCpuUsage = null;

function createOverlayWindow(mainWindow, username, totalPlayTime) {
  if (overlayWindow) return;

  try {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    const overlayFile = path.join(__dirname, '..', '..', 'renderer', 'overlay.html');
    const preloadPath = path.join(__dirname, '..', 'preload.js');
    log('info', `Overlay HTML path: ${overlayFile}`);

    overlayWindow = new BrowserWindow({
      width: 420,
      height: 80,
      x: Math.round((width - 420) / 2),
      y: 12,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      focusable: false,
      show: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    // Force highest z-order so it shows OVER fullscreen games
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true);

    // Diagnostic listeners
    overlayWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      log('error', 'Overlay content failed to load', { errorCode, errorDescription });
    });

    overlayWindow.webContents.on('did-finish-load', () => {
      log('info', 'Overlay HTML loaded successfully — starting metrics');
      startTime = Date.now();
      lastCpuUsage = process.cpuUsage();
      startMetricsInterval(username, totalPlayTime);
    });

    overlayWindow.loadFile(overlayFile).catch(err => {
      log('error', 'Overlay file failed to load', { error: err.message });
    });

    overlayWindow.on('closed', () => {
      log('info', 'Overlay window closed');
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;
      overlayWindow = null;
    });

    // Handle Quick Action: Open Launcher (Avoid duplicate listeners)
    ipcMain.removeAllListeners('overlay:open-launcher');
    ipcMain.on('overlay:open-launcher', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    log('info', 'Overlay window created and file loading initiated');

  } catch (err) {
    log('error', 'Failed to create overlay window', { error: err.message, stack: err.stack });
  }
}

function startMetricsInterval(username, totalPlayTime) {
  if (timerInterval) clearInterval(timerInterval);

  let tickCount = 0;

  timerInterval = setInterval(async () => {
    try {
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        clearInterval(timerInterval);
        timerInterval = null;
        return;
      }

      tickCount++;

      // Bug #3 fix: Re-assert z-order every 2 seconds so game can't push us behind
      if (tickCount % 2 === 0) {
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      }

      const sessionSeconds = Math.floor((Date.now() - startTime) / 1000);

      // CPU Usage (delta between two samples)
      const currentCpuUsage = process.cpuUsage(lastCpuUsage);
      lastCpuUsage = process.cpuUsage();
      const cpuPercent = Math.min(99, Math.round((currentCpuUsage.user + currentCpuUsage.system) / 10000));

      // Memory
      let ramMb = 0;
      try {
        const memoryInfo = await process.getProcessMemoryInfo();
        ramMb = Math.round((memoryInfo.residentSet || memoryInfo.private || 0) / 1024);
      } catch (e) { }

      const totalRam = os.totalmem();
      const freeRam = os.freemem();
      const systemRamPerc = Math.round(((totalRam - freeRam) / totalRam) * 100);

      overlayWindow.webContents.send('overlay:data', {
        username,
        totalPlayTime,
        sessionSeconds,
        metrics: {
          cpuPerc: cpuPercent,
          ramMb,
          systemRamPerc
        }
      });
    } catch (timerErr) {
      // Don't log spam — just skip this tick
    }
  }, 1000);
}

function closeOverlayWindow() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  overlayWindow = null;
}

function relayToOverlay(channel, data) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, data);
  }
}

module.exports = { createOverlayWindow, closeOverlayWindow, relayToOverlay };
