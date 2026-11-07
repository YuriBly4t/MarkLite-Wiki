const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Alle Notizen-Routen erfordern Login
router.use(requireAuth);

// Liste aller Notizen (mit optionaler Suche und Tag-Filter)
router.get('/', (req, res) => {
  try {
    const { search, tag } = req.query;
    const notes = db.getNotes(req.session.userId, { search, tag });
    res.json(notes);
  } catch (err) {
    console.error('Fehler beim Laden der Notizen:', err);
    res.status(500).json({ error: 'Notizen konnten nicht geladen werden.' });
  }
});

// Alle Tags des Nutzers
router.get('/tags', (req, res) => {
  try {
    const tags = db.getAllTags(req.session.userId);
    res.json(tags);
  } catch (err) {
    console.error('Fehler beim Laden der Tags:', err);
    res.status(500).json({ error: 'Tags konnten nicht geladen werden.' });
  }
});

// Einzelne Notiz laden
router.get('/:id', (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const note = db.getNoteById(noteId, req.session.userId);
    if (!note) {
      return res.status(404).json({ error: 'Notiz nicht gefunden.' });
    }
    res.json(note);
  } catch (err) {
    console.error('Fehler beim Abrufen der Notiz:', err);
    res.status(500).json({ error: 'Notiz konnte nicht geladen werden.' });
  }
});

// Neue Notiz anlegen
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
    console.error('Fehler beim Erstellen der Notiz:', err);
    res.status(500).json({ error: 'Notiz konnte nicht gespeichert werden.' });
  }
});

// Notiz aktualisieren
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
      return res.status(404).json({ error: 'Notiz nicht gefunden oder keine Berechtigung.' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Fehler beim Aktualisieren der Notiz:', err);
    res.status(500).json({ error: 'Notiz konnte nicht aktualisiert werden.' });
  }
});

// Notiz löschen
router.delete('/:id', (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const success = db.deleteNote(noteId, req.session.userId);

    if (!success) {
      return res.status(404).json({ error: 'Notiz nicht gefunden.' });
    }

    res.json({ success: true, message: 'Notiz gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen der Notiz:', err);
    res.status(500).json({ error: 'Notiz konnte nicht gelöscht werden.' });
  }
});

module.exports = router;

