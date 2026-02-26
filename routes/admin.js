// routes/admin.js — FULL MONGODB VERSION

const express = require("express");
const requireAdminToken = require("../middlewares/requireAdminToken");

const User = require("../models/User");
const Post = require("../models/Post");
const Transaction = require("../models/Transaction");
const Withdrawal = require("../models/Withdrawal");
const Chat = require("../models/Chat");
const Report = require("../models/Report");
const Config = require("../models/Config");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

/* =====================================================
   CONFIG (PRIMARY PRICING CONTROL)
===================================================== */

router.get("/config", requireAdminToken, async (req, res) => {
  let cfg = await Config.findOne({ isActive: true }).lean();

  if (!cfg) {
    cfg = await Config.create({
      isActive: true,
      coinPrice: 1,
      withdrawal: {
        feePercent: 5,
        minCoins: 0,
        maxCoins: 100000
      },
      transfersEnabled: true,
      salesEnabled: true,
      usage: {
        picturePost: 0,
        videoPost: 0
      },
      calls: {
        voicePerSecond: 2,
        videoPerSecond: 3
      },
      messages: {
        pricePerLetter: 1
      },
      unlock: {
        adminPercent: 20
      },
      bonus: {
        newUser: 0,
        dailyLogin: 0
      }
    });
  }

  res.json(cfg);
});

router.get("/config/public", async (req, res) => {
  const cfg = await Config.findOne({ isActive: true }).lean();
  if (!cfg) return res.json({});

  res.json({
    coinPrice: cfg.coinPrice ?? 1,
    withdrawalFeePercent: cfg.withdrawal?.feePercent ?? 5,
    minWithdrawal: cfg.withdrawal?.minCoins ?? 0,
    withdrawalsEnabled: cfg.withdrawalsEnabled ?? true,
    transfersEnabled: cfg.transfersEnabled ?? true,
    salesEnabled: cfg.salesEnabled ?? true,
    usagePrices: {
      message: cfg.messages?.pricePerLetter ?? 1,
      voice: cfg.calls?.voicePerSecond ?? 2,
      video: cfg.calls?.videoPerSecond ?? 3,
      picturePost: cfg.usage?.picturePost ?? 0,
      videoPost: cfg.usage?.videoPost ?? 0
    },
    adminPercents: {
      lockedPost: cfg.unlock?.adminPercent ?? 20,
      voiceCall: 25,
      videoCall: 25,
      message: 40
    },
    bonusRules: cfg.bonus ?? {}
  });
});

router.post("/config", requireAdminToken, async (req, res) => {
  try {
    let config = await Config.findOne({ isActive: true });

    if (!config) {
      config = new Config({ isActive: true });
    }

    /* ================= CORE ================= */

    if (req.body.coinPrice !== undefined) {
      config.coinPrice = Number(req.body.coinPrice) || 0;
    }

    if (req.body.withdrawalFeePercent !== undefined) {
      config.withdrawal = config.withdrawal || {};
      config.withdrawal.feePercent = Number(req.body.withdrawalFeePercent) || 0;
    }

    /* ================= USAGE ================= */

    if (req.body.usagePrices) {
      config.calls = config.calls || {};
      config.messages = config.messages || {};
      config.usage = config.usage || {};

      config.calls.voicePerSecond =
        Number(req.body.usagePrices.voice) || config.calls.voicePerSecond || 0;

      config.calls.videoPerSecond =
        Number(req.body.usagePrices.video) || config.calls.videoPerSecond || 0;

      config.messages.pricePerLetter =
        Number(req.body.usagePrices.message) || config.messages.pricePerLetter || 0;

      config.usage.picturePost =
        Number(req.body.usagePrices.picturePost) || config.usage.picturePost || 0;

      config.usage.videoPost =
        Number(req.body.usagePrices.videoPost) || config.usage.videoPost || 0;
    }

    /* ================= ADMIN PERCENT ================= */

    if (req.body.adminPercents) {
      config.unlock = config.unlock || {};

      /* ================= ADMIN PERCENTS ================= */

config.unlock = {
  adminPercent: Number(
    req.body.adminPercents?.lockedPost ??
    config.unlock?.adminPercent ??
    20
  )
};

config.calls = {
  ...config.calls,
  adminVoicePercent: Number(
    req.body.adminPercents?.voiceCall ??
    config.calls?.adminVoicePercent ??
    0
  ),
  adminVideoPercent: Number(
    req.body.adminPercents?.videoCall ??
    config.calls?.adminVideoPercent ??
    0
  )
};

config.messages = {
  ...config.messages,
  adminMessagePercent: Number(
    req.body.adminPercents?.message ??
    config.messages?.adminMessagePercent ??
    0
  )
};
    }

    /* ================= BONUS ================= */

    if (req.body.bonusRules) {
      config.bonus = config.bonus || {};

      config.bonus.newUser =
        Number(req.body.bonusRules.newUser) || config.bonus.newUser || 0;

      config.bonus.dailyLogin =
        Number(req.body.bonusRules.dailyLogin) || config.bonus.dailyLogin || 0;
    }

    /* ================= SAVE ================= */

    // 🔴 deactivate ALL old configs first
await Config.updateMany(
  { isActive: true },
  { $set: { isActive: false } }
);

// 🟢 make this one active
config.isActive = true;
await config.save();

    /* ================= SOCKET SAFE ================= */

    if (req.io) {
      req.io.emit("pricing:update", {
        coinPrice: config.coinPrice,
        voicePerSecond: config.calls?.voicePerSecond || 0,
        videoPerSecond: config.calls?.videoPerSecond || 0,
        messagePerLetter: config.messages?.pricePerLetter || 0
      });
    }

    /* ================= SUCCESS ================= */

    res.json({
      success: true,
      message: "Config saved successfully",
      config
    });

  } catch (err) {
    console.error("ADMIN CONFIG ERROR:", err);
    res.status(500).json({ error: "Config update failed" });
  }
});


/* =====================================================
   DASHBOARD OVERVIEW
===================================================== */

router.get("/overview", requireAdminToken, async (req, res) => {
  const users = await User.countDocuments();

  const revenueAgg = await Transaction.aggregate([
    { $match: { type: "purchase" } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  const coinsSoldAgg = await Transaction.aggregate([
  { $match: { type: "purchase" } },
  { $group: { _id: null, total: { $sum: "$amount" } } }
]);


  const withdrawalAgg = await Withdrawal.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: null, total: { $sum: "$payoutCoins" }
 } }
  ]);

  res.json({
    revenue: revenueAgg[0]?.total || 0,
    coinsSold: coinsSoldAgg[0]?.total || 0,
    withdrawals: withdrawalAgg[0]?.total || 0,
    users
  });
});

/* =====================================================
   USERS
===================================================== */
router.get("/users/all", requireAdminToken, async (req,res)=>{
 const users = await User.find({}, "username").lean();
 res.json(users);
});

router.get("/users", requireAdminToken, async (req, res) => {
  const users = await User.find({}, "-password").lean();
  res.json(users);
});

router.post("/user-status", requireAdminToken, async (req, res) => {
  const { username, action, suspendUntil } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (action === "ban") user.isBanned = true;
if (action === "unban") user.isBanned = false;

if (action === "suspend") user.isSuspended = true;
if (action === "unsuspend") user.isSuspended = false;

if (action === "suspend") user.suspendedUntil = suspendUntil;
if (action === "unsuspend") user.suspendedUntil = null;


  await user.save();
  res.json({ success: true });
});

router.post("/grant-bonus", requireAdminToken, async (req, res) => {
  const { username, amount } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  user.bonusCoins += Number(amount);
  await user.save();

  req.io?.to(username).emit("wallet_update", { username });

  res.json({ success: true });
});

/* =====================================================
   TRANSACTIONS
===================================================== */

router.get("/transactions", requireAdminToken, async (req, res) => {
  const limit = Number(req.query.limit) || 50;

  const transactions = await Transaction.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ transactions });
});

/* =====================================================
   WITHDRAWALS
===================================================== */

router.post("/withdrawals/update", requireAdminToken, async (req, res) => {
  const { id, status } = req.body;

  const w = await Withdrawal.findById(id);
  if (!w) return res.status(404).json({ error: "Not found" });

  w.status = status;
  await w.save();

if (status === "rejected") {
  const user = await User.findOne({ username: w.username });
  if (user) {
    user.purchasedCoins += w.requestedCoins;
    await user.save();
  }
}


  res.json({ success: true });
});

/* =====================================================
   ANALYTICS
===================================================== */

router.get("/analytics/calls", requireAdminToken, async (req, res) => {
  const callTxs = await Transaction.find({
   type: { $in: ["VOICE_CALL", "VIDEO_CALL"] }

  }).lean();

  const totalSeconds = callTxs.reduce((s, t) => s + (t.meta?.seconds || 0), 0);
  const adminRevenue = callTxs.reduce((s, t) => s + (t.meta?.adminCut || 0), 0);
  const creatorRevenue = callTxs.reduce((s, t) => s + (t.meta?.creatorCut || 0), 0);

  res.json({ totalSeconds, adminRevenue, creatorRevenue });
});

router.get("/analytics/locked-posts", requireAdminToken, async (req, res) => {
  const lockedTxs = await Transaction.find({
    reference: "post_unlock"
  }).lean();

  const totalRevenue = lockedTxs.reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  const adminEarningsAgg = await Transaction.aggregate([
    { $match: { reference: "post_unlock_fee" } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  res.json({
    totalRevenue,
    adminEarnings: adminEarningsAgg[0]?.total || 0
  });
});

module.exports = router;
