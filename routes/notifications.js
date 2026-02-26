// routes/notifications.js
const express = require('express');
const { notificationsFile } = require('../config/paths');
const { loadJson, saveJson } = require('../utils/jsonDb');

const router = express.Router();

// list notifications
router.get('/notifications', (req, res) => {
  const { username } = req.query;
  const notes = loadJson(notificationsFile).filter(n => n.to === username);
  res.json(notes);
});

// add notification
router.post('/notifications/add', (req, res) => {
  const { to, from, message } = req.body;
  const notes = loadJson(notificationsFile);
  notes.push({
    id: Date.now(),
    to,
    from,
    message,
    timestamp: new Date().toISOString()
  });
  saveJson(notificationsFile, notes);
  res.json({ message: 'Saved' });
});

module.exports = router;
