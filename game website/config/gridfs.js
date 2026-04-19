const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function isDbReady() {
  return mongoose.connection.readyState === 1 && !!mongoose.connection.db;
}

function getBucket(bucketName) {
  if (!isDbReady()) {
    throw new Error('Database not connected');
  }

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
}

function getContentType(filename, fallback = 'application/octet-stream') {
  const ext = path.extname(filename || '').toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.zip': 'application/zip',
    '.dll': 'application/octet-stream'
  };

  return types[ext] || fallback;
}

async function deleteExistingFiles(bucket, filename) {
  const existing = await bucket.find({ filename }).toArray();
  for (const file of existing) {
    await bucket.delete(file._id);
  }
}

function uploadToGridFS(bucketName, filename, filePath, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const bucket = getBucket(bucketName);
      await deleteExistingFiles(bucket, filename);

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: options.contentType || getContentType(filename)
      });

      const stream = fs.createReadStream(filePath).pipe(uploadStream);
      stream.on('finish', () => resolve(true));
      stream.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

function uploadBufferToGridFS(bucketName, filename, buffer, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const bucket = getBucket(bucketName);
      await deleteExistingFiles(bucket, filename);

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: options.contentType || getContentType(filename)
      });

      uploadStream.end(buffer);
      uploadStream.on('finish', () => resolve(true));
      uploadStream.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

async function serveFromGridFS(bucketName, filename, res, options = {}) {
  try {
    const bucketNames = Array.isArray(bucketName) ? bucketName : [bucketName];

    if (!isDbReady()) {
      return res.status(404).send('Database offline - check connectivity');
    }

    for (const currentBucketName of bucketNames) {
      const bucket = getBucket(currentBucketName);
      const files = await bucket.find({ filename }).sort({ uploadDate: -1 }).toArray();

      if (!files || files.length === 0) {
        continue;
      }

      const file = files[0];
      const contentType = file.contentType || getContentType(file.filename);
      res.set('Content-Type', contentType);
      res.set(
        'Content-Disposition',
        `${options.asAttachment ? 'attachment' : 'inline'}; filename="${filename}"`
      );

      bucket.openDownloadStream(file._id)
        .on('error', () => {
          if (!res.headersSent) {
            res.status(500).send('Error streaming file');
          } else {
            res.end();
          }
        })
        .pipe(res);

      return true;
    }

    return res.status(404).send('File not found in DB');
  } catch (e) {
    return res.status(500).send('Server DB Error');
  }
}

function purgeGridFS(bucketName) {
  return new Promise(async (resolve, reject) => {
    try {
      const bucket = getBucket(bucketName);
      const files = await bucket.find({}).toArray();

      for (const file of files) {
        await bucket.delete(file._id);
      }

      console.log(`GridFS bucket ${bucketName} purged successfully.`);
      resolve(true);
    } catch (e) {
      console.error('Failed to purge GridFS:', e);
      reject(e);
    }
  });
}

module.exports = { isDbReady, uploadToGridFS, uploadBufferToGridFS, serveFromGridFS, purgeGridFS };
