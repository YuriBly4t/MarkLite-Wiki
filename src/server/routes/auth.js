const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Status check: whether setup is required and whether user is authenticated
router.get('/status', (req, res) => {
  const needsSetup = !db.hasUsers();
  let user = null;

  if (req.session && req.session.userId) {
    user = db.getUserById(req.session.userId);
  }

  res.json({
    needsSetup,
    isAuthenticated: !!user,
    user: user ? { id: user.id, username: user.username } : null
  });
});

// First-run setup: only available when no users exist
router.post('/setup', (req, res) => {
  if (db.hasUsers()) {
    return res.status(403).json({ error: 'Setup has already been completed. Please sign in.' });
  }

  const { username, password } = req.body;

  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const saltRounds = 10;
    const passwordHash = bcrypt.hashSync(password, saltRounds);
    const user = db.createUser(username, passwordHash);

    // Sign in immediately after setup
    req.session.userId = user.id;

    res.status(201).json({
      success: true,
      message: 'Administrator account created successfully!',
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Failed to create administrator account.' });
  }
});

// Sign In
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please provide both username and password.' });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const passwordMatch = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.userId = user.id;

  res.json({
    success: true,
    user: { id: user.id, username: user.username }
  });
});

// Sign Out
router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ success: true, message: 'Signed out successfully.' });
});

// Current user profile
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const user = db.getUserById(req.session.userId);
  if (!user) {
    req.session = null;
    return res.status(401).json({ error: 'User account no longer exists.' });
  }

  res.json({ user: { id: user.id, username: user.username } });
});

module.exports = router;
