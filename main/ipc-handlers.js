const { ipcMain, BrowserWindow, shell } = require('electron');
const { log } = require('./utils/logger');
const { PATHS } = require('./utils/paths');
const { checkConnection } = require('./utils/download');

// Import modules
const settingsManager = require('./modules/settings-manager');
const gameManager = require('./modules/game-manager');
const updateChecker = require('./modules/update-checker');
const dependencyManager = require('./modules/dependency-manager');
const discordRpc = require('./modules/discord-rpc');
const fileIntegrity = require('./modules/file-integrity');
const shortcutManager = require('./modules/shortcut-manager');
const { getHWID } = require('./utils/hwid');
const { autoUpdater } = require('electron-updater');

const overlayManager = require('./modules/overlay-manager');

function registerIpcHandlers() {
  // ─── Overlay Relay ───
  ipcMain.on('overlay:relay', (_, { channel, data }) => {
    overlayManager.relayToOverlay(channel, data);
  });

  // ─── Analytics ───
  ipcMain.handle('hwid:get', () => getHWID());

  const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
  if (mainWindow) {
    gameManager.setMainWindow(mainWindow);
  }

  // ─── Settings ───
  ipcMain.handle('settings:get', async (_, key) => {
    const settings = settingsManager.getSettings();
    return key ? settings[key] : settings;
  });

  ipcMain.handle('settings:set', async (_, key, value) => {
    const newSettings = await settingsManager.setSetting(key, value);

    // Apply immediate side-effects for toggles
    if (key === 'discordRPC') {
      if (value) {
        await discordRpc.enableRPC();
      } else {
        await discordRpc.disableRPC();
      }
    } else if (key === 'enableOverlay') {
      const { isGameRunning } = require('./modules/game-manager');
      if (isGameRunning()) {
        if (value) {
          const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
          overlayManager.createOverlayWindow(mainWindow, newSettings.username || 'Player', 0);
        } else {
          overlayManager.closeOverlayWindow();
        }
      }
    }

    return newSettings;
  });

  ipcMain.handle('settings:getAll', async () => {
    return settingsManager.getSettings();
  });

  ipcMain.handle('settings:openInstallDir', async () => {
    const settings = settingsManager.getSettings();
    shell.openPath(settings.installDirectory);
  });

  ipcMain.handle('settings:clearCache', async () => {
    const fs = require('fs-extra');
    try {
      await fs.remove(PATHS.cache);
      await fs.remove(PATHS.temp);
      log('info', 'Cache cleared');
      return { success: true };
    } catch (err) {
      log('error', 'Failed to clear cache', { error: err.message });
      return { success: false, error: err.message };
    }
  });

  // ─── Game Management ───
  ipcMain.handle('game:getInfo', async () => {
    return await gameManager.getGameInfo();
  });

  ipcMain.handle('game:install', async () => {
    try {
      return await gameManager.installGame();
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('game:launch', async () => {
    try {
      // Set Discord RPC to playing
      const settings = settingsManager.getSettings();
      if (settings.discordRPC) {
        discordRpc.setPlayingActivity('In Game');
      }

      const result = await gameManager.launchGame();

      // M3: Minimize launcher on game launch if setting enabled
      if (result.success && settings.minimizeOnLaunch) {
        // Use the mainWindow captured at handler registration time
        // NOT getAllWindows().find() which could grab the overlay window
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.minimize();
        }
      }

      // Listen for game close to clear RPC
      const checkInterval = setInterval(() => {
        if (!gameManager.isGameRunning()) {
          if (settings.discordRPC) {
            discordRpc.clearActivity();
          }
          clearInterval(checkInterval);
        }
      }, 5000);

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('game:repair', async () => {
    try {
      return await gameManager.repairGame();
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('game:uninstall', async () => {
    try {
      return await gameManager.uninstallGame();
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('game:isInstalled', async () => {
    return await gameManager.isGameInstalled();
  });

  ipcMain.handle('game:getInstallPath', async () => {
    const settings = settingsManager.getSettings();
    return settings.installDirectory;
  });

  // ─── Updates ───
  ipcMain.handle('updates:check', async () => {
    return await updateChecker.checkForUpdates();
  });

  ipcMain.handle('updates:download', async () => {
    try {
      const updateInfo = await updateChecker.checkForUpdates();
      
      // Only re-download the full game if the GAME version changed
      if (updateInfo.hasUpdate) {
        log('info', 'Game update detected, downloading full game...');
        await gameManager.installGame(updateInfo.downloadUrl);
      }
      
      // Only re-download the DLL if the DLL version changed
      if (updateInfo.hasDllUpdate) {
        log('info', 'DLL update detected, downloading only DLL...');
        await gameManager.updateModDLL(updateInfo.dllDownloadUrl);
      }

      // Update local version.json to match remote so we don't re-trigger
      if (updateInfo.remoteVersion) {
        await updateChecker.updateLocalVersion(updateInfo.remoteVersion);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updates:getLocalVersion', async () => {
    return await updateChecker.getLocalVersion();
  });

  ipcMain.handle('updates:getRemoteVersion', async () => {
    return await updateChecker.getRemoteVersion();
  });

  ipcMain.handle('updates:installLauncher', async () => {
    log('info', 'Renderer requested launcher update installation');
    autoUpdater.quitAndInstall(false, true);
    return true;
  });

  // ─── Dependencies ───
  ipcMain.handle('deps:check', async () => {
    return await dependencyManager.checkDependencies();
  });

  ipcMain.handle('deps:install', async () => {
    const mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    return await dependencyManager.installDependencies((progress) => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('deps:progress', progress);
      }
    });
  });

  // ─── Discord RPC ───
  ipcMain.handle('discord:enable', async () => {
    return await discordRpc.enableRPC();
  });

  ipcMain.handle('discord:disable', async () => {
    return await discordRpc.disableRPC();
  });

  ipcMain.handle('discord:setActivity', async (_, activity) => {
    discordRpc.setActivity(activity);
    return true;
  });

  // ─── News ───
  ipcMain.handle('news:get', async () => {
    try {
      const { fetchJson } = require('./utils/download');
      const newsData = await fetchJson(PATHS.remote.newsApi);
      return Array.isArray(newsData) ? newsData : [];
    } catch (err) {
      log('error', 'Failed to fetch news', { error: err.message });
      return [];
    }
  });

  // ─── Connectivity ───
  ipcMain.handle('network:check', async () => {
    return await checkConnection();
  });

  // ─── File Integrity ───
  ipcMain.handle('integrity:verify', async () => {
    return await fileIntegrity.verifyGameFiles();
  });

  ipcMain.handle('integrity:verifyMod', async () => {
    return await fileIntegrity.verifyModDLL();
  });

  log('info', 'All IPC handlers registered');

  // Start internal security watchdog
  gameManager.startWatchdog();
}

module.exports = { registerIpcHandlers };
