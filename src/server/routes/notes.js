const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// All notes endpoints require authentication
router.use(requireAuth);

// List all notes (optional search and tag filtering)
router.get('/', (req, res) => {
  try {
    const { search, tag } = req.query;
    const notes = db.getNotes(req.session.userId, { search, tag });
    res.json(notes);
  } catch (err) {
    console.error('Error loading notes:', err);
    res.status(500).json({ error: 'Failed to load notes.' });
  }
});

// All tags for current user
router.get('/tags', (req, res) => {
  try {
    const tags = db.getAllTags(req.session.userId);
    res.json(tags);
  } catch (err) {
    console.error('Error loading tags:', err);
    res.status(500).json({ error: 'Failed to load tags.' });
  }
});

// Get single note by ID
router.get('/:id', (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const note = db.getNoteById(noteId, req.session.userId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }
    res.json(note);
  } catch (err) {
    console.error('Error retrieving note:', err);
    res.status(500).json({ error: 'Failed to retrieve note.' });
  }
});

// Create new note
router.post('/', (req, res) => {
  try {
    const { title, content, isPinned, tags } = req.body;
    const note = db.createNote(req.session.userId, {
      title,
      content,
      isPinned,
      tags
    });
    res.status(201).json(note);
  } catch (err) {
    console.error('Error creating note:', err);
    res.status(500).json({ error: 'Failed to create note.' });
  }
});

// Update note
router.put('/:id', (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const { title, content, isPinned, tags } = req.body;

    const updated = db.updateNote(noteId, req.session.userId, {
      title,
      content,
      isPinned,
      tags
    });

    if (!updated) {
      return res.status(404).json({ error: 'Note not found or unauthorized.' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating note:', err);
    res.status(500).json({ error: 'Failed to update note.' });
  }
});

// Delete note
router.delete('/:id', (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const success = db.deleteNote(noteId, req.session.userId);

    if (!success) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    res.json({ success: true, message: 'Note deleted successfully.' });
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ error: 'Failed to delete note.' });
  }
});

module.exports = router;
