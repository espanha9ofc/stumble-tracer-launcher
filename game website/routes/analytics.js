const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const Session = require('../models/Session');
const PlatformStats = require('../models/PlatformStats');
const auth = require('../middleware/auth');
const { isDbReady } = require('../config/gridfs');

// @route   GET api/analytics
// @desc    Get comprehensive stats (Admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.json({
        totalPlayers: 0,
        totalHours: 0,
        dap: 0,
        devices: [],
        history: []
      });
    }

    const totalPlayers = await Player.countDocuments();
    
    // Global Playtime
    const allPlayers = await Player.find();
    const totalSeconds = allPlayers.reduce((acc, p) => acc + (p.totalPlayTime || 0), 0);
    const totalHours = Math.round(totalSeconds / 3600);

    // DAP (Active in last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dap = await Player.countDocuments({ lastSeen: { $gte: twentyFourHoursAgo } });

    // Historical Stats (Last 30 entries)
    const history = await PlatformStats.find().sort({ date: -1 }).limit(30);

    res.json({
      totalPlayers,
      totalHours,
      dap,
      devices: allPlayers.sort((a,b) => b.totalPlayTime - a.totalPlayTime).slice(0, 20),
      history: history.reverse()
    });
  } catch (err) {
    console.error('Analytics Error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
