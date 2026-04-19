const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');
const { spawn, exec } = require('child_process');
const { PATHS, getGamePath } = require('../utils/paths');
const { downloadFile } = require('../utils/download');
const { log } = require('../utils/logger');
const { getSettings } = require('./settings-manager');
const { createDesktopShortcut } = require('./shortcut-manager');
const overlayManager = require('./overlay-manager');

let gameProcess = null;

// [Performance Optimization] Cache for expensive game info
let cachedGameInfo = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const gameManager = {

  /**
   * Aggressively find the actual game directory by scanning for valid .exe files.
   * Filters out known system/utility EXEs.
   */
  async getActualGameRoot(installDir) {
    const possibleNames = [
      PATHS.gameExe,               // Stumble Tracer.exe or legacy StumbleGuys.exe
      'Stumble Tracer.exe',        // New game executable name
      PATHS.gameRealExe,           // shadow/real exe variant
      'Stumble Guys.exe',          // Original name
      'StumbleGuys.exe',           // Common variation
      PATHS.shadowExeName          // Hidden internal name
    ];

    const blacklistedExes = [
      'UnityCrashHandler64.exe', 
      'UnityCrashHandler32.exe', 
      'uninst000.exe', 
      'vc_redist.x64.exe',
      'vc_redist.x86.exe'
    ];

    let foundRoots = [];

    // Powerful recursive walker to find ALL .exe files
    const walk = async (dir) => {
      try {
        const items = await fs.readdir(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            await walk(fullPath);
          } else {
            const lowerItem = item.toLowerCase();
            const isExe = lowerItem.endsWith('.exe');
            const isShadow = item === PATHS.shadowExeName;

            if (isExe || isShadow) {
              // Check if it's one of our expected names OR not a blacklisted one
              if (possibleNames.includes(item) || !blacklistedExes.includes(item)) {
                foundRoots.push(dir);
              }
            }
          }
        }
      } catch (e) {}
    };

    await walk(installDir);

    if (foundRoots.length === 0) return null;

    // Preference 1: Root that contains one of the preferred names
    for (const root of foundRoots) {
      const items = await fs.readdir(root);
      for (const name of possibleNames) {
        if (items.includes(name)) return root;
      }
    }

    // Preference 2: The shortest path among found roots (usually the main game folder)
    foundRoots.sort((a, b) => a.length - b.length);
    return foundRoots[0];
  },

  /**
   * Enforce shadow name (rename real exe to shadow name)
   */
  async ensureShadowExe(installDir) {
    const root = await this.getActualGameRoot(installDir);
    if (!root) return null;

    const shadowName = PATHS.shadowExeName || 'Stumble Tracer_internal.dat';
    const shadowPath = path.join(root, shadowName);

    // If shadow already exists, we are good
    if (await fs.pathExists(shadowPath)) return shadowPath;

    // Otherwise, try to find the real EXE and rename it
    const originalNames = ['Stumble Guys.exe', 'StumbleGuys.exe', 'Stumble Tracer.exe'];
    for (const name of originalNames) {
      const p = path.join(root, name);
      if (await fs.pathExists(p)) {
        try {
          // 1. Rename EXE to shadow name
          log('info', `Shadowing game executable: ${name} -> ${shadowName}`);
          await fs.rename(p, shadowPath);

          // 2. Rename corresponding Unity Data folder (Handle all possible variations)
          const baseName = name.replace('.exe', '');
          const dataVariations = [
            baseName + '_Data',
            'StumbleGuys_Data',
            'Stumble Guys_Data',
            'Stumble Tracer_Data' // [FIX] Added the variation reported by the user
          ];
          
          let oldDataPath = null;
          for (const variant of dataVariations) {
            const pVariant = path.join(root, variant);
            if (await fs.pathExists(pVariant)) {
              oldDataPath = pVariant;
              break;
            }
          }

          const newDataName = shadowName.replace('.dat', '') + '_Data';
          const newDataPath = path.join(root, newDataName);

          if (oldDataPath) {
            log('info', `Shadowing data folder: ${path.basename(oldDataPath)} -> ${newDataName}`);
            await fs.rename(oldDataPath, newDataPath);
          }

          return shadowPath;
        } catch (e) {
          log('error', 'Failed to rename for shadowing', { error: e.message });
        }
      }
    }
    return null;
  },

  /**
   * Main installation flow
   */
};

let mainWindowRef = null;

function setMainWindow(win) {
  mainWindowRef = win;
}

function sendToRenderer(channel, data) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, data);
  }
}

/**
 * Check if the game is installed
 */
async function isGameInstalled() {
  const settings = getSettings();
  const root = await gameManager.getActualGameRoot(settings.installDirectory);
  return root !== null;
}

/**
 * Get game information
 */
async function getGameInfo(forceRefresh = false) {
  const settings = getSettings();
  const installed = await isGameInstalled();
  
  // Return cached info if still valid and not forced
  const now = Date.now();
  if (!forceRefresh && cachedGameInfo && (now - lastCacheUpdate < CACHE_TTL)) {
    // We still update the isRunning state from the live process variable
    cachedGameInfo.isRunning = gameProcess !== null;
    return cachedGameInfo;
  }

  let localVersion = null;
  let fileSize = 0;

  if (installed) {
    // Read local version
    try {
      const versionPath = path.join(settings.installDirectory, 'version.json');
      if (await fs.pathExists(versionPath)) {
        const versionData = await fs.readJson(versionPath);
        localVersion = versionData.version || '0.0.0';
      }
    } catch (err) {
      log('warn', 'Could not read local version', { error: err.message });
    }

    // Calculate install size (Expensive — part of cache)
    try {
      fileSize = await getDirSize(settings.installDirectory);
    } catch (err) {
      log('warn', 'Could not calculate game size');
    }
  }

  const info = {
    name: 'Stumble Tracer',
    installed,
    installPath: settings.installDirectory,
    version: localVersion,
    fileSize,
    isRunning: gameProcess !== null
  };

  // Update Cache
  cachedGameInfo = info;
  lastCacheUpdate = now;

  return info;
}

/**
 * Install the game
 */
async function installGame(downloadUrl = null) {
  const settings = getSettings();
  let installDir = settings.installDirectory;
  
  // If the selected folder already contains the game, skip fresh download/install.
  const existingRoot = await gameManager.getActualGameRoot(installDir);
  if (existingRoot) {
    log('info', `Existing game installation detected at: ${existingRoot}`);
    sendToRenderer('install:progress', { stage: 'updating', percent: 10, message: 'Using existing game folder...' });
    await updateModDLL().catch(err => {
      log('warn', 'Failed to auto-install DLL into existing installation', { error: err.message });
    });

    // Write local version.json for consistent update behavior if possible
    try {
      const { fetchJson } = require('../utils/download');
      const remoteVersion = await fetchJson(PATHS.remote.versionJson).catch(() => null);
      if (remoteVersion) {
        const versionPath = path.join(installDir, 'version.json');
        await fs.writeJson(versionPath, remoteVersion, { spaces: 2 });
      }
    } catch (err) {
      log('warn', 'Could not write local version.json for existing installation', { error: err.message });
    }

    await createDesktopShortcut().catch(() => {});
    await gameManager.ensureShadowExe(installDir).catch(() => {});

    cachedGameInfo = null;
    lastCacheUpdate = 0;

    log('info', 'Existing installation configured successfully');
    return { success: true, actualRoot: existingRoot };
  }

  // Prevent installing directly to drive root to avoid polluting drives
  if (!installDir || installDir.length <= 3 || /^[a-zA-Z]:[\\/]?$/.test(installDir)) {
    const drive = installDir && installDir.length >= 2 ? installDir.substring(0, 2) + path.sep : 'C:' + path.sep;
    installDir = path.join(drive, 'Stumble Tracer');
    log('info', `Corrected invalid/root install path to safely use: ${installDir}`);
  }

  const url = downloadUrl || PATHS.remote.gameDownload;
  const tempZip = path.join(PATHS.temp, 'Stumble Tracer.zip');

  // Simplified and more robust recursive directory creator for Windows
  const safeEnsureDir = async (dirPath) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (e) {
      if (e.code === 'EPERM') {
        // If it's a permission error on a root drive, check if it actually exists first
        if (await fs.pathExists(dirPath)) return;
      }
      throw e;
    }
  };

  try {
    sendToRenderer('install:progress', { stage: 'downloading', percent: 0, message: 'Starting download...' });
    log('info', `Installing game to: ${installDir}`);

    // Ensure directories exist
    await safeEnsureDir(installDir);
    await safeEnsureDir(PATHS.temp);

    // Download game zip
    await downloadFile(url, tempZip, (progress) => {
      sendToRenderer('download:progress', {
        percent: progress.percent,
        downloaded: progress.downloaded,
        total: progress.total,
        speed: progress.speed,
        eta: progress.eta
      });
      sendToRenderer('install:progress', { 
        stage: 'downloading', 
        percent: progress.percent,
        message: `Downloading... ${progress.percent}%`
      });
    });

    sendToRenderer('install:progress', { stage: 'extracting', percent: 0, message: 'Extracting files...' });
    log('info', 'Extracting game files...');

    sendToRenderer('install:progress', { stage: 'extracting', percent: 0, message: 'Extracting files...' });
    log('info', 'Extracting game files via PowerShell...');

    // Use PowerShell for non-blocking extraction (Built-in to Windows)
    try {
      const psCommand = `Expand-Archive -Path "${tempZip}" -DestinationPath "${installDir}" -Force`;
      await new Promise((resolve, reject) => {
        exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
          if (error) {
            log('error', `PowerShell Extraction Error: ${error.message}`);
            return reject(error);
          }
          resolve();
        });
      });
      log('info', 'PowerShell Extraction complete');
    } catch (zipErr) {
      log('warn', 'PowerShell extraction failed, falling back to AdmZip...');
      try {
        const zip = new AdmZip(tempZip);
        zip.extractAllTo(installDir, true);
      } catch (fallbackErr) {
        throw new Error(`Extraction Failed: ${fallbackErr.message}`);
      }
    }
    
    sendToRenderer('install:progress', { stage: 'extracting', percent: 100, message: 'Extraction complete!' });

    // Clean up temp file
    await fs.remove(tempZip).catch(() => {});

    // [Aggressive Recovery Logic] Find where the game actually landed
    let actualRoot = await gameManager.getActualGameRoot(installDir);
    if (!actualRoot) {
      throw new Error("Installation failed: Could not find any valid .exe file in the extracted content. Please check your ZIP file.");
    }

    // [Final Aggressive Flattening] Move contents to root AND delete all intermediate folders
    if (path.resolve(actualRoot) !== path.resolve(installDir)) {
      log('info', `Nesting detected. Aggressively flattening from ${actualRoot} to ${installDir}`);
      sendToRenderer('install:progress', { stage: 'extracting', percent: 95, message: 'Finalizing structure...' });
      
      try {
        const items = await fs.readdir(actualRoot);
        for (const item of items) {
          const src = path.join(actualRoot, item);
          const dest = path.join(installDir, item);
          await fs.move(src, dest, { overwrite: true });
        }

        // Extremely safe cleanup: delete all immediate subdirectories of installDir 
        // that are now potentially empty OR were part of the nested path.
        // We only delete directories that are NOT 'Mods' or 'MelonLoader' (if they exist at root).
        const currentItems = await fs.readdir(installDir);
        for (const item of currentItems) {
          const fullPath = path.join(installDir, item);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            // If this directory doesn't contain any of the items we just moved to root
            // OR it's one of the known redundant folders.
            // A simpler way: if the directory is now empty or only contains other empty folders, it was redundant.
            // But specifically, we want to kill the path that led to actualRoot.
            const relativeToActual = path.relative(fullPath, actualRoot);
            if (!relativeToActual.startsWith('..')) {
               // This folder contains the old actualRoot path
               log('info', `Removing redundant nested path: ${fullPath}`);
               await fs.remove(fullPath).catch(() => {});
            }
          }
        }

        actualRoot = installDir;
      } catch (moveErr) {
        log('error', 'Failed to flatten directory structure', { error: moveErr.message });
      }
    }

    // Now update the mod DLL into the CORRECT discovered Mods folder
    sendToRenderer('install:progress', { stage: 'updating', percent: 50, message: 'Installing Mod DLL...' });
    await updateModDLL().catch(err => {
      log('warn', 'Failed to auto-install DLL during setup', { error: err.message });
    });

    log('info', 'Installation and smart path discovery complete');

    // Write local version.json so we don't falsely trigger "update available" next time
    try {
      const { fetchJson } = require('../utils/download');
      const remoteVersion = await fetchJson(PATHS.remote.versionJson).catch(() => null);
      if (remoteVersion) {
        const versionPath = path.join(installDir, 'version.json');
        await fs.writeJson(versionPath, remoteVersion, { spaces: 2 });
        log('info', 'Wrote local version.json after install', remoteVersion);
      }
    } catch (vErr) {
      log('warn', 'Could not write local version.json after install', { error: vErr.message });
    }

    // Create a desktop shortcut for the launcher so they don't look for the game exe
    await createDesktopShortcut().catch(() => {});

    // [New Enforcement] Ensure shadow name is active
    await gameManager.ensureShadowExe(installDir).catch(() => {});

    sendToRenderer('install:complete', { success: true, message: 'Game installed successfully!' });
    log('info', 'Game installation complete');

    // Invalidate cache after install
    cachedGameInfo = null;
    lastCacheUpdate = 0;

    return { success: true, actualRoot };
  } catch (err) {
    const errorMsg = err.message || 'Unknown installation error';
    log('error', 'Installation failed', { error: errorMsg });
    
    // Clean up on failure
    const tempZip = path.join(PATHS.temp, 'Stumble Tracer.zip');
    await fs.remove(tempZip).catch(() => {});
    
    sendToRenderer('install:error', { message: errorMsg });
    throw new Error(errorMsg);
  }
}

/**
 * Download and place mod DLL
 */
async function updateModDLL(dllUrl = null) {
  const settings = getSettings();
  const installDir = settings.installDirectory;
  const url = dllUrl || PATHS.remote.dllDownload;
  
  try {
    const gameRoot = await gameManager.getActualGameRoot(installDir);
    if (!gameRoot) {
      log('warn', 'Cannot update DLL: Game root not found yet.');
      return { success: false, error: 'Executable not found' };
    }

    const modsDir = path.join(gameRoot, 'Mods');
    await fs.ensureDir(modsDir);
    const dllDest = path.join(modsDir, 'Stumble TracerMod.dll');
    
    log('info', `Updating DLL in: ${modsDir}`);
    await downloadFile(url, dllDest, (progress) => {
      sendToRenderer('download:progress', {
        percent: progress.percent,
        downloaded: progress.downloaded,
        total: progress.total,
        speed: progress.speed,
        eta: progress.eta
      });
    });

    log('info', 'Mod DLL updated successfully');
    return { success: true };
  } catch (err) {
    log('error', 'Failed to update mod DLL', { error: err.message });
    throw err;
  }
}

/**
 * Launch the game
 */
async function launchGame() {
  const settings = getSettings();
  const installDir = settings.installDirectory;
  
  try {
    // [Preparation] Ensure files are shadowed/secured BEFORE checking integrity
    // This prevents "Corruption Detected" loops on first launch
    await gameManager.ensureShadowExe(installDir).catch(e => {
      log('warn', 'Pre-launch shadowing attempt failed', { error: e.message });
    });

    const { verifyGameFiles } = require('./file-integrity');
    const integrity = await verifyGameFiles();
    
    if (!integrity.valid) {
      log('warn', 'Launch blocked: Integrity check failed', { missing: integrity.missing });
      throw new Error(`INTEGRITY_FAILED: ${integrity.missing.join(', ')}`);
    }

    const gameRoot = await gameManager.getActualGameRoot(installDir);
    
    if (!gameRoot) {
      throw new Error(`Game executable not found in ${installDir}. Please ensure your ZIP contains the .exe file.`);
    }

    log('info', `Launching game from: ${gameRoot}`);
    sendToRenderer('game:status', { status: 'launching' });

    let launchTarget = await gameManager.ensureShadowExe(installDir);
    
    // Fallback search if something went wrong with shadowing
    if (!launchTarget) {
      log('warn', 'Shadow EXE not found, searching original names...');
      const possibleNames = ['Stumble Guys.exe', 'StumbleGuys.exe', PATHS.gameExe];
      for (const name of possibleNames) {
        const p = path.join(gameRoot, name);
        if (await fs.pathExists(p)) { launchTarget = p; break; }
      }
    }

    if (!launchTarget) throw new Error("Game executable not found.");

    gameProcess = spawn(launchTarget, [], {
      cwd: gameRoot, 
      detached: true,
      stdio: 'ignore'
    });

    // Start overlay if enabled (delayed so game window settles first)
    if (settings.enableOverlay) {
      log('info', 'Overlay enabled — will create after 3s delay');
      setTimeout(() => {
        try {
          overlayManager.createOverlayWindow(mainWindowRef, settings.username || 'Player', 0);
          log('info', 'Overlay creation call completed');
        } catch (overlayErr) {
          log('error', 'Overlay creation failed', { error: overlayErr.message });
        }
      }, 3000);
    } else {
      log('info', 'Overlay disabled in settings, skipping');
    }

    gameProcess.on('error', (err) => {
      log('error', 'Game process error', { error: err.message });
      gameProcess = null;
      overlayManager.closeOverlayWindow();
      sendToRenderer('game:status', { status: 'error', message: err.message });
    });

    gameProcess.on('exit', (code) => {
      log('info', `Game exited with code: ${code}`);
      gameProcess = null;
      overlayManager.closeOverlayWindow();
      sendToRenderer('game:status', { status: 'closed', exitCode: code });
    });

    sendToRenderer('game:status', { status: 'running' });
    return { success: true };
  } catch (err) {
    log('error', 'Failed to launch game', { error: err.message });
    gameProcess = null;
    throw err;
  }
}

/**
 * Repair game installation
 */
async function repairGame() {
  const settings = getSettings();
  log('info', 'Starting game repair...');
  
  try {
    // Remove existing installation
    if (await fs.pathExists(settings.installDirectory)) {
      await fs.remove(settings.installDirectory);
    }
    
    // Reinstall
    await installGame();
    
    log('info', 'Game repair complete');
    return { success: true };
  } catch (err) {
    log('error', 'Game repair failed', { error: err.message });
    throw err;
  }
}

/**
 * Uninstall the game
 */
async function uninstallGame() {
  const settings = getSettings();
  
  try {
    if (await fs.pathExists(settings.installDirectory)) {
      await fs.remove(settings.installDirectory);
      log('info', 'Game uninstalled');
    }
    return { success: true };
  } catch (err) {
    log('error', 'Uninstall failed', { error: err.message });
    throw err;
  }
}

/**
 * Launcher Guard: Background process monitoring
 */
function startWatchdog() {
  log('info', 'Launcher Guard initialized');
  
  setInterval(async () => {
    // Only check if launcher is open but not actively running the game itself
    if (gameProcess !== null) return;

    try {
      const shadowName = PATHS.shadowExeName;
      
      // PowerShell check for the process
      exec(`tasklist /FI "IMAGENAME eq ${shadowName}" /FO CSV /NH`, (err, stdout) => {
        if (err) return;
        
        // If the process name is found in output, it's an unauthorized launch
        if (stdout.includes(shadowName)) {
          log('warn', `Unauthorized launch detected: ${shadowName}. Terminating...`);
          
          // Force kill the unauthorized process
          exec(`taskkill /F /IM ${shadowName}`, (killErr) => {
            if (!killErr) {
              sendToRenderer('game:unauthorized', { message: 'Please launch through the Stumble Tracer Launcher!' });
            }
          });
        }
      });
    } catch (e) {
      // Silently fail to avoid console spam
    }
  }, 3000); // Check every 3 seconds
}

/**
 * Get directory size recursively
 */
async function getDirSize(dirPath) {
  let size = 0;
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        size += await getDirSize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }
  } catch (err) {
    // ignore errors for inaccessible files
  }
  return size;
}

function isGameRunning() {
  return gameProcess !== null;
}

module.exports = {
  setMainWindow,
  isGameInstalled,
  getGameInfo,
  installGame,
  updateModDLL,
  launchGame,
  repairGame,
  uninstallGame,
  isGameRunning,
  startWatchdog
};
