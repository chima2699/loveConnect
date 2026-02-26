const mongoose = require('mongoose');

const FollowSchema = new mongoose.Schema({
  follower: String,
  followee: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Follow', FollowSchema);
