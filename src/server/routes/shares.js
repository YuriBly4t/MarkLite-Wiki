const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Public link access (No login required)
router.get('/public/:token', (req, res) => {
  try {
    const { token } = req.params;
    const item = db.getPublicItemByToken(token);

    if (!item) {
      return res.status(404).json({ error: 'Shared link not found or has expired.' });
    }

    res.json(item);
  } catch (err) {
    console.error('Error fetching public item:', err);
    res.status(500).json({ error: 'Failed to retrieve shared content.' });
  }
});

// All following share management routes require authentication
router.use(requireAuth);

// Get list of active shares for a specific note or folder
router.get('/item/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;
    const itemId = parseInt(id, 10);

    const shares = db.getSharesForItem(type, itemId, req.session.userId);
    if (shares === null) {
      return res.status(403).json({ error: 'You are not the owner of this item.' });
    }

    res.json(shares);
  } catch (err) {
    console.error('Error fetching shares:', err);
    res.status(500).json({ error: 'Failed to fetch shares.' });
  }
});

// Create a new share (with a user or as a public link)
router.post('/', (req, res) => {
  try {
    const { itemType, itemId, targetUserId, permission = 'view', isPublic = false } = req.body;

    if (!itemType || !itemId) {
      return res.status(400).json({ error: 'itemType and itemId are required.' });
    }

    const result = db.createShare(req.session.userId, {
      itemType,
      itemId: parseInt(itemId, 10),
      targetUserId: targetUserId ? parseInt(targetUserId, 10) : null,
      permission: permission === 'edit' ? 'edit' : 'view',
      isPublic: !!isPublic
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({ success: true, share: result });
  } catch (err) {
    console.error('Error creating share:', err);
    res.status(500).json({ error: 'Failed to share item.' });
  }
});

// Revoke / delete a share
router.delete('/:id', (req, res) => {
  try {
    const shareId = parseInt(req.params.id, 10);
    const success = db.deleteShare(shareId, req.session.userId);

    if (!success) {
      return res.status(403).json({ error: 'Share not found or you are not the owner.' });
    }

    res.json({ success: true, message: 'Share revoked successfully.' });
  } catch (err) {
    console.error('Error deleting share:', err);
    res.status(500).json({ error: 'Failed to revoke share.' });
  }
});

module.exports = router;
