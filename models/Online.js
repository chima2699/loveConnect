const mongoose = require('mongoose');

const OnlineSchema = new mongoose.Schema({
  username: String,
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Online', OnlineSchema);
