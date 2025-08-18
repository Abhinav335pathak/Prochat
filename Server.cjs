// server.cjs
require('dotenv').config();

const express = require('express');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0";
const SALT_ROUNDS = 10;

// ----- Security -----
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: null,
    },
  })
);

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS?.split(',') || ['https://prochat-e7hc.onrender.com']),
  credentials: true,
}));

app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

// ----- Body parsing -----
app.use(express.json({ limit: '10kb' }));

// ----- MongoDB -----
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('❌ Missing MONGO_URI in .env');
  process.exit(1);
}
const client = new MongoClient(uri);
let studentsCollection, messagesCollection;

async function connectDB() {
  await client.connect();
  const db = client.db(); // use default DB from URI
  studentsCollection = db.collection('students');
  messagesCollection = db.collection('messages');

  await studentsCollection.createIndex({ username: 1 }, { unique: true });
  await messagesCollection.createIndex({ sender: 1, receiver: 1, timestamp: 1 });

  console.log("✅ Connected to MongoDB");
}

// ----- Sessions -----
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: uri, ttl: 24 * 60 * 60 }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// ----- Auth guard -----
const requireAuth = (req, res, next) => {
  if (!req.session.username) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ----- API Routes -----
app.get('/session', (req, res) => {
  res.json({ loggedIn: !!req.session.username, username: req.session.username || null });
});

// Signup
app.post('/signup', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username & password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password too short" });

  try {
    const existing = await studentsCollection.findOne({ username });
    if (existing) return res.status(409).json({ error: "Username already exists" });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await studentsCollection.insertOne({ username, password: hashed, createdAt: new Date() });

    req.session.username = username;
    res.status(201).json({ success: true, username });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username & password required" });

  try {
    const user = await studentsCollection.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie('sid');
    res.json({ success: true });
  });
});

// Students list
app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const students = await studentsCollection
      .find({ username: { $ne: req.session.username } }, { projection: { password: 0 } })
      .toArray();
    res.json(students);
  } catch (err) {
    console.error("Fetch students error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// Chat
app.get('/api/chat/:user1/:user2', requireAuth, async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const me = req.session.username;
    if (me !== user1 && me !== user2) return res.status(403).json({ error: "Forbidden" });

    const msgs = await messagesCollection.find({
      $or: [{ sender: user1, receiver: user2 }, { sender: user2, receiver: user1 }]
    }).sort({ timestamp: 1 }).toArray();

    res.json(msgs.map(m => ({
      id: m._id.toString(),
      sender: m.sender,
      receiver: m.receiver,
      message: m.text,
      timestamp: m.timestamp,
      read: !!m.read
    })));
  } catch (err) {
    console.error("Fetch chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/chat/send', requireAuth, async (req, res) => {
  const { receiver, message } = req.body;
  const sender = req.session.username;
  if (!receiver || !message) return res.status(400).json({ error: "Receiver & message required" });
  if (sender === receiver) return res.status(400).json({ error: "Cannot message yourself" });

  try {
    const exists = await studentsCollection.findOne({ username: receiver });
    if (!exists) return res.status(404).json({ error: "Receiver not found" });

    const doc = { sender, receiver, text: message, timestamp: new Date(), read: false };
    const { insertedId } = await messagesCollection.insertOne(doc);

    res.status(201).json({
      success: true,
      message: { id: insertedId.toString(), ...doc }
    });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----- Serve Frontend (dist) -----
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback (for React/Vite Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ----- Start -----
async function start() {
  try {
    await connectDB();
    app.listen(PORT, HOST, () => console.log(`✅ Server running on http://${HOST}:${PORT}`));
  } catch (e) {
    console.error("Failed to start:", e);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  try { await client.close(); } catch {}
  process.exit(0);
});
