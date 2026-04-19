const https = require('https');
const http = require('http');
const fs = require('fs-extra');
const path = require('path');
const { log } = require('./logger');

// Launcher API key for server authentication
const LAUNCHER_API_KEY = 'sp-launcher-2026-secure';

/**
 * Download a file with progress tracking
 * @param {string} url - URL to download from
 * @param {string} destPath - Destination file path
 * @param {function} onProgress - Progress callback (percent, downloaded, total, speed)
 * @returns {Promise<string>} - Path to downloaded file
 */
function downloadFile(url, destPath, onProgress = null) {
  return new Promise(async (resolve, reject) => {
    log('info', `Starting download: ${url}`);

    // Ensure destination directory exists
    try {
      fs.ensureDirSync(path.dirname(destPath));
    } catch (e) {
      return reject(new Error('Permission Denied: Cannot create installation folders. Try running as Administrator.'));
    }

    const protocol = url.startsWith('https') ? https : http;

    const makeRequest = (requestUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects. Server configuration error.'));
        return;
      }

      const reqProtocol = requestUrl.startsWith('https') ? https : http;
      const request = reqProtocol.get(requestUrl, {
        headers: {
          'User-Agent': 'Stumble TracerLauncher/1.0',
          'x-launcher-key': LAUNCHER_API_KEY
        },
        timeout: 10000 // 10s timeout for initial connection
      }, (response) => {
        // Handle redirects recursively (H4 fix)
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          log('info', `Redirect ${redirectCount + 1} to: ${response.headers.location}`);
          response.resume(); // Consume response to free up memory
          makeRequest(response.headers.location, redirectCount + 1);
          return;
        }

        handleResponse(response);
      });

      request.on('error', (err) => {
        log('error', `Download failed: ${err.message}`);
        let msg = 'Connection lost or server unreachable.';
        if (err.code === 'ENOTFOUND') msg = 'No internet connection (DNS failure).';
        if (err.code === 'ECONNREFUSED') msg = 'Server refused connection. Hosting might be down.';
        reject(new Error(msg));
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Connection timed out. Checking your internet...'));
      });

      function handleResponse(response) {
        if (response.statusCode !== 200) {
          let msg = `Server returned error ${response.statusCode}`;
          if (response.statusCode === 404) msg = 'Download link expired or file missing on server.';
          if (response.statusCode === 503) msg = 'Server is currently overloaded. Try again in 5 minutes.';
          reject(new Error(msg));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10) || 0;

        // C6 check: Disk space check (Simplified, assuming available if totalSize is 0)
        if (totalSize > 0) {
          try {
            const disk = require('diskusage');
            const drive = path.parse(destPath).root;
            disk.check(drive, (err, info) => {
              if (!err && info.available < totalSize * 1.2) { // 20% buffer
                request.destroy();
                response.destroy();
                reject(new Error(`Insufficient disk space. Needed: ${Math.round(totalSize / 1024 / 1024)}MB. Free up some space.`));
                return;
              }
            });
          } catch (e) {
            // discusage might not be available, skip hard check
          }
        }

        let downloadedSize = 0;
        let lastTime = Date.now();
        let lastDownloaded = 0;

        const fileStream = fs.createWriteStream(destPath);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;

          if (onProgress && totalSize > 0) {
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;

            let speed = 0;
            if (elapsed >= 0.5) {
              speed = (downloadedSize - lastDownloaded) / elapsed;
              lastTime = now;
              lastDownloaded = downloadedSize;
            }

            const percent = Math.round((downloadedSize / totalSize) * 100);
            const eta = speed > 0 ? Math.round((totalSize - downloadedSize) / speed) : 0;

            onProgress({
              percent,
              downloaded: downloadedSize,
              total: totalSize,
              speed,
              eta
            });
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          log('info', `Download complete: ${destPath} (${downloadedSize} bytes)`);
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.removeSync(destPath);
          let msg = 'File writing error. Check disk space or permissions.';
          if (err.code === 'ENOSPC') msg = 'Disk is full. Download cancelled.';
          reject(new Error(msg));
        });
      }
    };

    makeRequest(url);
  });
}

/**
 * Fetch JSON from a URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, {
      headers: { 'User-Agent': 'Stumble TracerLauncher/1.0' }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchJson(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Fetch failed with status: ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Check if URL is reachable
 */
function checkConnection(url = 'https://www.google.com') {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: 5000 }, (res) => {
      resolve(true);
      res.destroy();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

module.exports = { downloadFile, fetchJson, checkConnection };
