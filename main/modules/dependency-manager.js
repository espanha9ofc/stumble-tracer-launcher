const { execSync, exec } = require('child_process');
const { log } = require('../utils/logger');
const { downloadFile } = require('../utils/download');
const path = require('path');
const { PATHS } = require('../utils/paths');
const fs = require('fs-extra');

/**
 * Check if Visual C++ Redistributable is installed
 */
function checkVCRedist() {
  try {
    const output = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\X64" /v Version',
      { encoding: 'utf8', timeout: 5000 }
    );
    const installed = output.includes('Version');
    log('info', `VC++ Redistributable: ${installed ? 'installed' : 'not found'}`);
    return installed;
  } catch {
    // Try alternative registry path
    try {
      const output = execSync(
        'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\X64" /v Version',
        { encoding: 'utf8', timeout: 5000 }
      );
      return output.includes('Version');
    } catch {
      log('info', 'VC++ Redistributable: not found');
      return false;
    }
  }
}

/**
 * Check if .NET Runtime is installed
 */
function checkDotNetRuntime() {
  try {
    const output = execSync('dotnet --list-runtimes', { encoding: 'utf8', timeout: 10000 });
    const hasDesktop = output.includes('Microsoft.WindowsDesktop.App') || output.includes('Microsoft.NETCore.App');
    log('info', `.NET Runtime: ${hasDesktop ? 'installed' : 'not found'}`);
    return hasDesktop;
  } catch {
    log('info', '.NET Runtime: not found (dotnet command failed)');
    return false;
  }
}

/**
 * Check all dependencies
 */
async function checkDependencies() {
  const results = {
    vcRedist: checkVCRedist(),
    dotNet: checkDotNetRuntime(),
    allGood: false
  };
  
  results.allGood = results.vcRedist && results.dotNet;
  log('info', 'Dependency check results', results);
  return results;
}

/**
 * Install Visual C++ Redistributable silently
 */
async function installVCRedist(onProgress) {
  const url = 'https://aka.ms/vs/17/release/vc_redist.x64.exe';
  const destPath = path.join(PATHS.temp, 'vc_redist.x64.exe');

  try {
    await fs.ensureDir(PATHS.temp);
    
    if (onProgress) onProgress({ stage: 'Downloading VC++ Redistributable...', percent: 10 });
    await downloadFile(url, destPath);

    if (onProgress) onProgress({ stage: 'Installing VC++ Redistributable...', percent: 50 });
    
    return new Promise((resolve, reject) => {
      exec(`"${destPath}" /quiet /norestart`, { timeout: 120000 }, (err) => {
        fs.remove(destPath).catch(() => {});
        if (err) {
          log('error', 'VC++ install failed', { error: err.message });
          reject(err);
        } else {
          log('info', 'VC++ Redistributable installed successfully');
          if (onProgress) onProgress({ stage: 'VC++ Redistributable installed!', percent: 100 });
          resolve(true);
        }
      });
    });
  } catch (err) {
    log('error', 'VC++ installation error', { error: err.message });
    throw err;
  }
}

/**
 * Install .NET Desktop Runtime silently
 */
async function installDotNet(onProgress) {
  const url = 'https://dot.net/v1/dotnet-install.ps1';
  const scriptPath = path.join(PATHS.temp, 'dotnet-install.ps1');

  try {
    await fs.ensureDir(PATHS.temp);
    
    if (onProgress) onProgress({ stage: 'Downloading .NET Desktop Runtime...', percent: 10 });
    await downloadFile(url, scriptPath);

    if (onProgress) onProgress({ stage: 'Installing .NET Desktop Runtime...', percent: 50 });

    return new Promise((resolve, reject) => {
      exec(
        `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -Channel LTS -Runtime windowsdesktop -Architecture x64`,
        { timeout: 180000 },
        (err) => {
          fs.remove(scriptPath).catch(() => {});
          if (err) {
            log('error', '.NET install failed', { error: err.message });
            resolve(false);
          } else {
            log('info', '.NET Desktop Runtime installed successfully');
            if (onProgress) onProgress({ stage: '.NET Desktop Runtime installed!', percent: 100 });
            resolve(true);
          }
        }
      );
    });
  } catch (err) {
    log('error', '.NET installation error', { error: err.message });
    throw err;
  }
}

/**
 * Install all missing dependencies
 */
async function installDependencies(onProgress) {
  const deps = await checkDependencies();
  const results = { vcRedist: deps.vcRedist, dotNet: deps.dotNet };

  if (!deps.vcRedist) {
    try {
      results.vcRedist = await installVCRedist(onProgress);
    } catch {
      results.vcRedist = false;
    }
  }

  if (!deps.dotNet) {
    try {
      results.dotNet = await installDotNet(onProgress);
    } catch {
      results.dotNet = false;
    }
  }

  if (!results.vcRedist || !results.dotNet) {
    const finalCheck = await checkDependencies();
    results.vcRedist = finalCheck.vcRedist;
    results.dotNet = finalCheck.dotNet;
  }

  results.allGood = results.vcRedist && results.dotNet;
  return results;
}

module.exports = { checkDependencies, installDependencies };
