const mongoose = require('mongoose');

const GlobalConfigSchema = new mongoose.Schema({
  serverStatus: { type: String, enum: ['online', 'offline', 'maintenance'], default: 'online' },
  noticeText: { type: String, default: 'Welcome to Stumble Tracer!' },
  discordUrl: { type: String, default: '#' },
  youtubeUrl: { type: String, default: '#' },
  facebookUrl: { type: String, default: '#' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GlobalConfig', GlobalConfigSchema);
