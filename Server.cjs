// server.js
const express = require('express');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const uri = 'mongodb://localhost:27017';
const dbName = 'studentDB';
const client = new MongoClient(uri);

let db, collection;

// Middleware
app.use(cors({
  origin: ['http://localhost:4173', 'http://localhost:5173' ,' https://arriving-large-toucan.ngrok-free.app'],
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Static files
app.use('/home/assets', express.static(path.join(__dirname, 'dist/assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve home page
app.get('/home', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Serve chat page with authentication check
app.get('/home/:username', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'chat.html'));
});

// Get all messages for the chat
app.get('/api/messages', async (req, res) => {
  try {
    // Get messages from all users
    const students = await collection.find({ messages: { $exists: true, $not: { $size: 0 } } })
      .project({ username: 1, messages: 1 })
      .toArray();

    // Flatten and format messages
    const allMessages = students.flatMap(student => 
      student.messages.map(msg => ({
        username: student.username,
        message: msg.text,
        timestamp: msg.timestamp,
        isCurrentUser: student.username === req.session.username
      }))
    );

    // Sort by timestamp
    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json(allMessages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Error fetching messages" });
  }
});

// Add message to chat
app.post('/send-message', async (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }

  try {
    await collection.updateOne(
      { username: req.session.username },
      { 
        $push: { 
          messages: {
            text: message,
            timestamp: new Date()
          } 
        },
        $setOnInsert: { username: req.session.username }
      },
      { upsert: true }
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).json({ error: "Failed to save message" });
  }
});


























// Get messages for a specific user (if still needed)
app.get('/api/students/:username/messages', async (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { username } = req.params;
  try {
    const student = await collection.findOne({ username });
    if (!student) return res.status(404).json({ error: 'User not found' });

    res.json(student.messages || []);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all students (optional)
app.get('/api/students', async (req, res) => {
  try {
    const students = await collection.find({}).toArray();
    res.json(students);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Authentication routes
app.get('/', (req, res) => {
  if (req.session.username) {
   
    return res.redirect('/home');
  }
  res.sendFile(path.join(__dirname, 'Login.html'));
});

app.get('/signup', (req, res) => {
  if (req.session.username) {
    return res.redirect('/home');
  }
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await collection.findOne({ username });
    if (existingUser) return res.status(409).json({ error: 'Username already exists' });

    const result = await collection.insertOne({ 
      username, 
      password, 
      messages: [] 
    });
    
    // Auto-login after signup
    req.session.username = username;
    res.status(201).json({ 
      success: true,
      username: username
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: 'Failed to add student' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await collection.findOne({ username, password });
    if (user) {
      req.session.username = user.username;
      res.json({ 
        success: true,
        username: user.username
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

app.get('/session', (req, res) => {
  if (req.session.username) {
    res.json({ 
      loggedIn: true, 
      username: req.session.username 
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// Start server after DB connects
async function start() {
  try {
    await client.connect();
    db = client.db(dbName);
    collection = db.collection('students');
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

start();