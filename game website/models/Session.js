const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  hwid: {
    type: String,
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // In seconds
    default: 0
  }
});

module.exports = mongoose.model('Session', SessionSchema);
