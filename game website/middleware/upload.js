const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

// Storage config for large files (on disk)
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dest = path.join(UPLOAD_ROOT, 'games');
    if (file.fieldname === 'dll') dest = path.join(UPLOAD_ROOT, 'dlls');
    
    // Ensure dir exists
    fs.ensureDirSync(dest);
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    if (file.fieldname === 'game') cb(null, 'Stumble Tracer.zip');
    else if (file.fieldname === 'dll') cb(null, 'mod.dll');
    else cb(null, Date.now() + path.extname(file.originalname));
  }
});

const mediaDiskStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const dest = path.join(UPLOAD_ROOT, 'assets');
    fs.ensureDirSync(dest);
    cb(null, dest);
  },
  filename: function (_req, file, cb) {
    cb(null, `media-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Storage config for small assets (in memory for GridFS)
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isBinary = file.fieldname === 'game' || file.fieldname === 'dll';
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.fieldname === 'media' && file.mimetype.startsWith('video/');
  
  if (isBinary || isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type!'), false);
  }
};

const upload = multer({ 
  storage: multer.memoryStorage(), // Default to memory
  limits: { fileSize: 5000 * 1024 * 1024 },
  fileFilter: fileFilter
});

const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 5000 * 1024 * 1024 }
});

const mediaUpload = multer({
  storage: mediaDiskStorage,
  limits: { fileSize: 5000 * 1024 * 1024 },
  fileFilter
});

module.exports = { upload, diskUpload, mediaUpload };
