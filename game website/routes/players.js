const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const Session = require('../models/Session');
const { isDbReady } = require('../config/gridfs');

// ═══════════════ INPUT VALIDATION ═══════════════
const HWID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_ ]{2,24}$/;
const AVATAR_REGEX = /^avatar\d{1,2}$|^https?:\/\/.+/i;

function validateHwid(hwid) {
  return typeof hwid === 'string' && HWID_REGEX.test(hwid);
}

function validateUsername(username) {
  return typeof username === 'string' && USERNAME_REGEX.test(username);
}

function validateAvatar(avatar) {
  if (!avatar) return true; // Optional
  return typeof avatar === 'string' && AVATAR_REGEX.test(avatar) && avatar.length <= 256;
}

// @route   POST api/players/register
// @desc    Register or update player profile
router.post('/register', async (req, res) => {
  try {
    const { hwid, username, avatar } = req.body;

    // Input validation
    if (!hwid || !username) return res.status(400).json({ msg: 'Missing identity data' });
    if (!validateHwid(hwid)) return res.status(400).json({ msg: 'Invalid HWID format' });
    if (!validateUsername(username)) return res.status(400).json({ msg: 'Invalid username (2-24 chars, alphanumeric only)' });
    if (!validateAvatar(avatar)) return res.status(400).json({ msg: 'Invalid avatar format' });

    if (!isDbReady()) {
      return res.json({
        hwid,
        username,
        avatar: avatar || 'avatar1',
        totalPlayTime: 0,
        isOnline: false,
        joinedAt: new Date().toISOString()
      });
    }

    let player = await Player.findOne({ hwid });
    if (player) {
      player.username = username;
      if (avatar) player.avatar = avatar;
      player.lastSeen = Date.now();
      await player.save();
    } else {
      player = new Player({ hwid, username, avatar });
      await player.save();
    }

    res.json(player);
  } catch (err) {
    console.error('Player setup error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET api/players/profile/:hwid
// @desc    Get player profile and recent sessions
router.get('/profile/:hwid', async (req, res) => {
  try {
    // Validate HWID format to prevent injection
    if (!validateHwid(req.params.hwid)) {
      return res.status(400).json({ msg: 'Invalid HWID format' });
    }

    if (!isDbReady()) {
      return res.status(503).json({ msg: 'Database unavailable' });
    }

    const player = await Player.findOne({ hwid: req.params.hwid });
    if (!player) return res.status(404).json({ msg: 'Player not found' });

    const sessions = await Session.find({ hwid: req.params.hwid })
      .sort({ startTime: -1 })
      .limit(20);

    res.json({ player, sessions });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET api/players/leaderboard
// @desc    Get Top 10 players by playtime
router.get('/leaderboard', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.json([]);
    }

    const players = await Player.find()
      .sort({ totalPlayTime: -1 })
      .limit(10)
      .select('username avatar totalPlayTime isOnline lastSeen');

    res.json(players);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
