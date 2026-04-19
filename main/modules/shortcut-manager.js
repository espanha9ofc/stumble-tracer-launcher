const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');
const { log } = require('../utils/logger');
const { getSettings } = require('./settings-manager');
const { PATHS, getGamePath } = require('../utils/paths');

/**
 * Create desktop shortcut for the launcher
 */
async function createDesktopShortcut() {
  try {
    const desktopPath = app.getPath('desktop');
    const exePath = process.execPath;
    const shortcutPath = path.join(desktopPath, 'Stumble Tracer.lnk');

    // Use Windows Shell to create shortcut
    const { shell } = require('electron');
    const result = shell.writeShortcutLink(shortcutPath, 'create', {
      target: exePath,
      description: 'Stumble Tracer Launcher',
      icon: exePath,
      iconIndex: 0
    });

    if (result) {
      log('info', 'Desktop shortcut created');
    } else {
      log('warn', 'Failed to create desktop shortcut');
    }
    return result;
  } catch (err) {
    log('error', 'Shortcut creation error', { error: err.message });
    return false;
  }
}

/**
 * Set launcher to run on Windows startup
 */
function setStartupLaunch(enable) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath,
      args: ['--minimized']
    });
    log('info', `Startup launch: ${enable ? 'enabled' : 'disabled'}`);
    return true;
  } catch (err) {
    log('error', 'Failed to set startup launch', { error: err.message });
    return false;
  }
}

/**
 * Rename game exe and set up launcher intercept
 */
async function setupExeIntercept() {
  const settings = getSettings();
  const installDir = settings.installDirectory;
  
  const originalExe = getGamePath(installDir, PATHS.gameExe);
  const renamedExe = getGamePath(installDir, PATHS.gameRealExe);

  try {
    // Only rename if original exists and renamed doesn't
    if (await fs.pathExists(originalExe) && !await fs.pathExists(renamedExe)) {
      await fs.rename(originalExe, renamedExe);
      log('info', 'Game exe renamed for launcher intercept');
    }
    return true;
  } catch (err) {
    log('error', 'Failed to set up exe intercept', { error: err.message });
    return false;
  }
}

module.exports = { createDesktopShortcut, setStartupLaunch, setupExeIntercept };
