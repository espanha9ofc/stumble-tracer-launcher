const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  hwid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: 'avatar1' // We will use IDs for pre-defined avatars
  },
  totalPlayTime: {
    type: Number, // In seconds
    default: 0
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Player', PlayerSchema);
