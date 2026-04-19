const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const auth = require('../middleware/auth');
const { isDbReady, uploadBufferToGridFS } = require('../config/gridfs');

// @route   POST api/branding/upload-logo
router.post('/upload-logo', auth, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
  if (!isDbReady()) return res.status(503).json({ msg: 'Database unavailable' });
  try {
    await uploadBufferToGridFS('branding', 'logo.png', req.file.buffer, { contentType: req.file.mimetype });
    res.json({ msg: 'Logo updated successfully in DB' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to save logo to DB' });
  }
});

// @route   POST api/branding/upload-banner
router.post('/upload-banner', auth, upload.single('banner'), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
  if (!isDbReady()) return res.status(503).json({ msg: 'Database unavailable' });
  try {
    await uploadBufferToGridFS('branding', 'banner.jpg', req.file.buffer, { contentType: req.file.mimetype });
    res.json({ msg: 'Banner updated successfully in DB' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to save banner to DB' });
  }
});

module.exports = router;
