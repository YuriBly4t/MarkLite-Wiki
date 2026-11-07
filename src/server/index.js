const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cookieSession = require('cookie-session');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_session_secret_change_in_production';

// Grundlegende Sicherheits-Header
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// JSON & Form Parser
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Sitzungsverwaltung über signierte Cookies
app.use(cookieSession({
  name: 'wiki_session',
  keys: [SESSION_SECRET],
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Tage gültig
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true' // In reinem HTTP false, hinter HTTPS true
}));

// Healthcheck für Docker / CasaOS
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// API-Routen
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/uploads', uploadRoutes); // Alias für den Bild-Abruf

// Statische Dateien ausliefern
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// Spezifische Seiten-Routen
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/setup', (req, res) => {
  res.sendFile(path.join(publicDir, 'setup.html'));
});

// Single Page Application Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Fehlerbehandlung (inkl. Multer-Dateigrößenfehler)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Die Datei ist zu groß. Bitte ein kleineres Bild wählen.' });
  }
  console.error('Serverfehler:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Ein unerwarteter Fehler ist aufgetreten.' });
});

// Server starten
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 WikiAlternative läuft auf http://0.0.0.0:${PORT}`);
  console.log(`📂 Modus: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
});

