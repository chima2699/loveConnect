const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  from: String,
  to: String,
  liked: Boolean,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Like', LikeSchema);
