const fs = require('fs-extra');
const path = require('path');
const { PATHS } = require('./paths');

let logStream = null;

function initLogger() {
  try {
    fs.ensureDirSync(PATHS.logs);
    const logFile = path.join(PATHS.logs, `launcher-${getDateStr()}.log`);
    logStream = fs.createWriteStream(logFile, { flags: 'a' });
    // M1: Clean old logs on startup
    cleanOldLogs();
  } catch (err) {
    console.error('Failed to initialize logger:', err);
  }
}

function getDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

function log(level, message, data = null) {
  const entry = `[${getTimestamp()}] [${level.toUpperCase()}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}`;
  
  // Console output
  switch (level) {
    case 'error': console.error(entry); break;
    case 'warn': console.warn(entry); break;
    case 'debug': console.debug(entry); break;
    default: console.log(entry);
  }

  // File output
  if (logStream) {
    logStream.write(entry + '\n');
  }
}

function cleanOldLogs(maxDays = 7) {
  try {
    const files = fs.readdirSync(PATHS.logs);
    const cutoff = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      const filePath = path.join(PATHS.logs, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.removeSync(filePath);
        log('info', `Cleaned old log: ${file}`);
      }
    }
  } catch (err) {
    console.error('Failed to clean logs:', err);
  }
}

module.exports = { initLogger, log, cleanOldLogs };
