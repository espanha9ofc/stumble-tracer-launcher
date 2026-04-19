const express = require('express');
const router = express.Router();
const GlobalConfig = require('../models/GlobalConfig');
const auth = require('../middleware/auth');
const { isDbReady } = require('../config/gridfs');

// @route   GET api/config
// @desc    Get launcher remote config (public)
router.get('/', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.json({
        serverStatus: 'online',
        noticeText: 'Welcome to Stumble Tracer!',
        discordUrl: '#',
        youtubeUrl: '#',
        facebookUrl: '#'
      });
    }

    let config = await GlobalConfig.findOne();
    if (!config) {
      config = await GlobalConfig.create({
        serverStatus: 'online',
        noticeText: 'Welcome to Stumble Tracer!',
        discordUrl: '#',
        youtubeUrl: '#'
      });
    }
    res.json(config);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST api/config/global
// @desc    Update global config (admin only)
router.post('/global', auth, async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ msg: 'Database unavailable' });
    }

    const { serverStatus, noticeText, discordUrl, youtubeUrl } = req.body;
    let config = await GlobalConfig.findOne();
    
    if (config) {
      config.serverStatus = serverStatus || config.serverStatus;
      config.noticeText = noticeText || config.noticeText;
      config.discordUrl = discordUrl || config.discordUrl;
      config.youtubeUrl = youtubeUrl || config.youtubeUrl;
      config.facebookUrl = req.body.facebookUrl || config.facebookUrl;
      config.updatedAt = Date.now();
    } else {
      config = new GlobalConfig({ 
        serverStatus, 
        noticeText, 
        discordUrl, 
        youtubeUrl, 
        facebookUrl: req.body.facebookUrl 
      });
    }
    
    await config.save();

    // Trigger socket update if app is available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('config:update', config);
      
      // Specifically trigger a "new alert" event for the overlay ticker
      if (noticeText) {
        io.emit('admin:alert', { message: noticeText, timestamp: Date.now() });
      }
    }

    res.json(config);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
