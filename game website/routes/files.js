const express = require('express');
const router = express.Router();
const { diskUpload } = require('../middleware/upload');
const auth = require('../middleware/auth');
const fs = require('fs-extra');
const path = require('path');

// @route   POST api/files/upload-game
// @desc    Upload new game zip
router.post('/upload-game', auth, diskUpload.single('game'), async (req, res) => {
  req.setTimeout(0); // Prevent timeout for 400MB+ files
  try {
    const { version } = req.body;
    
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    if (!version) return res.status(400).json({ msg: 'Version is required' });

    // Auto-update local version.json that the launcher fetches
    updateVersionJson('game', version);

    res.json({ msg: 'Game uploaded and saved to LOCAL DISK successfully' });
  } catch (err) {
    console.error('Game Upload Error:', err);
    res.status(500).json({ msg: `Server Error: ${err.message || 'Unknown Game Route Error'}` });
  }
});

// @route   POST api/files/upload-dll
// @desc    Upload new mod DLL
router.post('/upload-dll', auth, diskUpload.single('dll'), async (req, res) => {
  req.setTimeout(0); // Prevent timeout for mod patches
  try {
    const { version } = req.body;
    
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    if (!version) return res.status(400).json({ msg: 'Version is required' });

    updateVersionJson('dll', version);

    res.json({ msg: 'DLL uploaded and saved to LOCAL DISK successfully' });
  } catch (err) {
    console.error('DLL Upload Error:', err);
    res.status(500).json({ msg: `Server Error: ${err.message || 'Unknown DLL Route Error'}` });
  }
});

// @route   POST api/files/purge
// @desc    Clear all database storage (GridFS and metadata)
router.post('/purge', auth, async (req, res) => {
  req.setTimeout(0);
  try {
    // Note: Purge now only targets local disk as database storage is disabled.
    
    // Delete local disk files
    const gameFile = path.join(__dirname, '../uploads/games/Stumble Tracer.zip');
    const dllFile = path.join(__dirname, '../uploads/dlls/mod.dll');
    await fs.remove(gameFile).catch(() => {});
    await fs.remove(dllFile).catch(() => {});
    
    // Reset flat version tracker
    const vPath = path.join(__dirname, '../uploads/version.json');
    const resetData = { version: "0.0.0", dll_version: "0.0.0", game_updated: null, dll_updated: null };
    await fs.writeJson(vPath, resetData);
    
    res.json({ msg: 'Local storage purged successfully. All binaries and metadata removed.' });
  } catch (err) {
    console.error('Purge error:', err.message);
    res.status(500).send('Purge failed: ' + err.message);
  }
});

// Helper to update flat version JSON file served to launcher
function updateVersionJson(type, newVersionStr) {
  const vPath = path.join(__dirname, '../uploads/version.json');
  let data = { version: "0.0.0", dll_version: "0.0.0" };
  
  if (fs.existsSync(vPath)) {
    data = fs.readJsonSync(vPath);
  }
  
  if (type === 'game') {
    data.version = newVersionStr;
    data.game_updated = new Date().toISOString();
  }
  if (type === 'dll') {
    data.dll_version = newVersionStr;
    data.dll_updated = new Date().toISOString();
  }
  
  // Ensure the directory exists before writing JSON
  fs.ensureDirSync(path.dirname(vPath));
  fs.writeJsonSync(vPath, data, { spaces: 2 });
}

// Error handler for Multer/Uploads (C5 fix)
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ msg: 'File too large! Max limit is 600MB.' });
  }
  res.status(500).json({ msg: err.message });
});

module.exports = router;
