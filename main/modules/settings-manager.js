const fs = require('fs-extra');
const path = require('path');
const { PATHS } = require('../utils/paths');
const { log } = require('../utils/logger');

const DEFAULT_SETTINGS = {
  autoUpdate: true,
  discordRPC: true,
  launchOnStartup: false,
  installDirectory: PATHS.defaultInstallDir,
  minimizeToTray: true,
  minimizeOnLaunch: true,
  closeOnGameExit: false,
  firstRun: true,
  tutorialSeen: false,
  language: 'en',
  theme: 'amethyst',
  backgroundDownload: false,
  username: null,
  avatar: 'avatar1',
  enableOverlay: true
};

let currentSettings = { ...DEFAULT_SETTINGS };

async function initSettings() {
  try {
    if (await fs.pathExists(PATHS.settings)) {
      const saved = await fs.readJson(PATHS.settings);
      // Merge with defaults to handle new settings added in updates
      currentSettings = { ...DEFAULT_SETTINGS, ...saved };
      
      // Normalize old installation folder names to the new Stumble Tracer path
      if (currentSettings.installDirectory && /StumblePrime/i.test(currentSettings.installDirectory)) {
        currentSettings.installDirectory = currentSettings.installDirectory.replace(/StumblePrime/gi, 'Stumble Tracer');
      }

      // Prevent empty directory defaults from breaking installation
      if (!currentSettings.installDirectory || currentSettings.installDirectory.trim() === '') {
        currentSettings.installDirectory = PATHS.defaultInstallDir;
      }
      
      log('info', 'Settings loaded successfully');
    } else {
      await saveSettings();
      log('info', 'Default settings created');
    }
  } catch (err) {
    log('error', 'Failed to load settings, using defaults', { error: err.message });
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings() {
  try {
    await fs.ensureDir(path.dirname(PATHS.settings));
    await fs.writeJson(PATHS.settings, currentSettings, { spaces: 2 });
    log('info', 'Settings saved');
  } catch (err) {
    log('error', 'Failed to save settings', { error: err.message });
    throw err;
  }
}

function getSettings() {
  return { ...currentSettings };
}

async function setSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) {
    throw new Error(`Unknown setting: ${key}`);
  }
  currentSettings[key] = value;
  await saveSettings();
  return currentSettings;
}

async function resetSettings() {
  currentSettings = { ...DEFAULT_SETTINGS };
  await saveSettings();
  return currentSettings;
}

module.exports = { initSettings, getSettings, setSetting, resetSettings, saveSettings };
