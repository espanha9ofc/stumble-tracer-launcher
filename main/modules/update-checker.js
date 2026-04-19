const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');
const { PATHS } = require('../utils/paths');
const { fetchJson } = require('../utils/download');
const { log } = require('../utils/logger');
const { getSettings } = require('./settings-manager');

/**
 * Get local version info
 */
async function getLocalVersion() {
  const settings = getSettings();
  const versionPath = path.join(settings.installDirectory, 'version.json');
  
  try {
    if (await fs.pathExists(versionPath)) {
      return await fs.readJson(versionPath);
    }
  } catch (err) {
    log('warn', 'Could not read local version.json', { error: err.message });
  }
  
  return {
    version: '0.0.0',
    dll_version: '0.0.0'
  };
}

/**
 * Get remote version info
 */
async function getRemoteVersion() {
  try {
    const remote = await fetchJson(PATHS.remote.versionJson);
    log('info', 'Remote version fetched', remote);
    return remote;
  } catch (err) {
    log('error', 'Failed to fetch remote version', { error: err.message });
    return null;
  }
}

/**
 * Check for updates
 * Returns: { hasUpdate, hasDllUpdate, localVersion, remoteVersion, downloadUrl }
 */
async function checkForUpdates() {
  try {
    const local = await getLocalVersion();
    const remote = await getRemoteVersion();

    if (!remote) {
      return {
        hasUpdate: false,
        hasDllUpdate: false,
        error: 'Could not reach update server',
        localVersion: local,
        remoteVersion: null
      };
    }

    const localVer = semver.valid(semver.coerce(local.version)) || '0.0.0';
    const remoteVer = semver.valid(semver.coerce(remote.version)) || '0.0.0';
    const localDll = semver.valid(semver.coerce(local.dll_version)) || '0.0.0';
    const remoteDll = semver.valid(semver.coerce(remote.dll_version)) || '0.0.0';

    const hasGameUpdate = semver.gt(remoteVer, localVer);
    const hasDllUpdate = semver.gt(remoteDll, localDll);

    log('info', `Update check: game ${localVer} -> ${remoteVer} (${hasGameUpdate ? 'UPDATE' : 'OK'}), dll ${localDll} -> ${remoteDll} (${hasDllUpdate ? 'UPDATE' : 'OK'})`);

    return {
      hasUpdate: hasGameUpdate,
      hasDllUpdate,
      localVersion: local,
      remoteVersion: remote,
      downloadUrl: remote.download_url || PATHS.remote.gameDownload,
      dllDownloadUrl: remote.dll_download_url || PATHS.remote.dllDownload
    };
  } catch (err) {
    log('error', 'Update check failed', { error: err.message });
    return {
      hasUpdate: false,
      hasDllUpdate: false,
      error: err.message,
      localVersion: await getLocalVersion(),
      remoteVersion: null
    };
  }
}

/**
 * Save local version after update
 */
async function updateLocalVersion(versionData) {
  const settings = getSettings();
  const versionPath = path.join(settings.installDirectory, 'version.json');
  
  try {
    await fs.writeJson(versionPath, versionData, { spaces: 2 });
    log('info', 'Local version updated', versionData);
  } catch (err) {
    log('error', 'Failed to update local version', { error: err.message });
  }
}

module.exports = { getLocalVersion, getRemoteVersion, checkForUpdates, updateLocalVersion };
