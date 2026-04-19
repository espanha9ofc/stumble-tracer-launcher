const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  excerpt: { type: String, default: '' },
  content: { type: String, required: true },
  category: { type: String, enum: ['news', 'patch_notes', 'event'], default: 'news' },
  isPinned: { type: Boolean, default: false },
  image: { type: String }, // Optional image URL
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('News', NewsSchema);
