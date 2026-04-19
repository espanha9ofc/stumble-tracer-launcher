const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  hwid: {
    type: String,
    required: true,
    unique: true
  },
  totalPlayTime: {
    type: Number, // In seconds
    default: 0
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Analytics', AnalyticsSchema);
