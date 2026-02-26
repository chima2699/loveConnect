// models/Config.js
const mongoose = require("mongoose");

const ConfigSchema = new mongoose.Schema(
  {
    /* ======================
       STATUS CONTROL
    ====================== */
    isActive: {
      type: Boolean,
      default: false,
      index: true
    },

    /* ======================
       COIN ECONOMY (BUYING)
       ₦ → COIN
    ====================== */

    // 🔴 OLD (KEEP – backward compatibility)
    coinValue: {
      nairaPerCoin: {
        type: Number,
        default: 1
      }
    },

    // 🟢 NEW (PRIMARY – use everywhere going forward)
    coinPrice: {
      type: Number,
      min: 0.01,
      default: 1
    },

    /* ======================
       WITHDRAWAL RULES
    ====================== */

    // 🔴 OLD (KEEP)
    withdrawal: {
      minCoins: {
        type: Number,
        default: 100
      },
      maxCoins: {
        type: Number,
        default: 50000
      },
      feePercent: {
        type: Number,
        default: 5
      },
      phoneVerified: {
        type: Boolean,
        default: true
      }
    },

    // 🟢 NEW (PRIMARY)
    withdrawalFeePercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 5
    },

    /* ======================
       POST & UNLOCK REVENUE
    ====================== */

    // 🔴 OLD (KEEP)
    lockedPostFeePercent: {
      type: Number,
      default: 20
    },

    // 🟢 NEW (PRIMARY)
    adminPercents: {
      lockedPost: {
        type: Number,
        min: 0,
        max: 100,
        default: 20
      },
      voiceCall: {
        type: Number,
        min: 0,
        max: 100,
        default: 25
      },
      videoCall: {
        type: Number,
        min: 0,
        max: 100,
        default: 25
      },
      message: {
        type: Number,
        min: 0,
        max: 100,
        default: 40
      }
    },

    /* ======================
       USAGE PRICING (COINS)
    ====================== */

    // 🔴 OLD (KEEP – legacy code)
    usage: {
      picturePost: { type: Number, default: 0 },
      videoPost: { type: Number, default: 0 },
      voiceCallPerSecond: { type: Number, default: 0 },
      videoCallPerSecond: { type: Number, default: 0 },
      coinPerLetter: { type: Number, default: 0 }
    },

    // 🔴 OLD (KEEP)
    calls: {
      voicePerSecond: { type: Number, default: 0 },
      videoPerSecond: { type: Number, default: 0 }
    },

    // 🔴 OLD (KEEP)
    messages: {
      pricePerLetter: { type: Number, default: 0 }
    },

    // 🟢 NEW (PRIMARY – unified pricing)
    usagePrices: {
      message: { type: Number, min: 0, default: 1 },
      voice: { type: Number, min: 0, default: 2 },
      video: { type: Number, min: 0, default: 3 },
      picturePost: { type: Number, min: 0, default: 0 },
      videoPost: { type: Number, min: 0, default: 0 }
    },

    /* ======================
       BONUS SYSTEM
    ====================== */

    // 🔴 OLD (KEEP)
    bonus: {
      newUser: { type: Number, default: 0 },
      dailyLogin: { type: Number, default: 0 }
    },

    // 🟢 NEW (PRIMARY)
    bonusRules: {
      newUser: { type: Number, min: 0, default: 0 },
      dailyLogin: { type: Number, min: 0, default: 0 }
    },

    /* ======================
       ADMIN METADATA
    ====================== */
    updatedBy: {
      type: String,
      default: "system"
    },

    reason: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/* ======================
   SAFETY: ONLY ONE ACTIVE
====================== */

module.exports = mongoose.model("Config", ConfigSchema);