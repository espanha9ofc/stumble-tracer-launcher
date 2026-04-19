const mongoose = require('mongoose');

const PlatformStatsSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now, index: true },
  peakOnline: { type: Number, default: 0 },
  dailyActivePlayers: { type: Number, default: 0 },
  newPlayers: { type: Number, default: 0 },
  totalSessions: { type: Number, default: 0 },
  totalPlayTime: { type: Number, default: 0 }
});

module.exports = mongoose.model('PlatformStats', PlatformStatsSchema);
