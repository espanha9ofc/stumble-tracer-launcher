const os = require('os');
const crypto = require('crypto');

/**
 * Generates a stable hardware fingerprint for the device.
 * Uses hostname, platform, and CPU info.
 */
function getHWID() {
  const platform = os.platform();
  const hostname = os.hostname();
  const cpu = os.cpus()[0].model;
  const username = os.userInfo().username;
  
  const raw = `${platform}-${hostname}-${cpu}-${username}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

module.exports = { getHWID };
