// routes/wallet.js  (MONGODB VERSION)

const express = require("express");
const requireAuth = require("../middlewares/requireAuth");

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Withdrawal = require("../models/Withdrawal");
const Config = require("../models/Config");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

/* =====================================================
   GET WALLET BALANCE
===================================================== */
router.get("/balance", requireAuth, async (req, res) => {
  try {
    const user = await User.findOne(
      { username: req.user.username },
      "bonusCoins purchasedCoins"
    ).lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const bonus = user.bonusCoins || 0;
    const purchased = user.purchasedCoins || 0;

    res.json({
      bonus,
      purchased,
      total: bonus + purchased
    });

  } catch (err) {
    console.error("Balance error:", err);
    res.status(500).json({ error: "Failed to load balance" });
  }
});

// BUY COINS
router.post("/buy-coins", requireAuth, async (req, res) => {
  try {
    const { coins } = req.body;
    const username = req.user.username;

    if (!coins || coins <= 0) {
      return res.status(400).js
      on({ error: "Invalid coin amount" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    

    // ==============================
    // GET USER
    // ==============================
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });

    // ==============================
    // GET ACTIVE CONFIG
    // ==============================
    const config = await Config.findOne({ isActive: true });
    if (!config) {
      return res.status(500).json({ error: "Config not found" });
    }

    if (!config.salesEnabled) {
      return res.status(400).json({ error: "Coin sales disabled by admin" });
    }

    const coinPrice = config.coinPrice || 1;
const expectedAmount = coins * coinPrice;
if (!expectedAmount || expectedAmount <= 0) {
  return res.status(400).json({ error: "Invalid payment amount" });
}
    // ==============================
    // ADD COINS TO USER
    // ==============================
    user.purchasedCoins = (user.purchasedCoins || 0) + Number(coins);
    await user.save();

    // ==============================
    // CREATE TRANSACTION RECORD
    // ==============================
    await Transaction.create({
      username,
      type: "purchase",
      coins: Number(coins),
      amount: Number(amount),
      status: "completed",
      reference: "coin_purchase",
      meta: {
        method: "manual", // change to paystack if needed
        adminRevenue: Number(amount)
      },
      createdAt: new Date()
    });

    // ==============================
    // SOCKET LIVE UPDATE
    // ==============================
    req.io?.emit("wallet_update", { username });
    req.io?.emit("admin:dashboard_update");

    // ==============================
    // AUDIT LOG
    // ==============================
    await AuditLog.create({
  admin: "system",
  action: "USER_PURCHASE",
  details: { username, coins, amount: expectedAmount },
  time: new Date()
});

    res.json({
      success: true,
      message: "Coins purchased successfully",
      newBalance: user.purchasedCoins + (user.bonusCoins || 0)
    });

  } catch (err) {
    console.error("Buy coins error:", err);
    res.status(500).json({ error: "Failed to buy coins" });
  }
});


/* =====================================================
   GET USER TRANSACTIONS
===================================================== */
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      username: req.user.username
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ transactions });

  } catch (err) {
    console.error("Transactions error:", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

/* =====================================================
   TRANSFER COINS
===================================================== */
router.post("/coins/gift", requireAuth, async (req, res) => {
  try {
    const from = req.user.username;
    const { to, amount } = req.body;

    const coins = Number(amount);
    if (!to || !coins || coins <= 0)
      return res.status(400).json({ error: "Invalid transfer" });

    if (to === from)
      return res.status(400).json({ error: "Cannot send to yourself" });

    const config = await Config.findOne({ isActive: true }).lean();
    if (config?.transfersEnabled === false)
      return res.status(403).json({ error: "Transfers disabled by admin" });

    const sender = await User.findOne({ username: from });
    const receiver = await User.findOne({ username: to });

    if (!sender || !receiver)
      return res.status(404).json({ error: "User not found" });

    if ((sender.purchasedCoins || 0) < coins)
      return res.status(400).json({ error: "Insufficient purchased coins" });

    // Atomic updates
    sender.purchasedCoins -= coins;
    receiver.purchasedCoins += coins;

    await sender.save();
    await receiver.save();

    await Transaction.create([
      {
        username: from,
        type: "TRANSFER_OUT",
        amount: -coins,
        reference: `Sent to ${to}`
      },
      {
        username: to,
        type: "TRANSFER_IN",
        amount: coins,
        reference: `Received from ${from}`
      }
    ]);

    req.io.to(from).emit("wallet_update", { username: from });
    req.io.to(to).emit("wallet_update", { username: to });

    res.json({ ok: true, message: "Transfer completed" });

  } catch (err) {
    console.error("Transfer error:", err);
    res.status(500).json({ error: "Transfer failed" });
  }
});

/* =====================================================
   WITHDRAW REQUEST
===================================================== */
router.post("/withdraw/request", requireAuth, async (req, res) => {
  try {
    const username = req.user.username;
    const coins = Number(req.body.coins);

    if (!Number.isFinite(coins) || coins <= 0)
      return res.status(400).json({ error: "Invalid amount" });

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });

    if ((user.purchasedCoins || 0) < coins)
      return res.status(400).json({ error: "Insufficient purchased coins" });

    const config = await Config.findOne({ isActive: true }).lean();
    if (!config) return res.status(400).json({ error: "Config missing" });

    const feePercent = config.withdrawal?.feePercent ?? 5;
    const minCoins = config.withdrawal?.minCoins ?? 0;

    if (coins < minCoins)
      return res.status(400).json({
        error: `Minimum withdrawal is ${minCoins} coins`
      });

    const feeCoins = Math.floor((coins * feePercent) / 100);
    const payoutCoins = coins - feeCoins;

    if (payoutCoins <= 0)
      return res.status(400).json({
        error: "Withdrawal too small after fees"
      });

    // Deduct balance
    user.purchasedCoins -= coins;
    await user.save();

    await Withdrawal.create({
      username,
      requestedCoins: coins,
      feeCoins,
      payoutCoins,
      status: "requested"
    });

    await Transaction.create({
      username,
      type: "WITHDRAW_REQUEST",
      amount: -coins,
      reference: "withdraw"
    });

    req.io.to(username).emit("wallet_update", { username });

    res.json({
      ok: true,
      message: "Withdrawal requested",
      payoutCoins,
      feeCoins
    });

  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ error: "Withdrawal failed" });
  }
});

module.exports = router;
