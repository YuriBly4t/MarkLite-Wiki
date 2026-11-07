const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Get all folders (owned and shared)
router.get('/', (req, res) => {
  try {
    const folders = db.getFolders(req.session.userId);
    res.json(folders);
  } catch (err) {
    console.error('Error fetching folders:', err);
    res.status(500).json({ error: 'Failed to load folders.' });
  }
});

// Create new folder
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }
    const folder = db.createFolder(req.session.userId, name);
    res.status(201).json(folder);
  } catch (err) {
    console.error('Error creating folder:', err);
    res.status(500).json({ error: 'Failed to create folder.' });
  }
});

// Update folder name
router.put('/:id', (req, res) => {
  try {
    const folderId = parseInt(req.params.id, 10);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }

    const updated = db.updateFolder(folderId, req.session.userId, name);
    if (!updated) {
      return res.status(403).json({ error: 'Folder not found or insufficient permissions.' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating folder:', err);
    res.status(500).json({ error: 'Failed to update folder.' });
  }
});

// Delete folder
router.delete('/:id', (req, res) => {
  try {
    const folderId = parseInt(req.params.id, 10);
    const success = db.deleteFolder(folderId, req.session.userId);
    if (!success) {
      return res.status(403).json({ error: 'Folder not found or not owner.' });
    }
    res.json({ success: true, message: 'Folder deleted.' });
  } catch (err) {
    console.error('Error deleting folder:', err);
    res.status(500).json({ error: 'Failed to delete folder.' });
  }
});

module.exports = router;
