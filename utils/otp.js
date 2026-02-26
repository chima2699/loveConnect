// utils/otp.js
const crypto = require("crypto");

exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.hashOTP = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};