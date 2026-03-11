// routes/posts.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const requireAuth = require("../middlewares/requireAuth");
const requireWalletAccess = require("../middlewares/requireWalletAccess");

const Config = require("../models/Config");
const Post = require("../models/Post");
const { spendCoinsMongo, creditCoinsMongo } = require("../utils/spendCoins");

/* ======================================================
   MULTER (IMAGE + VIDEO)
====================================================== */
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "loveconnect_posts",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "webm", "mp3"]
  })
});

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "audio/mpeg"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"), false);
    }

    cb(null, true);
  }
});
/* ======================================================
   🔥 LOAD POSTS (LOCKED + UNLOCKED)  ✅ FIX
====================================================== */
router.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      posts.map(p => ({
        _id: p._id,
        username: p.username,
        content: p.content,

        mediaUrl: p.mediaUrl || null,
        mediaType: p.mediaType || null,

        locked: !!p.locked,
        lockPrice: p.lockPrice || 0,
        unlocks: p.unlocks || [],

        likes: p.likes || [],
        comments: p.comments || [],
        createdAt: p.createdAt
      }))
    );
  } catch (err) {
    console.error("Posts load error:", err);
    res.status(500).json([]);
  }
});

/* ======================================================
   CREATE POST (IMAGE / VIDEO / LOCKED / PRICING)
====================================================== */
router.post( "/create", requireAuth, upload.single("media"),
  async (req, res) => {
    try {
      if (!req.user?.username) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { content, locked, lockPrice } = req.body;
      const username = req.user.username;

      let mediaType = null;
      let mediaUrl = null;

      if (req.file) {
        const isVideo = req.file.mimetype.startsWith("video/");
        mediaType = isVideo ? "video" : "photo";
        mediaUrl = req.file.path;
      }

      const config = await Config.findOne({ isActive: true });

      const usage = {
        picturePost: Number(config?.usage?.picturePost ?? 0),
        videoPost: Number(config?.usage?.videoPost ?? 0)
      };

      let postCost = 0;
      if (mediaType === "video") postCost = usage.videoPost;
      if (mediaType === "photo") postCost = usage.picturePost;

      if (postCost > 0) {
        const charge = await spendCoinsMongo(username, postCost);
        if (!charge?.ok) {
          return res.status(400).json({ error: "Not enough coins" });
        }
      }

      const post = await Post.create({
        username,
        content: content || "",
        mediaType,
        mediaUrl,
        locked: locked === true || locked === "true",
        lockPrice: Number(lockPrice || 0),
        likes: [],
        comments: [],
        unlocks: []
      });

      res.json({ ok: true, post });
    } catch (err) {
      console.error("🔥 CREATE POST ERROR:", err);
      res.status(500).json({ error: "Post failed" });
    }
  }
);

router.post("/unlock/:postId", requireAuth, async (req, res) => {
  const username = req.user.username;
  const post = await Post.findById(req.params.postId);

  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!post.locked) return res.json({ ok: true });

  if (post.unlocks.includes(username)) {
    return res.json({ ok: true });
  }

  const price = Number(post.lockPrice || 0);
  if (price <= 0) {
    return res.status(400).json({ error: "Invalid unlock price" });
  }

  const charge = await spendCoinsMongo(username, price);
  if (!charge.ok) {
    return res.status(400).json({ error: "Not enough coins" });
  }

  post.unlocks.push(username);
  await post.save();

  res.json({ ok: true });
});

/* ======================================================
   LIKE / UNLIKE POST
====================================================== */
router.post("/like", requireAuth, async (req, res) => {
  const { postId } = req.body;
  const username = req.user.username;

  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const index = post.likes.indexOf(username);
  let liked;

  if (index >= 0) {
    post.likes.splice(index, 1);
    liked = false;
  } else {
    post.likes.push(username);
    liked = true;
  }

  await post.save();

  req.io?.emit("post_liked", {
    postId,
    username,
    liked,
    likesCount: post.likes.length
  });

  res.json({ liked, likesCount: post.likes.length });
});

/* ======================================================
   COMMENT
====================================================== */
router.post("/comment", requireAuth, async (req, res) => {
  const { postId, text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Empty comment" });

  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const comment = {
    _id: Date.now().toString(),
    username: req.user.username,
    text,
    replies: [],
    createdAt: new Date()
  };

  post.comments.push(comment);
  await post.save();

  req.io?.emit("post_commented", { postId, comment });

  res.json({ ok: true, comment });
});

/* ======================================================
   REPLY TO COMMENT
====================================================== */
router.post("/reply", requireAuth, async (req, res) => {
  const { postId, commentId, text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Empty reply" });

  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const comment = post.comments.find(c => c._id === commentId);
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  comment.replies.push({
  text: req.body.text,
  from: req.user.username,      // ✅ REQUIRED FIELD
  username: req.user.username  // (optional, but matches schema)
});

  await post.save();
  req.io?.emit("comment_replied", { postId, commentId });

  res.json({ ok: true });
});

/* ======================================================
   DELETE POST
====================================================== */
router.delete("/delete", requireAuth, async (req, res) => {
  const { postId } = req.body;
  const post = await Post.findById(postId);

  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.username !== req.user.username) {
    return res.status(403).json({ error: "Not owner" });
  }

  await post.deleteOne();
  req.io?.emit("post_deleted", { postId });

  res.json({ ok: true });
});

module.exports = router;
