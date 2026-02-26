// routes/follows.js
const express = require('express');
const { followsFile } = require('../config/paths');
const { loadJson, saveJson } = require('../utils/jsonDb');

const router = express.Router();

// list who I follow
router.get('/follows/list', (req, res) => {
  const { username } = req.query;
  const follows = loadJson(followsFile).filter(f => f.follower === username);
  res.json(follows);
});

// all follow relations (for counts)
router.get('/follows/all', (req, res) => {
  const follows = loadJson(followsFile);
  res.json(follows);
});

// toggle follow/unfollow
router.post('/follows/toggle', (req, res) => {
  const { follower, followee } = req.body;
  if (!follower || !followee || follower === followee) {
    return res.status(400).json({ error: 'Invalid follow' });
  }

  let follows = loadJson(followsFile);
  const existing = follows.find(f => f.follower === follower && f.followee === followee);

  let following;
  if (existing) {
    follows = follows.filter(f => !(f.follower === follower && f.followee === followee));
    following = false;
  } else {
    follows.push({
      follower,
      followee,
      timestamp: new Date().toISOString()
    });
    following = true;

    // follow notification
    req.io.emit('follow_notification', {
      to: followee,
      from: follower,
      message: `${follower} started following you`
    });
  }

  saveJson(followsFile, follows);
  res.json({ following });
});

module.exports = router;
