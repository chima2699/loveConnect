// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { usersFile, loginsFile } = require('../config/paths');
const { loadJson, saveJson } = require('../utils/jsonDb');

const router = express.Router();

// Multer for profile photos
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

// Register
router.post('/register', uploadProfile.single('photo'), async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Missing fields' });

  const users = loadJson(usersFile);
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already used' });
  }

  const hash = await bcrypt.hash(password, 10);
  const { configFile } = require('../config/paths');
  const config = await Config.findOne({ isActive: true });
  const bonusCoins = config.bonusCoins || 0;

  const newUser = {
    id: Date.now(),
    username,
    email,
    password: hash,
    profilePhoto: req.file ? '/uploads/profile/' + req.file.path : null,
    age: null,
    gender: '',
    interestedIn: 'any',
    location: '',
    interests: '',
    goal: '',
    bio: '',
    bonusCoins,
    purchasedCoins: 0,
    banned: false,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveJson(usersFile, users);

  res.json({ message: 'Registered', user: { username, email } });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadJson(usersFile);
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (user.banned) {
    return res.status(403).json({ error: 'Your account is banned. Contact support.' });
  }

  const match = await bcrypt.compare(password, user.password || '');
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  // log login
  const logins = loadJson(loginsFile);
  logins.push({ username: user.username, timestamp: new Date().toISOString() });
  saveJson(loginsFile, logins);

  // Admin token (simple)
  let token = null;
  if (user.username === 'admin') {
    token = 'adm-' + Date.now();
  }

  res.json({
    message: 'Login success',
    user: { username: user.username, email: user.email },
    token
  });
});

module.exports = router;
