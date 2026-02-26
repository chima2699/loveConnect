// routes/messages.js
const express = require('express');
const { messagesFile } = require('../config/paths');
const { loadJson } = require('../utils/jsonDb');

const router = express.Router();

// chat history
router.get('/messages/history', (req, res) => {
  const { user1, user2 } = req.query;
  const msgs = loadJson(messagesFile).filter(m =>
    (m.from === user1 && m.to === user2) ||
    (m.from === user2 && m.to === user1)
  );
  res.json(msgs);
});

module.exports = router;
