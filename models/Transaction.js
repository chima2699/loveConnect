const mongoose = require("mongoose");
const { Schema } = mongoose;

const TransactionSchema = new Schema(
  {
    /* =====================
       👤 WHO
    ====================== */
    username: {
      type: String,
      required: true,
      index: true
    },

    /* =====================
       🔁 TYPE (WHAT HAPPENED)
    ====================== */
    type: {
      type: String,
      enum: [
        // Purchases
        "purchase",

        // Transfers / Gifts
        "transfer_in",
        "transfer_out",
        "gift_sent",
        "gift_received",

        // Spending
        "message",
        "voice_call",
        "video_call",
        "spend",

        // Withdrawals
        "withdrawal",

        // Bonuses
        "bonus"
      ],
      required: true,
      index: true
    },

    /* =====================
       🪙 COINS (Wallet Actions)
       Positive = gain
       Negative = deduction
    ====================== */
    coins: {
      type: Number,
      default: 0
    },

    /* =====================
       💰 MONEY VALUE (Naira etc.)
       Used for Paystack or Withdrawals
    ====================== */
    amount: {
      type: Number,
      default: 0
    },

    /* =====================
       📊 BALANCE SNAPSHOT
       Prevents future disputes
    ====================== */
    balanceBefore: {
      type: Number
    },

    balanceAfter: {
      type: Number
    },

    /* =====================
       🔗 REFERENCE
       Could be:
       - Payment reference
       - Other username
       - Withdrawal ID
    ====================== */
    reference: {
      type: String,
      index: true
    },

    /* =====================
       🧠 EXTRA DATA (Future Safe)
    ====================== */
    meta: {
      type: Schema.Types.Mixed
    },

    /* =====================
       ✅ STATUS
    ====================== */
    status: {
      type: String,
      enum: ["success", "pending", "failed"],
      default: "success",
      index: true
    }
  },
  {
    timestamps: true,   // createdAt & updatedAt
    versionKey: false
  }
);

module.exports = mongoose.model("Transaction", TransactionSchema);