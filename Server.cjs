// server.cjs
require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
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

// ----- Security / perf middleware -----
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  })
);


// Content Security Policy (relaxed for CDN & inline needed by your setup)
app.use(helmet.contentSecurityPolicy({
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
    upgradeInsecureRequests: null
  }
}));

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS?.split(',') || [
   
    'https://arriving-large-toucan.ngrok-free.app'
  ]),
  credentials: true
}));

app.use(compression());

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300
}));

// Stricter auth route limiter
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false
});

// ----- Body parsing -----
app.use(express.json({ limit: '10kb' }));

// ----- Static -----
app.use('/home/assets', express.static(path.join(__dirname, 'dist/assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/dist', express.static(path.join(__dirname, 'dist')));

// ----- MongoDB -----
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('Missing MONGO_URI in .env');
  process.exit(1);
}
const client = new MongoClient(uri, {
  connectTimeoutMS: 8000,
  serverSelectionTimeoutMS: 8000
});

let db, studentsCollection, messagesCollection;

async function connectDB() {
  await client.connect();
  db = client.db(); // default db from URI
  studentsCollection = db.collection('students');
  messagesCollection = db.collection('messages'); // NEW dedicated messages collection
  // Useful indexes
  await messagesCollection.createIndex({ sender: 1, receiver: 1, timestamp: 1 });
  await studentsCollection.createIndex({ username: 1 }, { unique: true });
  console.log('✅ Connected to MongoDB Atlas');
}

// ----- Sessions (Mongo store, not memory) -----
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'replace_this_in_env',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: uri,
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true behind HTTPS
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ----- Auth guard -----
const requireAuth = (req, res, next) => {
  if (!req.session.username) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ----- Routes -----
app.get('/session', (req, res) => {
  res.json({
    loggedIn: !!req.session.username,
    username: req.session.username || null
  });
});
app.get(['/home', '/home/:username'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Signup / Login / Logout
app.post('/signup', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long' });

  try {
    const existingUser = await studentsCollection.findOne({ username });
    if (existingUser) return res.status(409).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await studentsCollection.insertOne({
      username,
      password: hashedPassword,
      createdAt: new Date()
    });

    req.session.username = username;
    res.status(201).json({ success: true, username });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  try {
    const user = await studentsCollection.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('sid');
    res.json({ success: true });
  });
});

// Students list (excludes self)
app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const students = await studentsCollection
      .find({ username: { $ne: req.session.username } }, { projection: { password: 0 } })
      .toArray();
    res.json(students);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get chat messages between two users (from dedicated collection)
app.get('/api/chat/:user1/:user2', requireAuth, async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const currentUser = req.session.username;

    if (currentUser !== user1 && currentUser !== user2) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const msgs = await messagesCollection
      .find({
        $or: [
          { sender: user1, receiver: user2 },
          { sender: user2, receiver: user1 }
        ]
      })
      .project({ _id: 1, sender: 1, receiver: 1, text: 1, timestamp: 1, read: 1 })
      .sort({ timestamp: 1 })
      .toArray();

    const formatted = msgs.map(m => ({
      id: m._id.toString(),
      sender: m.sender,
      receiver: m.receiver,
      message: m.text,
      timestamp: m.timestamp,
      read: !!m.read
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a chat message (insert one doc; not saved to memory; stored in Mongo)
app.post('/api/chat/send', requireAuth, async (req, res) => {
  const { receiver, message } = req.body || {};
  const sender = req.session.username;

  if (!receiver || !message) return res.status(400).json({ error: 'Receiver and message are required.' });
  if (sender === receiver) return res.status(400).json({ error: 'Cannot send message to yourself' });

  try {
    const receiverExists = await studentsCollection.findOne({ username: receiver });
    if (!receiverExists) return res.status(404).json({ error: 'Receiver not found' });

    const doc = {
      sender,
      receiver,
      text: message,
      timestamp: new Date(),
      read: false
    };

    const { insertedId } = await messagesCollection.insertOne(doc);

    res.status(201).json({
      success: true,
      message: {
        id: insertedId.toString(),
        sender,
        receiver,
        message: message,
        timestamp: doc.timestamp
      }
    });
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----- HTML routes -----
app.get(['/', '/signup'], (req, res) => {
  if (req.session.username) return res.redirect('/home');
  res.sendFile(path.join(__dirname, req.path === '/' ? 'Login.html' : 'signup.html'));
});

app.get(['/home', '/home/:username'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ----- 404 -----
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ----- Error handler -----
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ----- Start -----
async function start() {
  try {
    await connectDB();
    app.listen(PORT,HOST, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  try { await client.close(); } catch {}
  process.exit(0);
});
