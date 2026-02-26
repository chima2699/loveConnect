// routes/search_swipe.js
const express = require('express');
const { usersFile, followsFile } = require('../config/paths');
const { loadJson, saveJson } = require('../utils/jsonDb');

const router = express.Router();

// swipe candidates
router.get('/swipe-candidates', (req, res) => {
  const { username } = req.query;
  const users = loadJson(usersFile);
  const me = users.find(u => u.username === username);
  if (!me) return res.status(404).json({ error: 'User not found' });

  const candidates = users.filter(u => u.username !== username && !u.banned);
  res.json(candidates);
});

// simple like + match detection
router.post('/like-user', (req, res) => {
  const { from, to } = req.body;
  const follows = loadJson(followsFile);

  // mark this like as follow (reuse)
  if (!follows.find(f => f.follower === from && f.followee === to)) {
    follows.push({
      follower: from,
      followee: to,
      timestamp: new Date().toISOString()
    });
  }

  // check if they already liked you
  const mutual = follows.find(f => f.follower === to && f.followee === from);
  saveJson(followsFile, follows);

  if (mutual) {
    // It's a match
    req.io.emit('new_match', { user1: from, user2: to });
  }

  res.json({ matched: !!mutual });
});

module.exports = router;
