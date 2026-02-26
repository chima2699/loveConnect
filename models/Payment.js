const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  reference: { type: String, unique: true },
  username: { type: String, index: true },
  coins: Number,
  amount: Number, // naira
  channel: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', PaymentSchema);
