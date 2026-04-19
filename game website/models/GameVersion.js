const mongoose = require('mongoose');

const GameVersionSchema = new mongoose.Schema({
  version: { type: String, required: true },
  type: { type: String, enum: ['game', 'dll'], required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
  changelog: { type: String, default: '' },
  isMandatory: { type: Boolean, default: false }
});

module.exports = mongoose.model('GameVersion', GameVersionSchema);
