const express = require('express');
const router = express.Router();
const News = require('../models/News');
const auth = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { isDbReady, uploadBufferToGridFS } = require('../config/gridfs');
const path = require('path');

// @route   GET api/news
// @desc    Get all news (Public for launcher)
router.get('/', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.json([]);
    }

    const news = await News.find().sort({ isPinned: -1, date: -1 });
    res.json(news);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/news
// @desc    Create a news post (Admin only)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ msg: 'Database unavailable' });
    }

    const newsData = { ...req.body };
    
    if (req.file) {
      const filename = `news-${Date.now()}${path.extname(req.file.originalname)}`;
      await uploadBufferToGridFS('news', filename, req.file.buffer, { contentType: req.file.mimetype });
      newsData.image = `/api/assets/news/${filename}`;
    }

    const newPost = new News(newsData);
    await newPost.save();
    res.json(newPost);
  } catch (err) {
    console.error('News creation error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/news/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ msg: 'Database unavailable' });
    }

    await News.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Post deleted' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
