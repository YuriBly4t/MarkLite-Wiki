const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Database path in data/
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'wiki.db');

const db = new Database(dbPath);

// Performance optimizations
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Base tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
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

  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL, -- 'note' or 'folder'
    item_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    shared_with_user_id INTEGER, -- NULL for public links
    share_token TEXT UNIQUE,     -- used for link sharing
    permission TEXT DEFAULT 'view', -- 'view' or 'edit'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(user_id, is_pinned DESC);
  CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
  CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
  CREATE INDEX IF NOT EXISTS idx_shares_target ON shares(shared_with_user_id);
  CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(share_token);
`);

// Automated schema migrations for existing databases
const userColumns = db.pragma('table_info(users)').map(c => c.name);
if (!userColumns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  db.exec("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)");
}

const noteColumns = db.pragma('table_info(notes)').map(c => c.name);
if (!noteColumns.includes('folder_id')) {
  db.exec("ALTER TABLE notes ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL");
}

// Ensure the first user ever registered is an admin
const adminCheck = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
if (adminCheck.count === 0) {
  db.exec("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)");
}

// --- Tag Helpers ---
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

module.exports = {
  db,

  // --- Users & Auth ---
  hasUsers() {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    return row.count > 0;
  },

  getUserCount() {
    return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  },

  createUser(username, passwordHash) {
    const count = this.getUserCount();
    const role = count === 0 ? 'admin' : 'user';
    const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    const info = stmt.run(username.trim(), passwordHash, role);
    return { id: info.lastInsertRowid, username: username.trim(), role };
  },

  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
  },

  getUserById(id) {
    return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
  },

  getAllUsers(excludeUserId = null) {
    if (excludeUserId) {
      return db.prepare('SELECT id, username, role, created_at FROM users WHERE id != ? ORDER BY username ASC').all(excludeUserId);
    }
    return db.prepare('SELECT id, username, role, created_at FROM users ORDER BY username ASC').all();
  },

  // --- Folders ---
  getFolders(userId) {
    // Folders owned by user
    const stmt = db.prepare(`
      SELECT f.id, f.name, f.created_at, f.user_id,
             COUNT(n.id) as note_count,
             'owner' as access_level,
             NULL as shared_by
      FROM folders f
      LEFT JOIN notes n ON f.id = n.folder_id AND n.is_archived = 0
      WHERE f.user_id = ?
      GROUP BY f.id
      ORDER BY f.name ASC
    `);
    const owned = stmt.all(userId);

    // Folders shared directly with user
    const sharedStmt = db.prepare(`
      SELECT f.id, f.name, f.created_at, f.user_id,
             COUNT(n.id) as note_count,
             s.permission as access_level,
             u.username as shared_by
      FROM shares s
      JOIN folders f ON s.item_id = f.id AND s.item_type = 'folder'
      JOIN users u ON f.user_id = u.id
      LEFT JOIN notes n ON f.id = n.folder_id AND n.is_archived = 0
      WHERE s.shared_with_user_id = ?
      GROUP BY f.id, s.permission, u.username
      ORDER BY f.name ASC
    `);
    const shared = sharedStmt.all(userId);

    return { owned, shared };
  },

  createFolder(userId, name) {
    const cleanName = (name && name.trim()) ? name.trim() : 'New Folder';
    const stmt = db.prepare('INSERT INTO folders (user_id, name) VALUES (?, ?)');
    const info = stmt.run(userId, cleanName);
    return { id: info.lastInsertRowid, user_id: userId, name: cleanName, note_count: 0, access_level: 'owner' };
  },

  updateFolder(folderId, userId, name) {
    const cleanName = (name && name.trim()) ? name.trim() : 'New Folder';
    // Must be owner or have edit permission
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    if (!folder) return null;

    if (folder.user_id !== userId) {
      const share = db.prepare(`
        SELECT * FROM shares 
        WHERE item_type = 'folder' AND item_id = ? AND shared_with_user_id = ? AND permission = 'edit'
      `).get(folderId, userId);
      if (!share) return null;
    }

    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(cleanName, folderId);
    return { id: folderId, name: cleanName };
  },

  deleteFolder(folderId, userId) {
    // Only owner can delete
    const stmt = db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?');
    const result = stmt.run(folderId, userId);
    return result.changes > 0;
  },

  // --- Notes ---
  getNotes(userId, { search = '', tag = '', folderId = null, filter = 'all' } = {}) {
    let query = `
      SELECT n.id, n.user_id, n.folder_id, n.title, n.content, n.is_pinned, n.created_at, n.updated_at,
             f.name as folder_name,
             u.username as owner_name,
             CASE
               WHEN n.user_id = ? THEN 'owner'
               ELSE COALESCE(sn.permission, sf.permission, 'view')
             END as access_level,
             CASE
               WHEN n.user_id != ? THEN u.username
               ELSE NULL
             END as shared_by
      FROM notes n
      LEFT JOIN folders f ON n.folder_id = f.id
      JOIN users u ON n.user_id = u.id
      LEFT JOIN shares sn ON sn.item_type = 'note' AND sn.item_id = n.id AND sn.shared_with_user_id = ?
      LEFT JOIN shares sf ON sf.item_type = 'folder' AND sf.item_id = n.folder_id AND sf.shared_with_user_id = ?
      WHERE n.is_archived = 0
        AND (
          n.user_id = ? 
          OR sn.id IS NOT NULL 
          OR sf.id IS NOT NULL
        )
    `;
    const params = [userId, userId, userId, userId, userId];

    if (filter === 'shared') {
      query += ` AND n.user_id != ?`;
      params.push(userId);
    } else if (filter === 'uncategorized') {
      query += ` AND n.folder_id IS NULL AND n.user_id = ?`;
      params.push(userId);
    } else if (folderId !== null && folderId !== undefined && folderId !== '') {
      query += ` AND n.folder_id = ?`;
      params.push(parseInt(folderId, 10));
    }

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

    return notes.map(note => ({
      ...note,
      tags: getTagsForNote(note.id),
      preview: note.content.replace(/[#*`_\[\]]/g, '').trim().substring(0, 120)
    }));
  },

  getNoteById(id, userId) {
    const query = `
      SELECT n.*, f.name as folder_name, u.username as owner_name,
             CASE
               WHEN n.user_id = ? THEN 'owner'
               ELSE COALESCE(sn.permission, sf.permission, 'view')
             END as access_level,
             CASE
               WHEN n.user_id != ? THEN u.username
               ELSE NULL
             END as shared_by
      FROM notes n
      LEFT JOIN folders f ON n.folder_id = f.id
      JOIN users u ON n.user_id = u.id
      LEFT JOIN shares sn ON sn.item_type = 'note' AND sn.item_id = n.id AND sn.shared_with_user_id = ?
      LEFT JOIN shares sf ON sf.item_type = 'folder' AND sf.item_id = n.folder_id AND sf.shared_with_user_id = ?
      WHERE n.id = ? 
        AND (
          n.user_id = ? 
          OR sn.id IS NOT NULL 
          OR sf.id IS NOT NULL
        )
    `;
    const note = db.prepare(query).get(userId, userId, userId, userId, id, userId);
    if (!note) return null;

    note.tags = getTagsForNote(note.id);
    return note;
  },

  createNote(userId, { title, content, isPinned = 0, tags = [], folderId = null }) {
    const finalTitle = (title && title.trim()) ? title.trim() : 'Untitled';
    const finalFolderId = folderId ? parseInt(folderId, 10) : null;

    const stmt = db.prepare(`
      INSERT INTO notes (user_id, folder_id, title, content, is_pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(userId, finalFolderId, finalTitle, content || '', isPinned ? 1 : 0);
    const noteId = info.lastInsertRowid;

    if (tags && tags.length) {
      syncNoteTags(noteId, tags);
    }

    return this.getNoteById(noteId, userId);
  },

  updateNote(id, userId, { title, content, isPinned, tags, folderId }) {
    const current = this.getNoteById(id, userId);
    if (!current) return null;

    // Must be owner or have 'edit' permission
    if (current.access_level !== 'owner' && current.access_level !== 'edit') {
      return null;
    }

    const newTitle = title !== undefined ? ((title && title.trim()) ? title.trim() : 'Untitled') : current.title;
    const newContent = content !== undefined ? content : current.content;
    const newPinned = isPinned !== undefined ? (isPinned ? 1 : 0) : current.is_pinned;
    const newFolderId = folderId !== undefined ? (folderId ? parseInt(folderId, 10) : null) : current.folder_id;

    const stmt = db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, is_pinned = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(newTitle, newContent, newPinned, newFolderId, id);

    if (tags !== undefined) {
      syncNoteTags(id, tags);
    }

    return this.getNoteById(id, userId);
  },

  deleteNote(id, userId) {
    const current = this.getNoteById(id, userId);
    if (!current || current.access_level !== 'owner') return false;

    const stmt = db.prepare('DELETE FROM notes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  getAllTags(userId) {
    const stmt = db.prepare(`
      SELECT t.name, COUNT(DISTINCT nt.note_id) as count
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      JOIN notes n ON nt.note_id = n.id
      LEFT JOIN shares sn ON sn.item_type = 'note' AND sn.item_id = n.id AND sn.shared_with_user_id = ?
      LEFT JOIN shares sf ON sf.item_type = 'folder' AND sf.item_id = n.folder_id AND sf.shared_with_user_id = ?
      WHERE n.is_archived = 0 AND (n.user_id = ? OR sn.id IS NOT NULL OR sf.id IS NOT NULL)
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
    `);
    return stmt.all(userId, userId, userId);
  },

  // --- Sharing System ---
  createShare(ownerId, { itemType, itemId, targetUserId = null, permission = 'view', isPublic = false }) {
    // Verify user owns the item
    if (itemType === 'note') {
      const note = db.prepare('SELECT user_id FROM notes WHERE id = ?').get(itemId);
      if (!note || note.user_id !== ownerId) return { error: 'Unauthorized' };
    } else if (itemType === 'folder') {
      const folder = db.prepare('SELECT user_id FROM folders WHERE id = ?').get(itemId);
      if (!folder || folder.user_id !== ownerId) return { error: 'Unauthorized' };
    } else {
      return { error: 'Invalid item type' };
    }

    if (isPublic) {
      // Check existing public link
      let existing = db.prepare(`
        SELECT * FROM shares WHERE item_type = ? AND item_id = ? AND share_token IS NOT NULL
      `).get(itemType, itemId);

      if (existing) return existing;

      const token = crypto.randomBytes(16).toString('hex');
      const stmt = db.prepare(`
        INSERT INTO shares (item_type, item_id, owner_id, shared_with_user_id, share_token, permission)
        VALUES (?, ?, ?, NULL, ?, 'view')
      `);
      const info = stmt.run(itemType, itemId, ownerId, token);
      return { id: info.lastInsertRowid, item_type: itemType, item_id: itemId, share_token: token, permission: 'view' };
    }

    // Share with specific user
    if (!targetUserId || targetUserId === ownerId) {
      return { error: 'Invalid target user' };
    }

    // Delete existing share for this user/item if any
    db.prepare(`
      DELETE FROM shares WHERE item_type = ? AND item_id = ? AND shared_with_user_id = ?
    `).run(itemType, itemId, targetUserId);

    const stmt = db.prepare(`
      INSERT INTO shares (item_type, item_id, owner_id, shared_with_user_id, permission)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(itemType, itemId, ownerId, targetUserId, permission);

    return {
      id: info.lastInsertRowid,
      item_type: itemType,
      item_id: itemId,
      shared_with_user_id: targetUserId,
      permission
    };
  },

  getSharesForItem(itemType, itemId, userId) {
    // Verify ownership
    let isOwner = false;
    if (itemType === 'note') {
      const n = db.prepare('SELECT user_id FROM notes WHERE id = ?').get(itemId);
      isOwner = n && n.user_id === userId;
    } else if (itemType === 'folder') {
      const f = db.prepare('SELECT user_id FROM folders WHERE id = ?').get(itemId);
      isOwner = f && f.user_id === userId;
    }

    if (!isOwner) return null;

    const shares = db.prepare(`
      SELECT s.id, s.item_type, s.item_id, s.shared_with_user_id, s.share_token, s.permission, s.created_at,
             u.username as shared_with_username
      FROM shares s
      LEFT JOIN users u ON s.shared_with_user_id = u.id
      WHERE s.item_type = ? AND s.item_id = ?
      ORDER BY s.created_at DESC
    `).all(itemType, itemId);

    return shares;
  },

  deleteShare(shareId, ownerId) {
    const stmt = db.prepare('DELETE FROM shares WHERE id = ? AND owner_id = ?');
    const result = stmt.run(shareId, ownerId);
    return result.changes > 0;
  },

  getPublicItemByToken(token) {
    const share = db.prepare('SELECT * FROM shares WHERE share_token = ?').get(token);
    if (!share) return null;

    if (share.item_type === 'note') {
      const note = db.prepare(`
        SELECT n.id, n.title, n.content, n.updated_at, u.username as author
        FROM notes n
        JOIN users u ON n.user_id = u.id
        WHERE n.id = ? AND n.is_archived = 0
      `).get(share.item_id);
      if (!note) return null;
      note.tags = getTagsForNote(note.id);
      return { type: 'note', data: note };
    } else if (share.item_type === 'folder') {
      const folder = db.prepare(`
        SELECT f.id, f.name, u.username as author
        FROM folders f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = ?
      `).get(share.item_id);
      if (!folder) return null;

      const notes = db.prepare(`
        SELECT id, title, content, updated_at
        FROM notes
        WHERE folder_id = ? AND is_archived = 0
        ORDER BY updated_at DESC
      `).all(share.item_id);

      return { type: 'folder', data: { ...folder, notes } };
    }

    return null;
  },

  // --- Attachments ---
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
