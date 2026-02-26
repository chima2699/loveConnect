const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  users: [String],
  messages: [
    {
      from: String,
      text: String,
      reaction: { type: String, default: "" },
      delivered: { type: Boolean, default: false },
      seen: { type: Boolean, default: false },
      ts: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('Chat', ChatSchema);
