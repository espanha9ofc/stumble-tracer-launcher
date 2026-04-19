const express = require('express');
const router = express.Router();
const Media = require('../models/Media');
const auth = require('../middleware/auth');
const { mediaUpload } = require('../middleware/upload');
const { isDbReady, uploadToGridFS } = require('../config/gridfs');
const fs = require('fs-extra');
const path = require('path');

// @route   GET api/media
// @desc    Get all gallery items (optional category filter)
router.get('/', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.json([]);
    }

    const { category } = req.query;
    const filter = category ? { category } : {};
    const list = await Media.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/media
// @desc    Upload new gallery item
router.post('/', auth, mediaUpload.single('media'), async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ msg: 'Database unavailable' });
    }

    const { title, type } = req.body;
    let url = req.body.url;

    if (req.file) {
      const filename = req.file.filename || `media-${Date.now()}${path.extname(req.file.originalname)}`;
      await uploadToGridFS('gallery', filename, req.file.path, { contentType: req.file.mimetype });
      url = `/api/assets/gallery/${filename}`;
      await fs.remove(req.file.path).catch(() => {});
    }

    const { category } = req.body;

    const newItem = new Media({
      title,
      type: type || 'image',
      url,
      category: category || 'gallery'
    });

    await newItem.save();
    res.json(newItem);
  } catch (err) {
    if (req.file?.path) {
      await fs.remove(req.file.path).catch(() => {});
    }
    console.error('Media upload error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/media/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ msg: 'Database unavailable' });
    }

    await Media.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Item deleted' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
