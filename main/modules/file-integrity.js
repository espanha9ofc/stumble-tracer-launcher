const fs = require('fs-extra');
const path = require('path');
const { log } = require('../utils/logger');
const { getSettings } = require('./settings-manager');
const { PATHS } = require('../utils/paths');

/**
 * Deep search for the actual game root.
 * Scans recursively up to 3 levels to find where the EXE lives.
 */
async function deepFindRoot(dir, depth = 0) {
  if (depth > 3) return null;
  
  try {
    const items = await fs.readdir(dir).catch(() => []);
    const possibleExes = [
      PATHS.shadowExeName,
      PATHS.gameExe,
      'Stumble Tracer.exe',
      PATHS.gameRealExe,
      'Stumble Guys.exe',
      'StumbleGuys.exe'
    ];

    // Check if any exe is in THIS directory
    for (const exe of possibleExes) {
      if (items.includes(exe)) return dir;
    }

    // Otherwise check subdirectories
    for (const item of items) {
      const sub = path.join(dir, item);
      const stat = await fs.stat(sub).catch(() => null);
      if (stat && stat.isDirectory()) {
        const found = await deepFindRoot(sub, depth + 1);
        if (found) return found;
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

/**
 * Verify critical game files exist.
 * Returns a detailed report of what is missing.
 */
async function verifyGameFiles() {
  const settings = getSettings();
  const installDir = settings.installDirectory;
  
  if (!await fs.pathExists(installDir)) {
    return { valid: false, missing: ['Installation Directory'], checked: 0 };
  }

  // 1. Find root
  const actualRoot = await deepFindRoot(installDir) || installDir;
  log('info', `Deep scan integrity check starting at: ${actualRoot}`);

  const results = {
    valid: true,
    missing: [],
    checked: 0,
    root: actualRoot
  };

  // 2. Define Flexible Checks
  const shadowData = PATHS.shadowExeName.replace('.dat', '_Data');
  
  // Executable check
  const exePaths = [
    path.join(actualRoot, PATHS.shadowExeName),
    path.join(actualRoot, PATHS.gameExe),
    path.join(actualRoot, 'Stumble Tracer.exe'),
    path.join(actualRoot, PATHS.gameRealExe),
    path.join(actualRoot, 'Stumble Guys.exe'),
    path.join(actualRoot, 'StumbleGuys.exe')
  ];
  let exeFound = false;
  for (const p of exePaths) {
    if (await fs.pathExists(p)) { exeFound = true; break; }
  }
  results.checked++;
  if (!exeFound) {
    results.missing.push('StumbleGuys.exe');
    results.valid = false;
  }

  // Unity Data check
  const dataPaths = [
    path.join(actualRoot, shadowData),
    path.join(actualRoot, 'StumbleGuys_Data'),
    path.join(actualRoot, 'Stumble Guys_Data'),
    path.join(actualRoot, 'Stumble Tracer_Data') // [FIX] Added user-reported folder name
  ];
  let dataFound = false;
  for (const p of dataPaths) {
    if (await fs.pathExists(p)) { dataFound = true; break; }
  }
  results.checked++;
  if (!dataFound) {
    results.missing.push('Unity Data Folder');
    results.valid = false;
  }

  // Static DLLs check
  const criticalDLLs = [
    'GameAssembly.dll',
    'UnityPlayer.dll',
    'baselib.dll'
  ];

  for (const dll of criticalDLLs) {
    results.checked++;
    if (!await fs.pathExists(path.join(actualRoot, dll))) {
      results.missing.push(dll);
      results.valid = false;
    }
  }

  // MelonLoader (Flexible location)
  const melonPaths = [
    path.join(actualRoot, PATHS.melonLoaderFolder, 'net6', 'MelonLoader.dll'),   // MelonLoader v0.6+ (net6)
    path.join(actualRoot, PATHS.melonLoaderFolder, 'net35', 'MelonLoader.dll'),  // MelonLoader v0.6+ (net35)
    path.join(actualRoot, PATHS.melonLoaderFolder, 'MelonLoader.dll'),           // MelonLoader v0.5 
    path.join(actualRoot, PATHS.modsFolder, 'MelonLoader.dll'),                  // Legacy/Custom Mods folder
    path.join(actualRoot, 'MelonLoader.dll')                                     // root/MelonLoader.dll
  ];
  let melonFound = false;
  for (const p of melonPaths) {
    if (await fs.pathExists(p)) { melonFound = true; break; }
  }
  results.checked++;
  if (!melonFound) {
    results.missing.push('MelonLoader.dll');
    results.valid = false;
  }

  log('info', `Integrity check: ${results.valid ? 'PASSED' : 'FAILED'}`, {
    missing: results.missing,
    checked: results.checked
  });

  return results;
}

/**
 * Verify the mod DLL exists and is valid
 */
async function verifyModDLL() {
  const settings = getSettings();
  const installDir = settings.installDirectory;
  
  const actualRoot = await deepFindRoot(installDir) || installDir;
  const modsDir = path.join(actualRoot, 'dll');
  const dllPath = path.join(modsDir, 'Stumble TracerMod.dll');
  
  const exists = await fs.pathExists(dllPath);
  
  log('info', `Mod DLL check: ${exists ? 'FOUND' : 'MISSING'} at ${dllPath}`);
  
  return {
    valid: exists,
    path: dllPath,
    exists
  };
}

module.exports = { verifyGameFiles, verifyModDLL };
