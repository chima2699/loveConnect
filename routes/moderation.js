// routes/moderation.js
const express = require('express');
const { blockedFile, reportsFile } = require('../config/paths');
const { loadJson, saveJson } = require('../utils/jsonDb');

const router = express.Router();

// list blocked targets for a user
router.get('/blocked', (req, res) => {
  const { username } = req.query;
  const blocks = loadJson(blockedFile).filter(b => b.blocker === username);
  res.json(blocks.map(b => b.target));
});

// toggle block
router.post('/block/toggle', (req, res) => {
  const { blocker, target } = req.body;
  if (!blocker || !target) return res.status(400).json({ error: 'Missing' });

  let blocks = loadJson(blockedFile);
  const existing = blocks.find(b => b.blocker === blocker && b.target === target);

  if (existing) {
    blocks = blocks.filter(b => !(b.blocker === blocker && b.target === target));
  } else {
    blocks.push({
      blocker,
      target,
      timestamp: new Date().toISOString()
    });
  }
  saveJson(blockedFile, blocks);

  res.json({ blocked: !existing });
});

// report user
router.post('/report', (req, res) => {
  const { from, target, reason } = req.body;
  if (!from || !target || !reason) return res.status(400).json({ error: 'Missing' });

  const reports = loadJson(reportsFile);
  reports.push({
    id: Date.now(),
    from,
    target,
    reason,
    timestamp: new Date().toISOString()
  });
  saveJson(reportsFile, reports);

  res.json({ message: 'Report saved' });
});

module.exports = router;
