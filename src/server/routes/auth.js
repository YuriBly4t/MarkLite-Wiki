const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Status-Prüfung: Prüft ob Setup benötigt wird oder ob der Nutzer eingeloggt ist
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

// Setup-Wizard: Nur beim allerersten Start möglich
router.post('/setup', (req, res) => {
  if (db.hasUsers()) {
    return res.status(403).json({ error: 'Das Setup wurde bereits abgeschlossen. Bitte normal einloggen.' });
  }

  const { username, password } = req.body;

  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Der Benutzername muss mindestens 3 Zeichen lang sein.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
  }

  try {
    const saltRounds = 10;
    const passwordHash = bcrypt.hashSync(password, saltRounds);
    const user = db.createUser(username, passwordHash);

    // Direkt nach Setup einloggen
    req.session.userId = user.id;

    res.status(201).json({
      success: true,
      message: 'Administrator-Account erfolgreich erstellt!',
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Setup-Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Benutzerkontos.' });
  }
});

// Normaler Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Bitte Benutzername und Passwort angeben.' });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort.' });
  }

  const passwordMatch = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort.' });
  }

  req.session.userId = user.id;

  res.json({
    success: true,
    user: { id: user.id, username: user.username }
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ success: true, message: 'Erfolgreich abgemeldet.' });
});

// Aktueller Benutzer
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  const user = db.getUserById(req.session.userId);
  if (!user) {
    req.session = null;
    return res.status(401).json({ error: 'Benutzer existiert nicht mehr.' });
  }

  res.json({ user: { id: user.id, username: user.username } });
});

module.exports = router;

