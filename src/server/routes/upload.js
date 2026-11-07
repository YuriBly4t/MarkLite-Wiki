const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Upload directory
const uploadsDir = path.resolve(__dirname, '../../../data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage configuration
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

// File type filter: images only
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (PNG, JPG, WebP, GIF, SVG, BMP) are allowed.'), false);
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

// Image upload endpoint (Drag & Drop or Clipboard Paste)
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file received.' });
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
    console.error('Error saving attachment metadata:', err);
    res.status(500).json({ error: 'Failed to process image upload.' });
  }
});

// Serve uploaded image file
router.get('/:filename', requireAuth, (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found.' });
  }

  res.sendFile(filePath);
});

module.exports = router;
