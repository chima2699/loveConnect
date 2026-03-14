// server.js — MongoDB + JWT upgraded version
// Full-featured, secure, drop-in replacement for your previous server.js
// NOTE: create a .env file (see instructions) before running
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED PROMISE REJECTION:", err);
});
require('dotenv').config();
// Config / env
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/loveapp';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ADMIN_USER = process.env.ADMIN_USER || 'Eugenesidneyc@gmail.com';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Chima2699';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'; // set to your origin in production
const PORT = process.env.PORT || 5000;

const express = require('express');

const http = require('http');
const { Server } = require("socket.io");
const socketIo = require('socket.io');
const crypto = require("crypto");
const app = express();
app.disable("x-powered-by");
app.set('trust proxy', 1);
let currentPricing = null;
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const axios = require('axios');
const Paystack = require("paystack-api");
const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY);
const { Schema } = mongoose;
const Transaction = require('./models/Transaction');
const Withdrawal = require("./models/Withdrawal");
const User = require('./models/User');
const Post = require('./models/Post');
const Config = require('./models/Config');
const Notification = require('./models/Notification');
const Like = require('./models/Like');
const Follow = require('./models/Follow');
const Block = require('./models/Block');
const Report = require('./models/Report');
const Chat = require('./models/Chat');
const Online = require('./models/Online');
const Payment = require('./models/Payment');
const AuditLog = require('./models/AuditLog');
const CoinGift = require("./models/CoinGift");
const requireVerifiedPhone = require("./middlewares/requireVerifiedPhone");
const requireWalletAccess = require("./middlewares/requireWalletAccess");
const adminRoutes = require("./routes/admin");
const walletRoutes = require("./routes/wallet");

const cloudinary = require("./config/cloudinary");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN === "*" ? "*" : FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.set("io", io);

const { generateOTP, hashOTP } = require("./utils/otp");


// ================== 2. APP FIRST ==================
// Attach io to ALL /api routes

//=== Models ======


// ================== 3. PAYSTACK WEBHOOK (RAW BODY ONLY) ==================

console.log("🔥 PAYSTACK WEBHOOK HIT");

app.post(
  "/api/paystack/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-paystack-signature"];

      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
        .update(req.body.toString())
        .digest("hex");

      // ❌ Invalid signature → ignore silently
      if (hash !== signature) {
        return res.sendStatus(401);
      }

      // ✅ Parse AFTER signature verification
      const event = JSON.parse(req.body.toString());

      /* ===========================
         💰 COIN PURCHASE SUCCESS
      ============================ */
      if (event.event === "charge.success") {
        const ref = event.data.reference;
        const { username, coins } = event.data.metadata || {};

        if (!username || !coins) return res.sendStatus(200);

        // 🔒 Idempotency check
        const exists = await Payment.findOne({ reference: ref });
        if (exists) return res.sendStatus(200);

        const user = await User.findOne({ username });
        if (!user) return res.sendStatus(200);

        // ➕ Credit purchased coins
        user.purchasedCoins = (user.purchasedCoins || 0) + Number(coins);
        await user.save();

        // 🧾 Payment record
        await Payment.create({
          reference: ref,
          username,
          coins: Number(coins),
          amount: event.data.amount / 100,
          channel: event.data.channel,
          status: event.data.status
        });

        // 🔔 Notification
        await Notification.create({
          to: username,
          from: "system",
          message: `Payment successful. ${coins} coins added.`
        });

        // 🧾 Transaction log (FIXED)
        await Transaction.create({
          username,
          type: "purchase",
          coins: Number(coins),
          amount: event.data.amount / 100,
          reference: ref,
          status: "success"
        });

        // 🔔 Realtime wallet update
        io.emit("wallet_update", {
  username,
  purchasedCoins: user.purchasedCoins,
  bonusCoins: user.bonusCoins
});
      }

      /* ===========================
         🏦 WITHDRAWAL PAID
      ============================ */
      if (event.event === "transfer.success") {
        const ref = event.data.reference;

        const w = await Withdrawal.findOne({ reference: ref });
        if (!w || w.status === "paid") {
          return res.sendStatus(200);
        }

        w.status = "paid";
        w.processedAt = new Date();
        await w.save();

        await Transaction.create({
          username: w.username,
          type: "withdrawal",
          coins: -w.coins,
          reference: ref,
          meta: {
            netAmount: w.netAmount,
            bank: w.bank
          }
        });
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Paystack webhook error:", err);
      return res.sendStatus(500);
    }
  }
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors({
  origin: true,
  credentials: true
}));
app.use((req, res, next) => {
  if (req.originalUrl === "/api/paystack/webhook") {
    next();
  } else {
    express.json({ limit: "1mb" })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Rate limiter - general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use("/api/posts", (req, res, next) => {
  req.io = io;
  next();
}, require("./routes/posts"));





app.use("/api/wallet", (req, res, next) => {
  req.io = io;
  next();
}, walletRoutes);

app.use("/api/admin", (req,res,next)=>{
  req.io = io;
  next();
}, adminRoutes);

// Connect to MongoDB
mongoose.connect(MONGO_URI)
.then(async () => {
    console.log("✅ MongoDB connected");

    // ✅ ENSURE ONE ACTIVE CONFIG EXISTS (SAFE ON EVERY START)
    

   let existing = await Config.findOne({ isActive: true });
  console.log("📦 Active pricing config:", existing);

if (!existing) {
  await Config.create({
    isActive: true,
    coinPrice: 1,
    bonusCoins: 100,
    calls: {
      voicePerSecond: 2,
      videoPerSecond: 5
    },
    messages: {
      pricePerLetter: 1
    },
    usage: {
      picturePost: 0,
      videoPost: 0
    },
    withdrawal: {
      feePercent: 5,
      minCoins: 0,
      maxCoins: 100000
    },
    bonus: {
      newUser: 0,
      dailyLogin: 0
    }
  });

  console.log("✅ Default active config created");
 
}
  })
.catch(err => {
  console.error("❌ MongoDB connection error:", err);
});
// ====== App & Socket Setup =====

// Serve static files (frontend)

// ====== Multer uploads (same folders) ======
const uploadDirProfile = path.join(__dirname, 'public/uploads/profile');
const uploadDirPosts = path.join(__dirname, 'public/uploads/posts');
if (!fs.existsSync(uploadDirProfile)) fs.mkdirSync(uploadDirProfile, { recursive: true });
if (!fs.existsSync(uploadDirPosts)) fs.mkdirSync(uploadDirPosts, { recursive: true });

let storageProfile;
let storagePosts;
let storageGallery;

try {
  const { CloudinaryStorage } = require("multer-storage-cloudinary");

storageProfile = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "loveconnect_profiles",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"]
  })
});

  storagePosts = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "loveconnect_posts",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "mp4", "mp3", "webp", "mov", "webm"]
  })
});

 storageGallery = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "loveconnect_gallery",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "mp4", "mp3", "webp", "mov", "webm"]
  })
});
  console.log("✅ Cloudinary storage initialized");

} catch (err) {
  console.error("❌ Cloudinary storage failed to load:", err);

  storageProfile = null;
  storagePosts = null;
  storageGallery = null;
}

const uploadProfile = multer({
  storage: storageProfile || undefined,
  dest: storageProfile ? undefined : "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  }
});

const uploadGallery = multer({
  storage: storageGallery || undefined,
  dest: storageGallery ? undefined : "uploads/",
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "audio/mpeg"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"), false);
    }

    cb(null, true);
  }
});

// ====== Utility helpers ======
function sanitizeText(s, maxLen = 1000) {
  if (!s) return '';
  const cleaned = sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} });
  return cleaned.substring(0, maxLen);
}

function signToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Authorization header required' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid authorization header' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { username }
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Haversine distance (correct)
function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Number.POSITIVE_INFINITY;
  const R = 6371; // km
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ====== es ======

// Admin login (env-based credentials)
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username !== process.env.ADMIN_USER ||
    password !== process.env.ADMIN_PASS
  ) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  const token = jwt.sign(
    { admin: true, username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, username });
});

/*
// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/swipe.html'));
});

*/
app.get('/api/paystack/verify', async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.redirect('/wallet.html?status=failed');
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = response.data.data;

    // ❌ Do NOT credit wallet here
    // ❌ Do NOT save transactions here

    if (data.status === 'success') {
      // ✅ Wallet will be credited by webhook
      return res.redirect('/wallet.html?status=success');
    } else {
      return res.redirect('/wallet.html?status=failed');
    }

  } catch (err) {
    console.error('Verify error:', err.message);
    return res.redirect('/wallet.html?status=failed');
  }
});



// ----- AUTH: register & login -----
app.post('/api/register',
  // validations
  body('username').isLength({ min: 3, max: 30 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;

    // checks
    if (await User.findOne({ $or: [{ email }, { username }] })) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const config = await Config.findOne({ isActive: true });

    const u = new User({
      username: sanitizeText(username, 30),
      email: sanitizeText(email, 100),
      password: hashed,
      bonusCoins: config?.bonusCoins || 0
    });

    await u.save();
    res.status(201).json({ message: 'User registered' });
  }
);




app.post("/api/auth/phone/start", requireAuth, async (req, res) => {
  try {
    const { phone } = req.body;
    const username = req.user.username;

    if (!phone) {
      return res.status(400).json({ error: "Phone number required" });
    }

    const exists = await User.findOne({ phone });
    if (exists && exists.username !== username) {
      return res.status(400).json({ error: "Phone already in use" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    user.phone = phone;
    user.phoneVerified = false;
    user.otpHash = otpHash;
    user.otpAttempts = 0;
    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    user.phoneRegion = phone.startsWith("+234") ? "NG" : "FOREIGN";

    await user.save();

    console.log(`📲 OTP (DEV) for ${phone}: ${otp}`);

    res.json({
      ok: true,
      region: user.phoneRegion
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OTP start failed" });
  }
});



app.post('/api/login',
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user.username);
    res.json({ message: 'Login success', user: { username: user.username, email: user.email }, token });
  }
);



// ----- Users list / profile -----
app.get('/api/users', async (req, res) => {
  const users = await User.find({}, '-password').lean();
  res.json(users);
});

app.get('/api/users/all', async (req, res) => {
  const users = await User.find({}, '-password').lean();
  res.json(users);
});

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const { username } = req.query;
    const me = req.user.username;

    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const meUser = await User.findOne({ username: me }).lean();

    const isFollowing = meUser?.following?.includes(username) || false;

    res.json({
      username: user.username,
      age: user.age,
      gender: user.gender,
      interestedIn: user.interestedIn,
      location: user.location,
      interests: user.interests,
      goal: user.goal,
      bio: user.bio,
      profilePhoto: user.profilePhoto,
      photos: user.photos || [],
      followers: user.followers?.length || 0,
      following: user.following?.length || 0,
      isFollowing
    });

  } catch (err) {
    console.error("Profile load error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

const uploadPost = multer({
  storage: storagePosts || undefined,
  dest: storagePosts ? undefined : "uploads/",
  limits: {
    fileSize: 30 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "audio/mpeg"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"), false);
    }

    cb(null, true);
  }
});


// ----- Update profile (requires auth) -----
app.post(
  '/api/profile/update',
  requireAuth,

  // normalize FIRST
  (req, res, next) => {
    if (req.body.gender) {
      req.body.gender = String(req.body.gender).toLowerCase();
    }

    if (req.body.interestedIn) {
      req.body.interestedIn = String(req.body.interestedIn).toLowerCase();
    }
    next();
  },

  // validate AFTER normalization
  body('fullname').optional().isString().trim().escape(),
  body('age').optional().isInt({ min: 13, max: 120 }),

  body('gender')
    .optional()
    .isIn(['male', 'female', '']),

  body('interestedIn')
    .optional()
    .isIn(['male', 'female', 'both', 'any', '']),

  body('location').optional().isString().trim().escape(),
  body('bio').optional().isString(),
  body('lat').optional().isFloat({ min: -90, max: 90 }),
  body('lon').optional().isFloat({ min: -180, max: 180 }),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const username = req.user.username;
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const fields = [
        'fullname',
        'age',
        'gender',
        'interestedIn',
        'location',
        'interests',
        'goal',
        'bio',
        'lat',
        'lon',
        'email'
      ];

      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          if (
            ['bio', 'interests', 'goal', 'location', 'fullname', 'email'].includes(f)
          ) {
            user[f] = sanitizeText(String(req.body[f]), 1000);
          } else if (f === 'age') {
            user.age = Number(req.body.age) || null;
          } else if (f === 'lat' || f === 'lon') {
            user[f] =
              req.body[f] !== null ? Number(req.body[f]) : user[f];
          } else {
            user[f] = req.body[f];
          }
        }
      });

      // password update
      if (req.body.password && String(req.body.password).length >= 6) {
        user.password = await bcrypt.hash(String(req.body.password), 10);
      }

      await user.save();

      res.json({ message: 'Profile updated successfully' });

    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Action failed' });
    }
  }
);

app.post(
  "/api/posts/:id/unlock",
  requireAuth,
  async (req, res) => {
    try {
      const viewer = req.user.username;
      const postId = req.params.id;

      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      // 👑 Owner always sees free
      if (post.username === viewer) {
        return res.json({ ok: true, unlocked: true });
      }

      // 🔓 Already unlocked
      if (post.unlocks?.includes(viewer)) {
        return res.json({ ok: true, unlocked: true });
      }

      // 🆓 Not locked or free post
      if (!post.locked || post.lockPrice <= 0) {
        return res.json({ ok: true, unlocked: true });
      }

      const price = post.lockPrice;

      // 💰 Charge viewer
      let spend;
      try {
        spend = await spendCoinsMongo(viewer, price);
      } catch (e) {
        console.error("Wallet error:", e);
        return res.status(400).json({ error: "Wallet error" });
      }

      if (!spend?.ok) {
        return res.status(400).json({
          error: spend?.error || "Not enough coins"
        });
      }

      // ⚙️ Revenue split config
      const config = await Config.findOne({ isActive: true });

      const adminPercent = config?.unlock?.adminPercent ?? 20;

      const adminCut = Math.floor((price * adminPercent) / 100);
      const ownerCut = price - adminCut;

      // 💸 Credit post owner
      await creditCoinsMongo(post.username, ownerCut);

      // 🔓 Save unlock
      post.unlocks.push(viewer);
      await post.save();

      // 🧾 TRANSACTIONS
      await Transaction.create([
        {
          username: viewer,
          type: "spend",
          amount: -price,
          reference: "post_unlock",
          meta: { postId }
        },
        {
          username: post.username,
          type: "bonus",
          amount: ownerCut,
          reference: "post_unlock_income",
          meta: { postId, from: viewer }
        },
        {
          username: "ADMIN",
          type: "bonus",
          amount: adminCut,
          reference: "post_unlock_fee",
          meta: { postId, from: viewer }
        }
      ]);

      return res.json({
        ok: true,
        unlocked: true,
        ownerCut,
        adminCut
      });

    } catch (err) {
      console.error("Unlock post error:", err);
      return res.status(500).json({ error: "Unlock failed" });
    }
  }
);

app.get("/api/config/public", async (req,res)=>{
  const cfg = await Config.findOne({isActive:true}).lean();
  if(!cfg) return res.json({});

  res.json({
    coinPrice: cfg.coinPrice || 1,
    withdrawalFeePercent: cfg.withdrawal?.feePercent || 5,
    minWithdrawal: cfg.withdrawal?.minCoins || 0,
    usagePrices:{
      message: cfg.messages?.pricePerLetter || 1,
      voice: cfg.calls?.voicePerSecond || 2,
      video: cfg.calls?.videoPerSecond || 3,
      picturePost: cfg.usage?.picturePost || 0,
      videoPost: cfg.usage?.videoPost || 0
    },
    adminPercents:{
      lockedPost: cfg.unlock?.adminPercent || 20
    },
    bonusRules: cfg.bonus || {}
  });
});


// legacy route alias
app.post('/api/profile/photo',
  requireAuth,
  uploadProfile.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const user = await User.findOne({ username: req.user.username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      console.log("Uploaded file:", req.file);
      const uploadedUrl = req.file.path || req.file.secure_url || req.file.filename;

if (!uploadedUrl) {
  return res.status(500).json({ error: 'Cloudinary URL missing' });
}


      user.profilePhoto = uploadedUrl;

      if (!Array.isArray(user.photos)) user.photos = [];
      if (!user.photos.includes(user.profilePhoto)) {
        user.photos.unshift(user.profilePhoto);
      }

      await user.save();

      res.json({
        message: 'Profile photo updated',
        url: user.profilePhoto + '?t=' + Date.now()
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);



app.post('/api/profile/gallery', requireAuth, uploadGallery.array('gallery', 6), async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });
  const username = req.user.username;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!Array.isArray(user.photos)) user.photos = [];
  req.files.forEach(f => user.photos.push(f.path));
  await user.save();
  res.json({ message: 'Gallery uploaded', photos: user.photos });
});


// ----- Posts list -----
app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      posts.map(p => ({
        _id: p._id,
        username: p.username,
        content: p.content,

        // ✅ REQUIRED FOR post.js
        mediaUrl: p.mediaUrl || p.image || null,
        mediaType: p.mediaType || "photo",

        locked: !!p.locked,
        lockPrice: p.lockPrice || 0,
        unlocks: p.unlocks || [],

        likes: p.likes || [],
        comments: p.comments || []
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});



app.post("/api/buy-coins", requireAuth, async (req, res) => {
  try {
    const { coins } = req.body;
    const username = req.user.username;

    const amountCoins = Number(coins);

    if (!amountCoins || amountCoins <= 0) {
      return res.status(400).json({ error: "Invalid coin amount" });
    }

    const config = await Config.findOne({ isActive: true });

    if (!config) {
      return res.status(500).json({ error: "Pricing config missing" });
    }

    const amountToPay = amountCoins * (config.coinPrice || 1) * 100;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: `${username}@loveconnect.app`,
        amount: amountToPay,
        metadata: {
          username,
          coins: amountCoins
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      authorization_url: response.data.data.authorization_url
    });

  } catch (err) {
    console.error("Paystack init error:", err.response?.data || err.message);

    res.status(500).json({
      error: "Payment initialization failed"
    });
  }
});




app.post("/api/coins/gift", requireAuth, async (req, res) => {
  try {
    const from = req.user.username;
    const { to, amount } = req.body;

    if (!to || amount <= 0) {
      return res.status(400).json({ error: "Invalid gift" });
    }

    const sender = await User.findOne({ username: from });
    const receiver = await User.findOne({ username: to });

    if (!receiver) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    // 📊 BALANCE BEFORE
    const senderBalanceBefore =
      sender.bonusCoins + sender.purchasedCoins;

    const receiverBalanceBefore =
      receiver.bonusCoins + receiver.purchasedCoins;

    // 💸 DEDUCT FROM SENDER
    const spend = await spendCoinsMongo(from, amount);
    if (!spend.ok) {
      return res.status(400).json({ error: spend.error });
    }

    // 🎁 CREDIT RECEIVER
    await creditCoinsMongo(to, amount);

    // 🔄 REFRESH USERS (important!)
    const senderAfter = await User.findOne({ username: from });
    const receiverAfter = await User.findOne({ username: to });

    const senderBalanceAfter =
      senderAfter.bonusCoins + senderAfter.purchasedCoins;

    const receiverBalanceAfter =
      receiverAfter.bonusCoins + receiverAfter.purchasedCoins;

    // 📌 LOG SENDER TRANSACTION
    await Transaction.create({
      username: from,
      type: "gift_sent",
      coins: amount,
      amount: 0,
      balanceBefore: senderBalanceBefore,
      balanceAfter: senderBalanceAfter,
      reference: to
    });

    // 📌 LOG RECEIVER TRANSACTION
    await Transaction.create({
      username: to,
      type: "gift_received",
      coins: amount,
      amount: 0,
      balanceBefore: receiverBalanceBefore,
      balanceAfter: receiverBalanceAfter,
      reference: from
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gift failed" });
  }
});


app.get("/api/coins/gifts", requireAuth, async (req, res) => {
  const username = req.user.username;

  const gifts = await CoinGift.find({
    $or: [{ from: username }, { to: username }]
  }).sort({ createdAt: -1 });

  res.json(gifts);
});


// ----- Wallet & coins (protected where applicable) -----
async function spendCoinsMongo(username, amount) {
  if (!amount || amount <= 0) {
    return { ok: true, bonus: 0, purchased: 0 };
  }

  const user = await User.findOne({ username });
  if (!user) {
    return { ok: false, error: 'User not found' };
  }

  // 🔐 Phone verification guard
 

  const total = (user.bonusCoins || 0) + (user.purchasedCoins || 0);
  if (total < amount) {
    return { ok: false, error: 'Not enough coins' };
  }

  let remaining = amount;
  let bonus = user.bonusCoins || 0;
  let purchased = user.purchasedCoins || 0;

  const fromBonus = Math.min(bonus, remaining);
  bonus -= fromBonus;
  remaining -= fromBonus;

  if (remaining > 0) {
    purchased -= remaining;
    remaining = 0;
  }

  user.bonusCoins = bonus;
  user.purchasedCoins = purchased;
  await user.save();

  return { ok: true, bonus, purchased };
}

async function creditCoinsMongo(username, amount) {
  const user = await User.findOne({ username });
  if (!user) return { ok: false, error: "Recipient not found" };

  user.bonusCoins += amount;
  await user.save();

  return { ok: true };
}




app.get('/api/wallet', requireAuth, async (req, res) => {
  const username = req.user.username;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });


  res.json({ bonusCoins: user.bonusCoins || 0, purchasedCoins: user.purchasedCoins || 0 });
});



app.get("/api/wallet/balance",
  requireAuth,
  async (req, res) => {
    try {
      const username = req.user.username;

      const user = await User.findOne({ username }).lean();
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const bonus = user.bonusCoins || 0;
      const purchased = user.purchasedCoins || 0;

      res.json({
        bonus,
        purchased,
        total: bonus + purchased
      });
    } catch (err) {
      console.error("Wallet balance error:", err);
      res.status(500).json({ error: "Failed to load wallet balance" });
    }
  }
);

app.post(
  "/api/wallet/transfer",
  requireAuth,
  async (req, res) => {
    const from = req.user.username;
    const { to, amount } = req.body;

    if (!to || amount <= 0) {
      return res.status(400).json({ error: "Invalid transfer" });
    }

    const sender = await User.findOne({ username: from });
    const receiver = await User.findOne({ username: to });

    if (!receiver) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    if (sender.purchasedCoins < amount) {
      return res.status(400).json({
        error: "Only purchased coins can be gifted"
      });
    }

    sender.purchasedCoins -= amount;
    receiver.bonusCoins += amount; // gifts become bonus coins

    await sender.save();
    await receiver.save();

    await Transaction.create([
      {
        username: from,
        type: "gift_sent",
        amount: -amount,
        reference: to
      },
      {
        username: to,
        type: "gift_received",
        amount,
        reference: from
      }
    ]);

    res.json({ ok: true });
  }
);


// ----- Payment history -----
app.get("/api/payments/history", requireAuth, async (req, res) => {
  const username = req.user.username;

  const payments = await Payment.find({ username })
    .sort({ createdAt: -1 })
    .lean();

  res.json(payments);
});


app.post('/api/paystack/init', requireAuth, async (req, res) => {
  const username = req.user.username;
  const { coins } = req.body;

  const amountCoins = Number(coins);
  if (!amountCoins || amountCoins <= 0) {
    return res.status(400).json({ error: 'Invalid coin amount' });
  }

  const config = await Config.findOne({ isActive: true });

  if (!config || !config.coinPrice) {
    return res.status(500).json({ error: 'Coin price not set by admin' });
  }

  const amountNaira = amountCoins * config.coinPrice;

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: Math.round(amountNaira * 100), // kobo (must be integer)

        // ✅ ADD THIS LINE
        callback_url: `${process.env.BASE_URL}/api/paystack/verify`,

        metadata: {
          username,
          coins: amountCoins
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Paystack init failed' });
  }
});


app.post('/api/transfer-coins', requireAuth, async (req, res) => {
  const { toUser, coins } = req.body;
  const fromUser = req.user.username;
  const amount = Number(coins);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid coin amount' });

  const sender = await User.findOne({ username: fromUser });
  const receiver = await User.findOne({ username: toUser });
  if (!sender || !receiver) return res.status(400).json({ error: 'Invalid users' });

  if ((sender.purchasedCoins || 0) < amount) return res.status(400).json({ error: 'Not enough transferable coins' });

  sender.purchasedCoins -= amount;
  receiver.purchasedCoins = (receiver.purchasedCoins || 0) + amount;

  await sender.save();
  await receiver.save();
  res.json({ message: 'Transfer successful' });
});

app.post(
  "/api/spend/message",
  requireAuth,
  async (req, res) => {
    try {
      const username = req.user.username;

      // 1️⃣ Load pricing config (admin-controlled)
      const config = await Config.findOne({ isActive: true }).lean();
      const cost = Number(config?.messages?.pricePerLetter || 0);


      if (cost <= 0) {
        return res.status(400).json({ error: "Invalid message cost" });
      }

      // 2️⃣ Spend coins (bonus → purchased)
      const result = await spendCoinsMongo(username, cost);
      if (!result.ok) {
        return res.status(400).json({
          error: result.error || "Not enough coins"
        });
      }

      const balanceAfter = result.bonus + result.purchased;
      const balanceBefore = balanceAfter + cost;

      // 3️⃣ Log transaction
      await Transaction.create({
        username,
        type: "spend",
        amount: cost,               // coins spent
        balanceBefore,
        balanceAfter,
        reference: "message",
        meta: { action: "message" }
      });

      // 4️⃣ Respond
      res.json({
        ok: true,
        message: "Message sent",
        cost,
        wallet: {
          bonusCoins: result.bonus,
          purchasedCoins: result.purchased,
          total: balanceAfter
        }
      });
    } catch (err) {
      console.error("Spend message error:", err);
      res.status(500).json({ error: "Failed to process message payment" });
    }
  }
);


app.post(
  "/api/spend/call",
  requireAuth,
  async (req, res) => {
    try {
      const { type, seconds } = req.body;
      const username = req.user.username;

      // 1️⃣ Validate input
      if (!type || !["voice", "video"].includes(type)) {
        return res.status(400).json({ error: "Invalid call type" });
      }

      const duration = Math.max(1, Number(seconds) || 1);

      // 2️⃣ Load ACTIVE admin pricing (PER SECOND)
      const config = await Config.findOne({ isActive: true }).lean();
      if (!config) {
        return res.status(500).json({ error: "Pricing not configured" });
      }

      const rate =
        type === "voice"
          ? Number(config.calls?.voicePerSecond || 0)
          : Number(config.calls?.videoPerSecond || 0);

      if (rate <= 0) {
        return res.status(400).json({ error: "Invalid call rate" });
      }

      // 3️⃣ Calculate cost
      const cost = duration * rate;

      // 4️⃣ Spend coins
      const spend = await spendCoinsMongo(username, cost);
      if (!spend.ok) {
        return res.status(400).json({
          error: spend.error || "Not enough coins for this call"
        });
      }

      const balanceAfter = spend.bonus + spend.purchased;
      const balanceBefore = balanceAfter + cost;

      // 5️⃣ Log transaction
      await Transaction.create({
        username,
        type: "spend",
        amount: cost,
        balanceBefore,
        balanceAfter,
        reference: `${type}_call`,
        meta: {
          seconds: duration,
          ratePerSecond: rate,
          callType: type
        }
      });

      // 6️⃣ Respond
      res.json({
        ok: true,
        message: "Call charged successfully",
        callType: type,
        seconds: duration,
        chargedCoins: cost,
        wallet: {
          bonusCoins: spend.bonus,
          purchasedCoins: spend.purchased,
          total: balanceAfter
        }
      });

    } catch (err) {
      console.error("Spend call error:", err);
      res.status(500).json({ error: "Failed to process call charge" });
    }
  }
);
app.post(
  "/api/spend/post",
  requireAuth,
  async (req, res) => {
    try {
      const { postType } = req.body;
      const username = req.user.username;

      // 1️⃣ Validate post type
      if (!postType || !["photo", "video"].includes(postType)) {
        return res.status(400).json({ error: "Invalid post type" });
      }

      // 2️⃣ Load admin pricing
      const config = await Config.findOne({ isActive: true }).lean();
     const cost =
  postType === "photo"
    ? Number(config?.usage?.picturePost || 0)
    : Number(config?.usage?.videoPost || 0);


      if (cost <= 0) {
        return res.status(400).json({ error: "Invalid post pricing" });
      }

      // 3️⃣ Spend coins (bonus → purchased)
      const spend = await spendCoinsMongo(username, cost);
      if (!spend.ok) {
        return res.status(400).json({
          error: spend.error || "Not enough coins to post"
        });
      }

      const balanceAfter = spend.bonus + spend.purchased;
      const balanceBefore = balanceAfter + cost;

      // 4️⃣ Log transaction

      await Transaction.create({
  username,
  type: "spend",
  amount: -cost,
  balanceBefore,
  balanceAfter,
  reference: `${postType}_post`,
  meta: {
    postType,
    pricingSource: "admin_config"
  }
});

      // 5️⃣ Respond
      res.json({
        ok: true,
        message: `${postType === "photo" ? "Photo" : "Video"} post created`,
        chargedCoins: cost,
        wallet: {
          bonusCoins: spend.bonus,
          purchasedCoins: spend.purchased,
          total: balanceAfter
        }
      });
    } catch (err) {
      console.error("Spend post error:", err);
      res.status(500).json({ error: "Failed to process post charge" });
    }
  }
);



app.get("/api/transactions", requireAuth, async (req, res) => {
  try {
    const username = req.user.username;

    // 📄 Pagination (safe defaults)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // 📊 Fetch history
    const [transactions, total] = await Promise.all([
      Transaction.find({ username })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Transaction.countDocuments({ username })
    ]);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      transactions
    });
  } catch (err) {
    console.error("Transaction fetch error:", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});



// ----- Admin config endpoints (require admin token) -----


function requireAdminToken(req, res, next) {
  // Prefer x-admin-token
  const token =
    req.headers["x-admin-token"] ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Admin token required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (!payload.admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid admin token" });
  }
}


/*
app.post("/api/admin/config", requireAdminToken, async (req, res) => {
  try {
    let config = await Config.findOne({ isActive: true });
    if (!config) config = new Config({ isActive: true });

    const before = JSON.stringify(config.toObject());

    // =====================================
    //   CORE SETTINGS
   // ===================================== 

    if (req.body.coinPrice !== undefined) {
      config.coinPrice = Number(req.body.coinPrice);
    }

    if (req.body.withdrawalFeePercent !== undefined) {
      config.withdrawal = {
        ...config.withdrawal,
        feePercent: Number(req.body.withdrawalFeePercent)
      };
    }

    // =====================================
      // USAGE PRICES (FROM FRONTEND)
    //   admin.html sends usagePrices{}
    //===================================== 

    if (req.body.usagePrices) {
      config.calls = {
        voicePerSecond: Number(
          req.body.usagePrices.voice ??
          config.calls?.voicePerSecond ??
          0
        ),
        videoPerSecond: Number(
          req.body.usagePrices.video ??
          config.calls?.videoPerSecond ??
          0
        )
      };

      config.messages = {
        pricePerLetter: Number(
          req.body.usagePrices.message ??
          config.messages?.pricePerLetter ??
          0
        )
      };

      config.usage = {
        picturePost: Number(
          req.body.usagePrices.picturePost ??
          config.usage?.picturePost ??
          0
        ),
        videoPost: Number(
          req.body.usagePrices.videoPost ??
          config.usage?.videoPost ??
          0
        )
      };
    }

    /* =====================================
       SUPPORT OLD STRUCTURE (BACKWARD SAFE)
    ===================================== *

    if (req.body.calls) {
      config.calls = {
        voicePerSecond: Number(
          req.body.calls.voicePerSecond ??
          config.calls?.voicePerSecond ??
          0
        ),
        videoPerSecond: Number(
          req.body.calls.videoPerSecond ??
          config.calls?.videoPerSecond ??
          0
        )
      };
    }

    if (req.body.messages) {
      config.messages = {
        pricePerLetter: Number(
          req.body.messages.pricePerLetter ??
          config.messages?.pricePerLetter ??
          0
        )
      };
    }

    if (req.body.usage) {
      config.usage = {
        picturePost: Number(
          req.body.usage.picturePost ??
          config.usage?.picturePost ??
          0
        ),
        videoPost: Number(
          req.body.usage.videoPost ??
          config.usage?.videoPost ??
          0
        )
      };
    }

    /* =====================================
       ADMIN PERCENTS
    ===================================== *

    if (req.body.adminPercents) {
      config.unlock = {
        adminPercent: Number(
          req.body.adminPercents.lockedPost ??
          config.unlock?.adminPercent ??
          0
        )
      };

      config.callsAdminPercent = {
        voice: Number(req.body.adminPercents.voiceCall ?? 0),
        video: Number(req.body.adminPercents.videoCall ?? 0),
        message: Number(req.body.adminPercents.message ?? 0)
      };
    }

    /* =====================================
       BONUS RULES
    ===================================== *

    if (req.body.bonusRules) {
      config.bonus = {
        newUser: Number(
          req.body.bonusRules.newUser ??
          config.bonus?.newUser ??
          0
        ),
        dailyLogin: Number(
          req.body.bonusRules.dailyLogin ??
          config.bonus?.dailyLogin ??
          0
        )
      };
    }

    /* =====================================
       ACTIVATE THIS CONFIG
    ===================================== *

    await Config.updateMany({ isActive: true }, { $set: { isActive: false } });
    config.isActive = true;
    await config.save();

    /* =====================================
       BONUS ACTIONS
    ===================================== *

    // give to ALL users
    if (req.body.giveBonusToAll) {
      const amount = Number(req.body.giveBonusToAll);
      if (amount > 0) {
        await User.updateMany({}, { $inc: { bonusCoins: amount } });
      }
    }

    // give to ONE user
    if (req.body.giveBonusToUser?.username && req.body.giveBonusToUser?.amount) {
      const amount = Number(req.body.giveBonusToUser.amount);
      if (amount > 0) {
        await User.findOneAndUpdate(
          { username: req.body.giveBonusToUser.username },
          { $inc: { bonusCoins: amount } }
        );
      }
    }

    /* =====================================
       SOCKET LIVE UPDATE
    ===================================== 

    req.io.emit("pricing:update", {
      coinPrice: config.coinPrice,
      voicePerSecond: config.calls?.voicePerSecond ?? 0,
      videoPerSecond: config.calls?.videoPerSecond ?? 0,
      messagePerLetter: config.messages?.pricePerLetter ?? 0
    });

    req.io.emit("admin:dashboard_update");

    /* =====================================
       AUDIT LOG
    ===================================== 

    await AuditLog.create({
      admin: req.admin?.username || "admin",
      action: "UPDATE_CONFIG",
      details: {
        before: JSON.parse(before),
        after: config.toObject()
      },
      time: new Date()
    });

    res.json({
      ok: true,
      message: "Config updated successfully",
      config
    });

  } catch (err) {
    console.error("Admin config error:", err);
    res.status(500).json({ error: "Failed to update config" });
  }
});

*/

app.post("/api/withdraw/request", requireAuth, requireWalletAccess, async (req, res) => {
  const { coins, bank } = req.body;
  const username = req.user.username;

  if (!coins || coins <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const user = await User.findOne({ username });
  const cfg = await Config.findOne({isActive: true});

  if (!user.phoneVerified)
    return res.status(403).json({ error: "Verify phone first" });

  if (coins < cfg.withdrawal.minCoins || coins > cfg.withdrawal.maxCoins)
    return res.status(400).json({ error: "Outside withdrawal limits" });

  const balance = user.bonusCoins + user.purchasedCoins;
  if (balance < coins)
    return res.status(400).json({ error: "Insufficient coins" });

  // 🔒 Lock coins immediately
  await spendCoinsMongo(username, coins);

  const amount = coins * cfg.coinPrice;
  const fee = Math.round(amount * (cfg.withdrawal.feePercent / 100));
  const netAmount = amount - fee;

  await Withdrawal.create({
    username,
    coins,
    amount,
    fee,
    netAmount,
    bank
  });

  await Transaction.create({
    username,
    type: "withdrawal",
    amount: -coins,
    reference: "withdraw_request"
  });

  res.json({ ok: true, netAmount });
});


/*
app.get("/api/admin/users", requireAdminToken, async (req, res) => {
  try {
    const users = await User.find({})
      .select("username phone phoneVerified createdAt")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

app.post("/api/admin/withdrawals/approve", requireAdminToken, async (req, res) => {
  const { id } = req.body;

  const w = await Withdrawal.findById(id);
  if (!w || w.status !== "pending")
    return res.status(400).json({ error: "Invalid withdrawal" });

  // 👉 Paystack transfer will go here later

  w.status = "approved";
  w.processedBy = req.admin.username;
  w.processedAt = new Date();
  await w.save();

  await AuditLog.create({
    admin: req.admin.username,
    action: "withdraw_approved",
    details: `User ${w.username} ₦${w.netAmount}`
  });

  res.json({ ok: true });
});

app.post("/api/admin/withdrawals/reject", requireAdminToken, async (req, res) => {
  const { id, note } = req.body;

  const w = await Withdrawal.findById(id);
  if (!w || w.status !== "pending")
    return res.status(400).json({ error: "Invalid withdrawal" });

  await creditCoinsMongo(w.username, w.coins);

  w.status = "rejected";
  w.adminNote = note;
  w.processedBy = req.admin.username;
  w.processedAt = new Date();
  await w.save();

  await Transaction.create({
    username: w.username,
    type: "refund",
    amount: w.coins,
    reference: "withdraw_rejected"
  });

  res.json({ ok: true });
});


app.get('/api/admin/audit', requireAdminToken, async (req, res) => {
  const logs = await AuditLog.find().sort({ time: -1 }).limit(100);
  res.json(logs);
});



/* =====================
   ADMIN OVERVIEW
===================== *
app.get('/api/admin/overview', requireAdminToken, async (req, res) => {
  const users = await User.countDocuments();
  const posts = await Post.countDocuments();

  const calls = await Transaction.countDocuments({
    type: { $in: ['voice_call', 'video_call'] }
  });

  const revenueAgg = await Transaction.aggregate([
    { $match: { type: 'purchase' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const activity = await Transaction.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    users,
    posts,
    calls,
    activeNow: onlineSet.size,
    estimatedRevenue: revenueAgg[0]?.total || 0,
    activity: {
      labels: activity.map(a => a._id),
      data: activity.map(a => a.count)
    }
  });
});



/* =====================
   ADMIN USERS
===================== *


app.get("/admin", requireAdminToken, async (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin_dashboard.html"));
});

app.get("/admin/payments", requireAdminToken, async (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin_payments.html"));
});

app.post("/api/admin/user-status", requireAdminToken, async (req, res) => {
  const { username, action, suspendUntil } = req.body;

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (action === "ban") {
    user.banned = true;
    user.suspendedUntil = null;
  }

  if (action === "unban") {
    user.banned = false;
  }

  if (action === "suspend") {
    user.suspendedUntil = new Date(suspendUntil);
    user.banned = false;
  }

  if (action === "unsuspend") {
    user.suspendedUntil = null;
  }

  await user.save();

  res.json({ message: "User status updated" });
});

app.post("/api/admin/adjust-coins", requireAdminToken, async (req, res) => {
  const { username, amount } = req.body;

  if (!username || !amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.bonusCoins += Number(amount);
  await user.save();

  await Transaction.create({
    username,
    type: "ADMIN_BONUS",
    amount: Number(amount),
    reference: "ADMIN_GRANT",
  });

  io.emit("wallet_update", { username });

  res.json({ success: true });
});


/* =====================
   ADMIN TRANSACTIONS
===================== *
// GET /api/admin/transactions
// Admin-only: paginated, filterable, searchable transaction history

app.get("/api/admin/transactions", requireAdminToken, async (req, res) => {
  try {
    // ===== Query params =====
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const {
      type,        // purchase | gift_sent | gift_received | spend | withdrawal | bonus
      username,    // filter by user
      reference,   // payment ref or username
      fromDate,    // ISO date
      toDate       // ISO date
    } = req.query;

    // ===== Build query safely =====
    const query = {};

    if (type) query.type = type;
    if (username) query.username = username;
    if (reference) query.reference = { $regex: reference, $options: "i" };

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    // ===== Fetch =====
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Transaction.countDocuments(query)
    ]);

    // ===== Response =====
    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      transactions
    });

  } catch (err) {
    console.error("Admin transactions error:", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});


app.post("/api/admin/withdrawals/pay", requireAdminToken, async (req, res) => {
  try {
    const { id } = req.body;

    const w = await Withdrawal.findById(id);
    if (!w || w.status !== "approved") {
      return res.status(400).json({ error: "Invalid withdrawal" });
    }

    const user = await User.findOne({ username: w.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    // 🔁 Create recipient if missing
    if (!user.paystackRecipientCode) {
      const code = await createRecipient(user, w.bank);
      user.paystackRecipientCode = code;
      await user.save();
    }

    // 💸 Initiate transfer
    const transfer = await paystack.post("/transfer", {
      source: "balance",
      amount: Math.round(w.netAmount * 100), // kobo
      recipient: user.paystackRecipientCode,
      reason: `LoveConnect withdrawal - ${w.username}`
    });

    w.status = "paid";
    w.processedAt = new Date();
    w.processedBy = req.admin.username;
    w.reference = transfer.data.data.reference;

    await w.save();

    await Transaction.create({
      username: w.username,
      type: "withdrawal",
      amount: w.coins,
      reference: w.reference,
      meta: { netAmount: w.netAmount }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Paystack payout failed" });
  }
});

app.get("/api/admin/withdrawals", requireAdminToken, async (req, res) => {
  try {
    const status = req.query.status; // optional

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const list = await Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(list);

  } catch (err) {
    console.error("Withdrawals error:", err);
    res.status(500).json({ error: "Failed to load withdrawals" });
  }
});


app.get(
  "/api/admin/analytics/locked-posts",
  requireAdminToken,
  async (req, res) => {
    try {
      // 1️⃣ Total unlock spend
      const totalUnlockSpend = await Transaction.aggregate([
        { $match: { reference: "post_unlock" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      // amount is negative, so flip it
      const totalRevenue = Math.abs(totalUnlockSpend[0]?.total || 0);

      // 2️⃣ Admin earnings
      const adminEarnings = await Transaction.aggregate([
        { $match: { reference: "post_unlock_fee" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      // 3️⃣ Top creators
      const topCreators = await Transaction.aggregate([
        { $match: { reference: "post_unlock_income" } },
        {
          $group: {
            _id: "$username",
            earned: { $sum: "$amount" }
          }
        },
        { $sort: { earned: -1 } },
        { $limit: 10 }
      ]);

      // 4️⃣ Top posts
      const topPosts = await Transaction.aggregate([
        { $match: { reference: "post_unlock" } },
        {
          $group: {
            _id: "$meta.postId",
            unlocks: { $sum: 1 },
            revenue: { $sum: { $abs: "$amount" } }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 }
      ]);

      res.json({
        totalRevenue,
        adminEarnings: adminEarnings[0]?.total || 0,
        topCreators,
        topPosts
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Analytics failed" });
    }
  }
);
*/

app.get(
  "/api/creator/earnings",
  requireAuth,
  async (req, res) => {
    try {
      const username = req.user.username;

      // 1️⃣ Total earnings
      const total = await Transaction.aggregate([
        {
          $match: {
            username,
            reference: "post_unlock_income"
          }
        },
        {
          $group: {
            _id: null,
            earned: { $sum: "$amount" }
          }
        }
      ]);

      // 2️⃣ Earnings per post
      const perPost = await Transaction.aggregate([
        {
          $match: {
            username,
            reference: "post_unlock_income"
          }
        },
        {
          $group: {
            _id: "$meta.postId",
            earned: { $sum: "$amount" },
            unlocks: { $sum: 1 }
          }
        },
        { $sort: { earned: -1 } }
      ]);

      res.json({
        totalEarned: total[0]?.earned || 0,
        posts: perPost
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load earnings" });
    }
  }
);



// 📍 FILE: server.js  (POST CREATE ROUTE)


// ----- Notifications -----
app.get('/api/notifications', requireAuth, async (req, res) => {
  const user = req.user.username;
  const notifs = await Notification.find({ to: user }).sort({ timestamp: -1 }).lean();
  res.json(notifs);
});
app.post('/api/notifications', requireAuth, async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'to and message required' });
  const n = new Notification({ to, from: req.user.username, message: sanitizeText(message, 300) });
  await n.save();
  res.json({ message: 'Notification saved' });
});

// ----- Follows -----
app.get('/api/follows/list', requireAuth, async (req, res) => {
  const username = req.query.username || req.user.username;
  const follows = await Follow.find({ follower: username }).lean();
  res.json(follows);
});
app.get('/api/follows/all', requireAuth, async (req, res) => {
  const all = await Follow.find({}).lean();
  res.json(all);
});
app.post("/api/follows/toggle", requireAuth, async (req, res) => {
  try {
    const { followee } = req.body;
    const me = req.user.username;

    if (!followee) {
      return res.status(400).json({ error: "followee is required" });
    }

    if (me === followee) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const user = await User.findOne({ username: followee });
    const meUser = await User.findOne({ username: me });

    if (!user || !meUser) {
      return res.status(404).json({ error: "User not found" });
    }

    let action;

    if (meUser.following.includes(followee)) {
      // UNFOLLOW
      meUser.following = meUser.following.filter(u => u !== followee);
      user.followers = user.followers.filter(u => u !== me);
      action = "unfollowed";
    } else {
      // FOLLOW
      meUser.following.push(followee);
      user.followers.push(me);
      action = "followed";
    }

    // ✅ SAVE HERE (correct place)
    await meUser.save();
    await user.save();

    res.json({
      success: true,
      action,
      followers: user.followers.length,
      following: meUser.following.length
    });

  } catch (err) {
    console.error("Follow toggle error:", err);
    res.status(500).json({ error: "Action failed" });
  }
});


// ----- Blocks -----
app.get('/api/blocked', requireAuth, async (req, res) => {
  const username = req.query.username || req.user.username;
  const blocks = await Block.find({ blocker: username }).lean();
  const targets = blocks.map(b => b.target);
  res.json(targets);
});
app.post('/api/block/toggle', requireAuth, async (req, res) => {
  const blocker = req.user.username;
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: 'target required' });

  const existing = await Block.findOne({ blocker, target });
  if (existing) {
    await existing.remove();
    return res.json({ message: 'Unblocked' });
  } else {
    await new Block({ blocker, target }).save();
    return res.json({ message: 'Blocked' });
  }
});

// ----- Reports -----
app.post('/api/report', requireAuth, async (req, res) => {
  const from = req.user.username;
  const { target, reason } = req.body;
  if (!target || !reason) return res.status(400).json({ error: 'target and reason required' });
  await new Report({ from, target, reason: sanitizeText(reason, 500) }).save();
  // notify admin
  await new Notification({ to: ADMIN_USER, from, message: `Report against ${target}: ${reason}` }).save();
  res.json({ message: 'Report submitted' });
});

// ----- Matching & swipe-users (nearest first) -----
// Returns objects: username, age, gender, location, interests, goal, bio, photo, distance
app.get('/api/swipe-users', requireAuth, async (req, res) => {
  const meUsername = req.user.username;

  const me = await User.findOne({ username: meUsername }).lean();
  if (!me) return res.status(404).json({ error: 'User not found' });

  const myGender = (me.gender || 'any').toLowerCase();
  const myInterest = (me.interestedIn || 'any').toLowerCase();

  // blocked users
  const blocks = await Block.find({
    $or: [{ blocker: meUsername }, { target: meUsername }]
  }).lean();

  const blockedSet = new Set();
  blocks.forEach(b => {
    if (b.blocker === meUsername) blockedSet.add(b.target);
    if (b.target === meUsername) blockedSet.add(b.blocker);
  });

  const users = await User.find({
    username: { $ne: meUsername },
    banned: false
  }).lean();

  const filtered = users.filter(u => {
    if (blockedSet.has(u.username)) return false;

    const theirGender = (u.gender || 'any').toLowerCase();
    const theirInterest = (u.interestedIn || 'any').toLowerCase();

    // 1️⃣ I must want them
    const iWantThem =
      myInterest === 'any' ||
      theirGender === myInterest ||
      theirGender === 'any';

    // 2️⃣ They must want me
    const theyWantMe =
      theirInterest === 'any' ||
      theirInterest === myGender ||
      myGender === 'any';

    return iWantThem && theyWantMe;
  });

  const list = filtered.map(u => ({
    username: u.username,
    age: u.age || null,
    gender: u.gender || '',
    location: u.location || '',
    interests: u.interests || '',
    goal: u.goal || '',
    bio: u.bio || '',
    profilePhoto: u.profilePhoto || u.photos?.[0] || null,
    distance: distanceKm(me.lat, me.lon, u.lat, u.lon)
  }));

  list.sort((a, b) => a.distance - b.distance);

  res.json(list);
});


// ----- Likes -----
app.post('/api/like', requireAuth, async (req, res) => {
  const fromUser = req.user.username;
  const toUser = req.body.toUser || req.body.to;
  const liked = (typeof req.body.liked === 'boolean') ? req.body.liked : true;
  if (!toUser) return res.status(400).json({ error: 'toUser required' });

  await new Like({ from: fromUser, to: toUser, liked }).save();

  let isMatch = false;
  if (liked) {
    const mutual = await Like.findOne({ from: toUser, to: fromUser, liked: true });
    if (mutual) {
      isMatch = true;
      await new Notification({ to: fromUser, from: toUser, message: `You matched with ${toUser}!` }).save();
      await new Notification({ to: toUser, from: fromUser, message: `You matched with ${fromUser}!` }).save();
    }
  }

  res.json({ message: 'Swipe saved', isMatch });
});

app.post("/api/posts/comment", requireAuth, async (req,res)=>{
    const { postId, text } = req.body;
    const user = req.user.username;

    const post = await Post.findById(postId);
    if(!post) return res.status(404).json({error:"Post not found"});

    post.comments = post.comments || [];
    post.comments.push({
        from:user,
        text,
        ts:new Date()
    });

    await post.save();
    res.json({ ok:true });
});




// ----- POST LIKE (SEPARATE FROM SWIPE LIKE) -----
app.post("/api/posts/like", requireAuth, async (req, res) => {
  const { postId } = req.body;
  const username = req.user.username;

  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  post.likes = post.likes || [];

  const index = post.likes.indexOf(username);

  if (index === -1) {
    post.likes.push(username);

    // 🔔 notify post owner
    if (post.username !== username) {
      await Notification.create({
        to: post.username,
        from: username,
        message: "liked your post"
      });
    }

  } else {
    post.likes.splice(index, 1); // unlike
  }

  await post.save();
  res.json({ ok: true, likes: post.likes.length });
});



// ----- Chat start & messages -----
app.post('/api/chat/start', requireAuth, async (req, res) => {
  const a = req.user.username;
  const b = req.body.b;
  if (!b) return res.status(400).json({ error: 'b required' });

  let chat = await Chat.findOne({ users: { $all: [a, b], $size: 2 } });
  if (!chat) {
    chat = await new Chat({ users: [a, b], messages: [] }).save();
  }
  res.json({ chatId: chat._id, messages: chat.messages });
});

app.post('/api/chat/msg', requireAuth, async (req, res) => {
  const { chatId, text } = req.body;
  const from = req.user.username;

  if (!chatId || !text) {
    return res.status(400).json({ error: "chatId and text required" });
  }

  // 💰 Charge coins
  const config = await Config.findOne({ isActive: true });
  const cost = Number(config?.messages?.pricePerLetter || 1);

  const charge = await spendCoinsMongo(from, cost);
  if (!charge.ok) {
    return res.status(400).json({ error: "Not enough coins" });
  }

  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const message = {
    from,
    text,
    delivered: false,
    seen: false,
    ts: new Date()
  };

  chat.messages.push(message);
  await chat.save();

  // Send to recipient only
  const recipient = chat.users.find(u => u !== from);
  io.to(recipient).emit("chat_message", {
    chatId,
    message: { ...message, delivered: true }
  });

  res.json({ ok: true, message });
});



app.get('/api/chat/search', requireAuth, async (req, res) => {
  const { chatId, q } = req.query;

  if (!chatId || !q) return res.status(400).json({ error: "chatId and q required" });

  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const lower = q.toLowerCase();
  const results = chat.messages.filter(m => m.text.toLowerCase().includes(lower));

  res.json(results);
});

app.post('/api/chat/seen', requireAuth, async (req, res) => {
  const { chatId } = req.body;
  const me = req.user.username;

  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  chat.messages.forEach(m => {
    if (m.from !== me) m.seen = true;
  });

  await chat.save();

  const other = chat.users.find(u => u !== me);
  io.to(other).emit("chat_seen", { chatId });

  res.json({ ok: true });
});


app.post('/api/chat/react', requireAuth, async (req, res) => {
  const { chatId, index, emoji } = req.body;

  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  if (!chat.messages[index]) return res.status(400).json({ error: "Invalid message index" });

  chat.messages[index].reaction = emoji;
  await chat.save();

  // Notify other user
  const from = req.user.username;
  chat.users.forEach(u => {
    if (u !== from) {
      io.to(u).emit("chat_reaction", {
        chatId,
        index,
        emoji
      });
    }
  });

  res.json({ ok: true });
});


// ----- Chat list for message_list.html -----
app.get("/api/messages/list", requireAuth, async (req, res) => {
  const me = req.user.username;

  const chats = await Chat.find({ users: me }).lean();
  const result = [];

  for (const c of chats) {
    const otherUser = c.users.find(u => u !== me);

    const userProfile = await User.findOne(
      { username: otherUser },
      "-password"
    ).lean();

    const messages = c.messages || [];
    const lastMsg = messages[messages.length - 1];

    const unread = messages.filter(
      m => !m.seen && m.from === otherUser
    ).length;

    result.push({
      username: otherUser,
      photo: userProfile?.profilePhoto || userProfile?.photos?.[0] || null,
      online: false, // updated via socket later
      lastMessage: lastMsg ? lastMsg.text : "",
      lastTimestamp: lastMsg ? lastMsg.ts : null,
      unread
    });
  }

  result.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
  res.json(result);
});


// ----- Socket.io: online and signaling -----



const onlineSet = new Set();
const socketToUser = new Map();

/* ======================
   SOCKET AUTH MIDDLEWARE
====================== */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.username = payload.username;
    next();
  } catch (err) {
    return next(new Error("Invalid token"));
  }
});

/* ======================
   SOCKET CONNECTION
====================== */
io.on("connection", (socket) => {
  const username = socket.username;

  if (!username) {
    console.log("⚠️ Socket connected without username:", socket.id);
    socket.disconnect();
    return;
  }

  console.log("🟢 Socket connected:", socket.id, username);

  socketToUser.set(socket.id, username);
  onlineSet.add(username);

  socket.join(username); // private room
  io.emit("online_list", Array.from(onlineSet));

  /* ======================
     💬 MESSAGING (LEGACY)
  ====================== */
  socket.on("send_message", (data) => {
    if (!data?.to) return;
    io.to(data.to).emit("receive_message", {
      ...data,
      from: username
    });
  });

  /* ======================
     📞 VIDEO / VOICE SIGNALING
  ====================== */
  socket.on("video-offer", ({ to, offer }) => {
    io.to(to).emit("video-offer", {
      from: username,
      offer
    });
  });

  socket.on("video-answer", ({ to, answer }) => {
    io.to(to).emit("video-answer", {
      from: username,
      answer
    });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", {
      from: username,
      candidate
    });
  });

  /* ======================
     💰 PRICING (NEW)
  ====================== */

  // Client asks for current pricing
  socket.on("pricing:request", async () => {
  try {
    console.log("📨 pricing:request received from", socket.id);

    const cfg = await Config.findOne({ isActive: true });

    console.log("📦 pricing config sent to socket:", cfg);

    if (!cfg) {
      console.log("❌ No active pricing config found");
      return;
    }

    socket.emit("pricing:update", {
      coinPrice: cfg.coinPrice,
      voicePerSecond: cfg.calls?.voicePerSecond || 0,
      videoPerSecond: cfg.calls?.videoPerSecond || 0,
      messagePerLetter: cfg.messages?.pricePerLetter || 0
    });

  } catch (err) {
    console.error("Pricing request error:", err);
  }
});

  /* ======================
     🔁 DISCONNECT
  ====================== */
  socket.on("disconnect", () => {
  const username = socketToUser.get(socket.id);
  socketToUser.delete(socket.id);

  if (!username) return;

  let stillConnected = false;
  for (const u of socketToUser.values()) {
    if (u === username) {
      stillConnected = true;
      break;
    }
  }

  if (!stillConnected) {
    onlineSet.delete(username);
    io.emit("online_list", Array.from(onlineSet));
  }

  console.log("❌ Socket disconnected:", socket.id, username);
});
});





// ====== Start server ======
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Love app backend (MongoDB + JWT) running at http://0.0.0.0:${PORT}`);
});                                            
