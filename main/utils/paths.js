const path = require('path');
const { app } = require('electron');

// All centralized paths for the application
const APP_DATA = app.getPath('userData');

const PATHS = {
  // App data paths
  appData: APP_DATA,
  settings: path.join(APP_DATA, 'settings.json'),
  localVersion: path.join(APP_DATA, 'version.json'),
  logs: path.join(APP_DATA, 'logs'),
  cache: path.join(APP_DATA, 'cache'),
  temp: path.join(APP_DATA, 'temp'),

  // Default install directory
  defaultInstallDir: path.join(app.getPath('home'), 'Games', 'Stumble Tracer'),

  // Game files (relative to install dir)
  gameExe: 'Stumble Tracer.exe',
  gameRealExe: 'Stumble Tracer_real.exe',
  shadowExeName: 'Stumble Tracer_internal.dat', // Hidden internal name
  modsFolder: 'Mods',
  melonLoaderFolder: 'MelonLoader',

  // Remote URLs (configurable)
  remote: {
    versionJson: 'https://sg-prime-game-launcher.onrender.com/api/version',
    gameDownload: 'https://sg-prime-game-launcher.onrender.com/api/download/game',
    dllDownload: 'https://sg-prime-game-launcher.onrender.com/api/download/dll',
    newsApi: 'https://sg-prime-game-launcher.onrender.com/api/news'
  }
};

function getGamePath(installDir, ...segments) {
  return path.join(installDir, ...segments);
}

module.exports = { PATHS, getGamePath };
