const mongoose = require("mongoose");

const WithdrawalSchema = new mongoose.Schema(
  {
    /* ================= CORE ================= */
    username: {
      type: String,
      required: true,
      index: true
    },

    /* ================= COINS & VALUE ================= */
    coins: {
      type: Number,
      required: true
    },

    amount: {
      type: Number,
      required: true
      // Amount in NAIRA (or base currency)
    },

    fee: {
      type: Number,
      default: 0
      // Fee in NAIRA
    },

    netAmount: {
      type: Number,
      required: true
      // amount - fee
    },

    /* ================= BANK DETAILS ================= */
    bank: {
      accountName: String,
      accountNumber: String,
      bankCode: String,
      bankName: String
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
      index: true
    },

    /* ================= ADMIN / AUDIT ================= */
    adminNote: String,

    processedBy: {
      type: String // admin username or id
    },

    processedAt: Date,

    /* ================= PAYOUT (FUTURE) ================= */
    payout: {
      provider: {
        type: String,
        enum: ["paystack", "flutterwave", "manual"],
        default: "manual"
      },

      transferCode: String,
      reference: String,
      paidAt: Date
    }
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: false
  }
);

module.exports = mongoose.model("Withdrawal", WithdrawalSchema);
