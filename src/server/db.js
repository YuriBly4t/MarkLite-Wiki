const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Pfad zur Datenbankdatei in data/
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'wiki.db');

const db = new Database(dbPath);

// Performance-Optimierungen für SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tabellen initialisieren
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY(note_id, tag_id),
    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(user_id, is_pinned DESC);
`);

// --- Hilfsfunktionen für Tags ---
function syncNoteTags(noteId, tagNames) {
  const deleteStmt = db.prepare('DELETE FROM note_tags WHERE note_id = ?');
  deleteStmt.run(noteId);

  if (!tagNames || !Array.isArray(tagNames) || tagNames.length === 0) return;

  const insertTagStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTagStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
  const linkStmt = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');

  for (let rawName of tagNames) {
    const cleanName = rawName.trim().replace(/^#/, '').toLowerCase();
    if (cleanName.length > 0) {
      insertTagStmt.run(cleanName);
      const tagRow = getTagStmt.get(cleanName);
      if (tagRow) {
        linkStmt.run(noteId, tagRow.id);
      }
    }
  }
}

function getTagsForNote(noteId) {
  const stmt = db.prepare(`
    SELECT t.name 
    FROM tags t
    JOIN note_tags nt ON t.id = nt.tag_id
    WHERE nt.note_id = ?
    ORDER BY t.name ASC
  `);
  return stmt.all(noteId).map(row => row.name);
}

// --- Exportierte Datenbank-Methoden ---
module.exports = {
  db,

  // Prüft, ob bereits ein Admin angelegt wurde (für den Setup-Wizard)
  hasUsers() {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    return row.count > 0;
  },

  createUser(username, passwordHash) {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const info = stmt.run(username.trim(), passwordHash);
    return { id: info.lastInsertRowid, username: username.trim() };
  },

  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
  },

  getUserById(id) {
    return db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(id);
  },

  // Notizen abfragen
  getNotes(userId, { search = '', tag = '' } = {}) {
    let query = `
      SELECT n.id, n.title, n.content, n.is_pinned, n.created_at, n.updated_at
      FROM notes n
      WHERE n.user_id = ? AND n.is_archived = 0
    `;
    const params = [userId];

    if (tag && tag.trim()) {
      query += `
        AND n.id IN (
          SELECT nt.note_id FROM note_tags nt
          JOIN tags t ON nt.tag_id = t.id
          WHERE t.name = ? COLLATE NOCASE
        )
      `;
      params.push(tag.trim().toLowerCase());
    }

    if (search && search.trim()) {
      query += ` AND (n.title LIKE ? OR n.content LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    query += ` ORDER BY n.is_pinned DESC, n.updated_at DESC`;

    const notes = db.prepare(query).all(...params);

    // Tags zu jeder Notiz anhängen
    return notes.map(note => {
      return {
        ...note,
        tags: getTagsForNote(note.id),
        // Vorschautext für die Seitenleiste
        preview: note.content.replace(/[#*`_\[\]]/g, '').trim().substring(0, 120)
      };
    });
  },

  getNoteById(id, userId) {
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId);
    if (!note) return null;
    note.tags = getTagsForNote(note.id);
    return note;
  },

  createNote(userId, { title, content, isPinned = 0, tags = [] }) {
    const finalTitle = (title && title.trim()) ? title.trim() : 'Ohne Titel';
    const stmt = db.prepare(`
      INSERT INTO notes (user_id, title, content, is_pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(userId, finalTitle, content || '', isPinned ? 1 : 0);
    const noteId = info.lastInsertRowid;

    if (tags && tags.length) {
      syncNoteTags(noteId, tags);
    }

    return this.getNoteById(noteId, userId);
  },

  updateNote(id, userId, { title, content, isPinned, tags }) {
    const current = this.getNoteById(id, userId);
    if (!current) return null;

    const newTitle = title !== undefined ? ((title && title.trim()) ? title.trim() : 'Ohne Titel') : current.title;
    const newContent = content !== undefined ? content : current.content;
    const newPinned = isPinned !== undefined ? (isPinned ? 1 : 0) : current.is_pinned;

    const stmt = db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);
    stmt.run(newTitle, newContent, newPinned, id, userId);

    if (tags !== undefined) {
      syncNoteTags(id, tags);
    }

    return this.getNoteById(id, userId);
  },

  deleteNote(id, userId) {
    const stmt = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  getAllTags(userId) {
    const stmt = db.prepare(`
      SELECT t.name, COUNT(nt.note_id) as count
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      JOIN notes n ON nt.note_id = n.id
      WHERE n.user_id = ? AND n.is_archived = 0
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
    `);
    return stmt.all(userId);
  },

  saveAttachment(userId, { filename, originalName, mimeType, fileSize }) {
    const stmt = db.prepare(`
      INSERT INTO attachments (user_id, filename, original_name, mime_type, file_size)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(userId, filename, originalName, mimeType, fileSize);
    return {
      id: info.lastInsertRowid,
      filename,
      originalName,
      url: `/api/uploads/${filename}`
    };
  }
};

