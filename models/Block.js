const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  blocker: String,
  target: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Block', BlockSchema);
