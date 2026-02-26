// routes/calls.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const requireWalletAccess = require("../middleware/requireWalletAccess");

const Config = require("../models/Config");
const Transaction = require("../models/Transaction");
const { spendCoinsMongo } = require("../utils/spendCoins");
const { getActiveConfig } = require("../utils/configCache");

const config = await getActiveConfig();
/*
  POST /api/call/charge

  body:
  {
    type: "voice" | "video",
    seconds: Number,
    peer: String
  }
*/
router.post(
  "/call/charge",
  requireAuth,
  async (req, res) => {
    try {
      const { type, seconds, peer } = req.body;
      const username = req.user.username;

      const duration = Number(seconds);
      if (!type || !duration || duration <= 0) {
        return res.status(400).json({ error: "Invalid call duration" });
      }

      // ======================
      // LOAD ACTIVE CONFIG
      // ======================
      const config = await Config.findOne({ isActive: true });
      if (!config) {
        return res.status(500).json({ error: "Pricing not configured" });
      }

      // ======================
      // PRICE RESOLUTION (NO MISMATCH)
      // ======================
      const usageVoice =
        config.calls?.voicePerSecond ??
        config.usage?.voiceCallPerSecond ??
        0;

      const usageVideo =
        config.calls?.videoPerSecond ??
        config.usage?.videoCallPerSecond ??
        0;

      let pricePerSecond = 0;
      if (type === "voice") pricePerSecond = usageVoice;
      if (type === "video") pricePerSecond = usageVideo;

      const cost = Math.ceil(duration * pricePerSecond);

      // ======================
      // CHARGE USER (MONGO WALLET)
      // ======================
      if (cost > 0) {
        const charge = await spendCoinsMongo(username, cost);
        if (!charge?.ok) {
          return res.status(400).json({ error: "Not enough coins" });
        }
      }

      // ======================
      // TRANSACTION LOG
      // ======================
      await Transaction.create({
        username,
        type: "usage",
        amount: -cost,
        reference: `${type}_call`,
        meta: {
          peer,
          seconds: duration,
          rate: pricePerSecond
        }
      });

      // ======================
      // REALTIME BALANCE UPDATE
      // ======================
      if (req.io) {
        req.io.emit("balance_update", { username });
      }

      res.json({
        ok: true,
        charged: cost,
        seconds: duration,
        rate: pricePerSecond,
        type
      });

    } catch (err) {
      console.error("CALL CHARGE ERROR:", err);
      res.status(500).json({ error: "Call charge failed" });
    }
  }
);

module.exports = router;