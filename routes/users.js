// routes/users.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const { usersFile } = require('../config/paths');
const { loadJson, saveJson } = require('../utils/jsonDb');

const router = express.Router();

// Profile photo upload (used from profile page)
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'profile'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, Date.now() + '-' + Math.round(Math.random()*1e9) + ext);
  }
});
const uploadProfile = multer({ storage: profileStorage });

router.post('/upload/profile-photo', uploadProfile.single('photo'), (req, res) => {
  const { username } = req.body;
  if (!username || !req.file) return res.status(400).json({ error: 'Missing' });

  const users = loadJson(usersFile);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.profilePhoto = '/uploads/profile/' + req.file.filename;
  saveJson(usersFile, users);

  res.json({ url: user.profilePhoto });
});

// Get profile
router.get('/profile', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });

  const users = loadJson(usersFile);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const {
    password, ...safe
  } = user;
  res.json(safe);
});

// Update profile
router.post('/update-profile', (req, res) => {
  const { username, email, password, age, gender, interestedIn, location, interests, goal, bio } = req.body;
  const users = loadJson(usersFile);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (email) user.email = email;
  if (age !== undefined) user.age = age;
  if (gender !== undefined) user.gender = gender;
  if (interestedIn !== undefined) user.interestedIn = interestedIn;
  if (location !== undefined) user.location = location;
  if (interests !== undefined) user.interests = interests;
  if (goal !== undefined) user.goal = goal;
  if (bio !== undefined) user.bio = bio;
  // password change skipped here (admin route for reset already)

  saveJson(usersFile, users);
  res.json({ message: 'Profile updated' });
});

// All users (for search)
router.get('/users/all', (req, res) => {
  const users = loadJson(usersFile).map(u => {
    const { password, ...safe } = u;
    return safe;
  });
  res.json(users);
});

module.exports = router;
