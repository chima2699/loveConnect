const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  admin: String,
  action: String,
  details: String,
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
