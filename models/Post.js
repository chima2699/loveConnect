const mongoose = require("mongoose");

/* ======================
   💬 REPLIES
====================== */
const ReplySchema = new mongoose.Schema({
  from: { type: String, required: true },   // backward compatible
  username: { type: String },               // new format support
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  ts: { type: Date, default: Date.now }     // backward compatible
});

/* ======================
   💬 COMMENTS
====================== */
const CommentSchema = new mongoose.Schema({
  _id: { type: String },                    // allow custom IDs
  from: { type: String },                   // old format
  username: { type: String },               // new format
  text: { type: String, required: true },
  replies: [ReplySchema],
  createdAt: { type: Date, default: Date.now },
  ts: { type: Date, default: Date.now }     // old format
});

/* ======================
   📝 POST
====================== */
const PostSchema = new mongoose.Schema(
  {
    // 👤 Owner
    username: {
      type: String,
      required: true,
      index: true
    },

    // 📝 Content
    content: {
      type: String,
      default: ""
    },

    // 🖼️ MEDIA (BACKWARD + NEW)
    image: {
      type: String,          // OLD FIELD (DO NOT REMOVE)
      default: null
    },

    mediaUrl: {
      type: String,
      default: null
    },

    mediaType: {
      type: String,
      enum: ["photo", "video", null],
      default: null
    },

    // 🔒 LOCK SYSTEM
    locked: {
      type: Boolean,
      default: false
    },

    lockPrice: {
      type: Number,
      default: 0
    },

    unlocks: {
      type: [String],        // usernames who unlocked
      default: []
    },

    // ❤️ LIKES
    likes: {
      type: [String],        // usernames
      default: []
    },

    // 💬 COMMENTS
    comments: {
      type: [CommentSchema],
      default: []
    }
  },
  {
    timestamps: true // createdAt & updatedAt automatically
  }
);

module.exports = mongoose.model("Post", PostSchema);