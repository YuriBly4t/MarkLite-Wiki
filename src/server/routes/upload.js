const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Upload-Verzeichnis
const uploadsDir = path.resolve(__dirname, '../../../data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Speicher-Konfiguration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const randomName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, randomName);
  }
});

// Nur Bilddateien erlauben
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Ungültiger Dateityp. Nur Bilder (PNG, JPG, WebP, GIF, SVG) sind erlaubt.'), false);
  }
};

const maxUploadMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 25;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxUploadMb * 1024 * 1024
  }
});

// Upload-Endpunkt (Drag&Drop oder Paste)
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Bilddatei empfangen.' });
  }

  try {
    const attachment = db.saveAttachment(req.session.userId, {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size
    });

    res.status(201).json({
      success: true,
      url: `/api/uploads/${req.file.filename}`,
      filename: req.file.filename,
      originalName: req.file.originalname
    });
  } catch (err) {
    console.error('Fehler beim Speichern des Datei-Metadatensatzes:', err);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Bildes.' });
  }
});

// Hochgeladenes Bild ausliefern (mit Session-Prüfung)
router.get('/:filename', requireAuth, (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Bild nicht gefunden.' });
  }

  res.sendFile(filePath);
});

module.exports = router;

