const mongoose = require("mongoose");

const CoinGiftSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoinGift", CoinGiftSchema);
