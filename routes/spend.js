// routes/spend.js
const express = require("express");
const router = express.Router();

const Config = require("../models/Config");
const Transaction = require("../models/Transaction");
const { splitCoins } = require("../utils/coinSplit");
const spendCoinsMongo = require("../utils/spendCoinsMongo");

router.post("/spend/call", requireAuth, async (req, res) => {
  const { type, seconds } = req.body;
  const username = req.user.username;

  // 🔒 validation
  if (!["voice", "video"].includes(type)) {
    return res.status(400).json({ error: "Invalid call type" });
  }

  const cfg = await Config.findOne({ isActive: true });
  if (!cfg) return res.status(500).json({ error: "Pricing not available" });

  // ✅ PLACE THIS BLOCK HERE 👇
  const rate =
    type === "voice"
      ? cfg.usagePrices.voice
      : cfg.usagePrices.video;

  const totalCoins = Math.ceil(seconds) * rate;

  const { adminCoins, userCoins } = splitCoins({
    amount: totalCoins,
    adminPercent:
      type === "voice"
        ? cfg.adminPercents.voiceCall
        : cfg.adminPercents.videoCall
  });

  // spend coins
  const spend = await spendCoinsMongo(username, totalCoins);
  if (!spend.ok) {
    return res.status(400).json({ error: "Insufficient coins" });
  }

  // 🧾 TRANSACTION LOG (GOES HERE)
  await Transaction.create({
    username,
    type: "call_charge",
    amount: totalCoins,
    adminCut: adminCoins,
    userCut: userCoins,
    reference: `${type}_call`,
    meta: {
      seconds,
      rate,
      adminPercent:
        type === "voice"
          ? cfg.adminPercents.voiceCall
          : cfg.adminPercents.videoCall
    }
  });

  res.json({ ok: true });
});

router.post("/spend/message", requireAuth, async (req, res) => {
  const { message, to } = req.body;
  const username = req.user.username;

  const cfg = await Config.findOne({ isActive: true });

  // ✅ PLACE THIS BLOCK HERE 👇
  const letters = message.length;
  const totalCoins = letters * cfg.usagePrices.message;

  const { adminCoins, userCoins } = splitCoins({
    amount: totalCoins,
    adminPercent: cfg.adminPercents.message
  });

  // spend coins
  const spend = await spendCoinsMongo(username, totalCoins);
  if (!spend.ok) return res.status(400).json({ error: "No balance" });

  await Transaction.create({
    username,
    type: "message_charge",
    amount: totalCoins,
    adminCut: adminCoins,
    userCut: userCoins,
    reference: "message"
  });

  res.json({ ok: true });
});

router.post("/spend/unlock-post", requireAuth, async (req, res) => {
  const { postId } = req.body;
  const username = req.user.username;

  const post = await Post.findById(postId);
  const cfg = await Config.findOne({ isActive: true });

  // ✅ PLACE THIS BLOCK HERE 👇
  const totalCoins = post.unlockPrice;

  const { adminCoins, userCoins } = splitCoins({
    amount: totalCoins,
    adminPercent: cfg.adminPercents.lockedPost
  });

  const spend = await spendCoinsMongo(username, totalCoins);
  if (!spend.ok) return res.status(400).json({ error: "Insufficient coins" });

  // credit creator with userCoins

  await Transaction.create({
    username,
    type: "unlock_post",
    amount: totalCoins,
    adminCut: adminCoins,
    userCut: userCoins,
    reference: postId
  });

  res.json({ ok: true });
});

module.exports = router;