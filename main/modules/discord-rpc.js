const { log } = require('../utils/logger');
const { getSettings } = require('./settings-manager');

let rpcClient = null;
let rpcReady = false;
let activityTimer = null;

const CLIENT_ID = '1475981619604099274'; // Replace with your Discord Application ID
const startTimestamp = new Date();

const RPC_BUTTONS = [
  { label: 'Join Stumble Tracer', url: 'https://discord.gg/k45zwwxfJh' }
];

/**
 * Initialize Discord RPC
 */
async function initDiscordRPC() {
  const settings = getSettings();
  if (!settings.discordRPC) {
    log('info', 'Discord RPC disabled in settings');
    return false;
  }

  try {
    // Dynamic import since discord-rpc might not be installed
    const DiscordRPC = require('discord-rpc');
    DiscordRPC.register(CLIENT_ID);

    rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

    rpcClient.on('ready', () => {
      rpcReady = true;
      log('info', 'Discord RPC connected');
      setIdleActivity();
    });

    rpcClient.on('disconnected', () => {
      rpcReady = false;
      log('info', 'Discord RPC disconnected');
    });

    await rpcClient.login({ clientId: CLIENT_ID });
    return true;
  } catch (err) {
    log('warn', 'Discord RPC init failed (Discord may not be running)', { error: err.message });
    rpcClient = null;
    rpcReady = false;
    return false;
  }
}

/**
 * Set activity when idle (in launcher)
 */
function setIdleActivity() {
  if (!rpcReady || !rpcClient) return;

  try {
    rpcClient.setActivity({
      details: 'Browsing Launcher',
      startTimestamp,
      largeImageKey: 'stumble_tracer',
      largeImageText: 'Stumble Tracer',
      buttons: RPC_BUTTONS,
      instance: false
    });
  } catch (err) {
    log('warn', 'Failed to set idle activity', { error: err.message });
  }
}

/**
 * Set activity when game is running
 */
function setPlayingActivity(activityState = 'In Game') {
  if (!rpcReady || !rpcClient) return;

  try {
    rpcClient.setActivity({
      startTimestamp: new Date(),
      largeImageKey: 'stumble_prime_logo',
      largeImageText: 'Stumble Tracer',
      buttons: RPC_BUTTONS,
      instance: false,
      state: activityState,
      details: 'Stumble Tracer'
    });
    log('info', `Discord RPC: Playing - ${activityState}`);
  } catch (err) {
    log('warn', 'Failed to set playing activity', { error: err.message });
  }
}

/**
 * Set custom activity
 */
function setActivity(activity) {
  if (!rpcReady || !rpcClient) return;

  try {
    rpcClient.setActivity({
      details: activity.details || 'Stumble Tracer',
      state: activity.state || '',
      startTimestamp: activity.startTimestamp || new Date(),
      largeImageKey: 'stumble_prime_logo',
      largeImageText: 'Stumble Tracer',
      buttons: RPC_BUTTONS,
      instance: false
    });
  } catch (err) {
    log('warn', 'Failed to set custom activity', { error: err.message });
  }
}

/**
 * Clear activity (game closed)
 */
function clearActivity() {
  if (!rpcReady || !rpcClient) return;

  try {
    rpcClient.clearActivity();
    setIdleActivity(); // Go back to idle state
    log('info', 'Discord RPC: Activity cleared');
  } catch (err) {
    log('warn', 'Failed to clear activity', { error: err.message });
  }
}

/**
 * Enable Discord RPC
 */
async function enableRPC() {
  if (rpcReady) return true;
  return await initDiscordRPC();
}

/**
 * Disable Discord RPC
 */
async function disableRPC() {
  if (rpcClient) {
    try {
      rpcClient.clearActivity();
      await rpcClient.destroy();
    } catch (err) {
      log('warn', 'Error destroying RPC client', { error: err.message });
    }
    rpcClient = null;
    rpcReady = false;
  }
  log('info', 'Discord RPC disabled');
}

/**
 * Destroy RPC on app quit
 */
async function destroyRPC() {
  await disableRPC();
}

module.exports = {
  initDiscordRPC,
  setPlayingActivity,
  setIdleActivity,
  setActivity,
  clearActivity,
  enableRPC,
  disableRPC,
  destroyRPC
};
