/**
 * MarkLite Wiki - Client Application Logic
 * Supports Multi-User, Folders, Note & Folder Sharing, and Responsive View Modes
 */

// Global State
const state = {
  user: null,
  allUsers: [],
  notes: [],
  folders: { owned: [], shared: [] },
  activeNoteId: null,
  activeFilter: 'all', // 'all' | 'uncategorized' | 'shared' | folderId
  activeTag: null,
  searchQuery: '',
  viewMode: 'split', // 'edit' | 'split' | 'preview'
  saveTimeout: null,
  isSaving: false,
  shareContext: { type: 'note', id: null, title: '' }
};

// DOM Elements
const elements = {
  // Navigation & Drawer
  sidebar: document.getElementById('sidebar'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userNameDisplay: document.getElementById('userNameDisplay'),
  userRoleBadge: document.getElementById('userRoleBadge'),

  // Search & Filters
  searchInput: document.getElementById('searchInput'),
  tagPillsContainer: document.getElementById('tagPillsContainer'),
  allNotesCount: document.getElementById('allNotesCount'),

  // Folders
  addFolderBtn: document.getElementById('addFolderBtn'),
  folderAll: document.getElementById('folderAll'),
  folderUncategorized: document.getElementById('folderUncategorized'),
  folderShared: document.getElementById('folderShared'),
  userFoldersList: document.getElementById('userFoldersList'),
  noteFolderSelect: document.getElementById('noteFolderSelect'),
  sharedInfoBadge: document.getElementById('sharedInfoBadge'),

  // Notes List
  notesListContainer: document.getElementById('notesListContainer'),
  newNoteBtn: document.getElementById('newNoteBtn'),

  // Editor Area
  editorWorkspace: document.getElementById('editorWorkspace'),
  noteTitleInput: document.getElementById('noteTitleInput'),
  noteTagsInput: document.getElementById('noteTagsInput'),
  markdownTextarea: document.getElementById('markdownTextarea'),
  markdownPreview: document.getElementById('markdownPreview'),
  dropOverlay: document.getElementById('dropOverlay'),
  imageFileInput: document.getElementById('imageFileInput'),

  // Actions & Status
  saveStatus: document.getElementById('saveStatus'),
  wordCount: document.getElementById('wordCount'),
  pinNoteBtn: document.getElementById('pinNoteBtn'),
  deleteNoteBtn: document.getElementById('deleteNoteBtn'),
  shareNoteBtn: document.getElementById('shareNoteBtn'),

  // View Switchers
  modeEditBtn: document.getElementById('modeEditBtn'),
  modeSplitBtn: document.getElementById('modeSplitBtn'),
  modePreviewBtn: document.getElementById('modePreviewBtn'),

  // Share Modal
  shareModal: document.getElementById('shareModal'),
  shareModalTitle: document.getElementById('shareModalTitle'),
  closeShareModalBtn: document.getElementById('closeShareModalBtn'),
  doneShareModalBtn: document.getElementById('doneShareModalBtn'),
  tabUsersBtn: document.getElementById('tabUsersBtn'),
  tabPublicBtn: document.getElementById('tabPublicBtn'),
  tabUsersContent: document.getElementById('tabUsersContent'),
  tabPublicContent: document.getElementById('tabPublicContent'),
  shareUserSelect: document.getElementById('shareUserSelect'),
  sharePermissionSelect: document.getElementById('sharePermissionSelect'),
  addShareUserBtn: document.getElementById('addShareUserBtn'),
  activeSharesList: document.getElementById('activeSharesList'),
  publicShareUrlInput: document.getElementById('publicShareUrlInput'),
  copyPublicLinkBtn: document.getElementById('copyPublicLinkBtn'),
  generatePublicLinkBtn: document.getElementById('generatePublicLinkBtn'),

  // Folder Modal
  createFolderModal: document.getElementById('createFolderModal'),
  closeFolderModalBtn: document.getElementById('closeFolderModalBtn'),
  cancelFolderModalBtn: document.getElementById('cancelFolderModalBtn'),
  submitFolderModalBtn: document.getElementById('submitFolderModalBtn'),
  newFolderNameInput: document.getElementById('newFolderNameInput')
};

// ==============================================================================
// 1. Initialization & Authentication
// ==============================================================================
async function initApp() {
  initTheme();

  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();

    if (data.needsSetup) {
      window.location.href = '/setup';
      return;
    }

    if (!data.isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    state.user = data.user;
    if (elements.userNameDisplay) {
      elements.userNameDisplay.textContent = state.user.username;
    }
    if (elements.userRoleBadge) {
      elements.userRoleBadge.textContent = (state.user.role || 'user').toUpperCase();
    }

    setupEventListeners();
    await loadUsers();
    await loadFolders();
    await loadTags();
    await loadNotes();

    // Restore saved view mode or set sensible defaults
    const savedMode = localStorage.getItem('wiki_view_mode');
    if (window.innerWidth <= 868) {
      setViewMode('edit');
    } else {
      setViewMode(savedMode || 'split');
    }

  } catch (err) {
    console.error('Initialization error:', err);
  }
}

async function loadUsers() {
  try {
    const res = await fetch('/api/auth/users');
    if (res.ok) {
      state.allUsers = await res.json();
      populateShareUsersDropdown();
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// ==============================================================================
// 2. Theme Management (Dark / Light Mode)
// ==============================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('wiki_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('wiki_theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  if (!elements.themeToggleBtn) return;
  elements.themeToggleBtn.innerHTML = theme === 'dark'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

// ==============================================================================
// 3. Folders Management
// ==============================================================================
async function loadFolders() {
  try {
    const res = await fetch('/api/folders');
    if (!res.ok) return;

    state.folders = await res.json();
    renderFoldersList();
    renderFolderSelectOptions();
  } catch (err) {
    console.error('Error loading folders:', err);
  }
}

function renderFoldersList() {
  if (!elements.userFoldersList) return;
  elements.userFoldersList.innerHTML = '';

  // Update built-in folder active classes
  [elements.folderAll, elements.folderUncategorized, elements.folderShared].forEach(el => {
    if (el) el.classList.remove('active');
  });

  if (state.activeFilter === 'all') elements.folderAll.classList.add('active');
  else if (state.activeFilter === 'uncategorized') elements.folderUncategorized.classList.add('active');
  else if (state.activeFilter === 'shared') elements.folderShared.classList.add('active');

  // Owned folders
  state.folders.owned.forEach(folder => {
    const item = document.createElement('div');
    item.className = `folder-item ${state.activeFilter === folder.id ? 'active' : ''}`;

    item.innerHTML = `
      <div class="folder-name-wrap">
        <span>📁</span>
        <span class="folder-title">${escapeHtml(folder.name)}</span>
      </div>
      <div class="folder-actions">
        <span class="folder-badge">${folder.note_count || 0}</span>
        <button class="btn btn-ghost btn-icon btn-sm folder-share-btn" title="Share Folder">🔗</button>
        <button class="btn btn-danger-ghost btn-icon btn-sm folder-delete-btn" title="Delete Folder">🗑️</button>
      </div>
    `;

    item.querySelector('.folder-name-wrap').addEventListener('click', () => {
      setFolderFilter(folder.id);
    });

    item.querySelector('.folder-share-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openShareModal('folder', folder.id, folder.name);
    });

    item.querySelector('.folder-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete folder "${folder.name}"? Notes inside will be moved to Uncategorized.`)) {
        await deleteFolder(folder.id);
      }
    });

    elements.userFoldersList.appendChild(item);
  });

  // Shared folders
  if (state.folders.shared.length > 0) {
    const sharedHeader = document.createElement('div');
    sharedHeader.className = 'section-header';
    sharedHeader.style.marginTop = '0.5rem';
    sharedHeader.textContent = 'Shared Folders';
    elements.userFoldersList.appendChild(sharedHeader);

    state.folders.shared.forEach(folder => {
      const item = document.createElement('div');
      item.className = `folder-item ${state.activeFilter === folder.id ? 'active' : ''}`;
      item.innerHTML = `
        <div class="folder-name-wrap">
          <span>👥</span>
          <span class="folder-title">${escapeHtml(folder.name)}</span>
        </div>
        <div class="folder-actions">
          <span class="folder-badge" title="Shared by ${escapeHtml(folder.shared_by)}">${folder.note_count || 0}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        setFolderFilter(folder.id);
      });
      elements.userFoldersList.appendChild(item);
    });
  }
}

function renderFolderSelectOptions() {
  if (!elements.noteFolderSelect) return;
  const currentVal = elements.noteFolderSelect.value;
  elements.noteFolderSelect.innerHTML = '<option value="">None (Uncategorized)</option>';

  state.folders.owned.forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder.id;
    opt.textContent = `📁 ${folder.name}`;
    elements.noteFolderSelect.appendChild(opt);
  });

  state.folders.shared.forEach(folder => {
    if (folder.access_level === 'edit') {
      const opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = `👥 ${folder.name} (${folder.shared_by})`;
      elements.noteFolderSelect.appendChild(opt);
    }
  });

  elements.noteFolderSelect.value = currentVal;
}

function setFolderFilter(filter) {
  state.activeFilter = filter;
  state.activeTag = null;
  loadFolders();
  loadNotes();
}

async function createFolder(name) {
  try {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to create folder');
    await loadFolders();
  } catch (err) {
    console.error(err);
    alert('Failed to create folder.');
  }
}

async function deleteFolder(folderId) {
  try {
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete folder');
    if (state.activeFilter === folderId) {
      state.activeFilter = 'all';
    }
    await loadFolders();
    await loadNotes();
  } catch (err) {
    console.error(err);
    alert('Failed to delete folder.');
  }
}

// ==============================================================================
// 4. Note Management (Load, Create, Filter)
// ==============================================================================
async function loadNotes(autoSelectFirst = true) {
  try {
    let url = '/api/notes?';
    if (state.searchQuery) url += `search=${encodeURIComponent(state.searchQuery)}&`;
    if (state.activeTag) url += `tag=${encodeURIComponent(state.activeTag)}&`;

    if (state.activeFilter === 'uncategorized' || state.activeFilter === 'shared') {
      url += `filter=${state.activeFilter}&`;
    } else if (state.activeFilter !== 'all' && state.activeFilter) {
      url += `folderId=${encodeURIComponent(state.activeFilter)}&`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load notes');

    state.notes = await res.json();
    if (elements.allNotesCount && state.activeFilter === 'all' && !state.searchQuery && !state.activeTag) {
      elements.allNotesCount.textContent = state.notes.length;
    }

    renderNotesList();

    if (state.notes.length === 0) {
      if (!state.searchQuery && !state.activeTag && state.activeFilter === 'all') {
        // Welcome note for brand new setups
        await createNewNote(
          'Welcome to MarkLite Wiki 🚀',
          '# Hello!\n\nWelcome to your personal minimalist Markdown wiki.\n\n### Key Features:\n- **Markdown Formatting**: Headings, lists, tables, checklists, and code blocks.\n- **Insert Images**: Simply paste a screenshot using `Ctrl + V` or drag & drop an image into the editor!\n- **Folders**: Group notes into folders and share them with other users!\n- **Checklists**:\n  - [x] Set up web app\n  - [ ] Write first note\n  - [ ] Try desktop view modes (Write, Split, Preview)\n\nStart writing right away!',
          ['welcome', 'guide']
        );
      } else {
        clearEditor();
      }
    } else if (autoSelectFirst) {
      const exists = state.notes.find(n => n.id === state.activeNoteId);
      if (exists) {
        selectNote(exists.id);
      } else {
        selectNote(state.notes[0].id);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadTags() {
  try {
    const res = await fetch('/api/notes/tags');
    if (!res.ok) return;
    const tags = await res.json();
    renderTags(tags);
  } catch (err) {
    console.error(err);
  }
}

function renderTags(tags) {
  if (!elements.tagPillsContainer) return;
  elements.tagPillsContainer.innerHTML = '';

  const allPill = document.createElement('span');
  allPill.className = `tag-pill ${!state.activeTag ? 'active' : ''}`;
  allPill.textContent = 'All Tags';
  allPill.addEventListener('click', () => {
    state.activeTag = null;
    loadNotes();
    loadTags();
  });
  elements.tagPillsContainer.appendChild(allPill);

  tags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = `tag-pill ${state.activeTag === tag.name ? 'active' : ''}`;
    pill.textContent = `#${tag.name} (${tag.count})`;
    pill.addEventListener('click', () => {
      state.activeTag = state.activeTag === tag.name ? null : tag.name;
      loadNotes();
      loadTags();
    });
    elements.tagPillsContainer.appendChild(pill);
  });
}

function renderNotesList() {
  if (!elements.notesListContainer) return;
  elements.notesListContainer.innerHTML = '';

  if (state.notes.length === 0) {
    elements.notesListContainer.innerHTML = `
      <div style="padding: 2rem 1rem; text-align: center; color: var(--text-dim); font-size: 0.9rem;">
        No notes found
      </div>
    `;
    return;
  }

  state.notes.forEach(note => {
    const item = document.createElement('div');
    item.className = `note-item ${note.id === state.activeNoteId ? 'active' : ''}`;
    item.addEventListener('click', () => {
      selectNote(note.id);
      closeMobileSidebar();
    });

    const titleEl = document.createElement('div');
    titleEl.className = 'note-item-title';

    let prefix = '';
    if (note.is_pinned) prefix += '📌 ';
    if (note.shared_by) prefix += '👥 ';

    titleEl.innerHTML = `${prefix}${escapeHtml(note.title)}`;

    const previewEl = document.createElement('div');
    previewEl.className = 'note-item-preview';
    previewEl.textContent = note.preview || 'No preview available';

    const metaEl = document.createElement('div');
    metaEl.className = 'note-item-meta';

    const dateStr = formatDate(note.updated_at);
    let folderOrSharedTag = '';
    if (note.folder_name) {
      folderOrSharedTag = `<span class="note-item-tag">📁 ${escapeHtml(note.folder_name)}</span>`;
    } else if (note.shared_by) {
      folderOrSharedTag = `<span class="note-item-tag" style="color: var(--accent);">By: ${escapeHtml(note.shared_by)}</span>`;
    }

    metaEl.innerHTML = `
      <span>${dateStr}</span>
      <div class="note-item-tags">${folderOrSharedTag}</div>
    `;

    item.appendChild(titleEl);
    item.appendChild(previewEl);
    item.appendChild(metaEl);
    elements.notesListContainer.appendChild(item);
  });
}

async function selectNote(noteId) {
  state.activeNoteId = noteId;
  renderNotesList();

  try {
    const res = await fetch(`/api/notes/${noteId}`);
    if (!res.ok) throw new Error('Failed to load note');

    const note = await res.json();
    elements.noteTitleInput.value = note.title || '';
    elements.noteTagsInput.value = (note.tags || []).map(t => `#${t}`).join(' ');
    elements.markdownTextarea.value = note.content || '';
    elements.noteFolderSelect.value = note.folder_id || '';

    // Handle read-only / shared permissions
    const isReadOnly = note.access_level === 'view';
    elements.noteTitleInput.readOnly = isReadOnly;
    elements.markdownTextarea.readOnly = isReadOnly;
    elements.noteTagsInput.readOnly = isReadOnly;
    elements.noteFolderSelect.disabled = isReadOnly;

    if (elements.sharedInfoBadge) {
      if (note.shared_by) {
        elements.sharedInfoBadge.textContent = `Shared by ${note.shared_by} (${isReadOnly ? 'Read Only' : 'Can Edit'})`;
        elements.sharedInfoBadge.classList.remove('hidden');
      } else {
        elements.sharedInfoBadge.classList.add('hidden');
      }
    }

    // Hide delete button for non-owners
    if (elements.deleteNoteBtn) {
      elements.deleteNoteBtn.style.display = note.access_level === 'owner' ? 'inline-flex' : 'none';
    }

    updatePinButtonState(note.is_pinned);
    updatePreview();
    updateWordCount();
    setSaveStatus(isReadOnly ? 'Read Only' : 'Saved');

  } catch (err) {
    console.error(err);
  }
}

async function createNewNote(customTitle, customContent, customTags) {
  try {
    const folderId = (typeof state.activeFilter === 'number') ? state.activeFilter : null;

    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: customTitle || 'New Note',
        content: customContent || '',
        tags: customTags || [],
        folderId: folderId
      })
    });

    if (!res.ok) throw new Error('Failed to create note');
    const newNote = await res.json();

    await loadFolders();
    await loadTags();
    await loadNotes(false);
    selectNote(newNote.id);
    closeMobileSidebar();

    if (!customTitle) {
      elements.noteTitleInput.focus();
      elements.noteTitleInput.select();
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteActiveNote() {
  if (!state.activeNoteId) return;

  const current = state.notes.find(n => n.id === state.activeNoteId);
  const title = current ? current.title : 'this note';

  if (!confirm(`Are you sure you want to delete "${title}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/notes/${state.activeNoteId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete note');

    state.activeNoteId = null;
    await loadFolders();
    await loadTags();
    await loadNotes(true);
  } catch (err) {
    console.error(err);
    alert('Failed to delete note.');
  }
}

async function togglePinActiveNote() {
  if (!state.activeNoteId) return;

  const current = state.notes.find(n => n.id === state.activeNoteId);
  if (!current) return;

  const newPinState = !current.is_pinned;

  try {
    const res = await fetch(`/api/notes/${state.activeNoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: newPinState })
    });

    if (!res.ok) throw new Error('Failed to pin note');
    const updated = await res.json();

    updatePinButtonState(updated.is_pinned);
    await loadNotes(false);
  } catch (err) {
    console.error(err);
  }
}

function updatePinButtonState(isPinned) {
  if (!elements.pinNoteBtn) return;
  if (isPinned) {
    elements.pinNoteBtn.classList.add('btn-primary');
    elements.pinNoteBtn.classList.remove('btn-ghost');
    elements.pinNoteBtn.title = 'Unpin note';
  } else {
    elements.pinNoteBtn.classList.remove('btn-primary');
    elements.pinNoteBtn.classList.add('btn-ghost');
    elements.pinNoteBtn.title = 'Pin note';
  }
}

function clearEditor() {
  elements.noteTitleInput.value = '';
  elements.noteTagsInput.value = '';
  elements.markdownTextarea.value = '';
  elements.noteFolderSelect.value = '';
  if (elements.sharedInfoBadge) elements.sharedInfoBadge.classList.add('hidden');
  elements.markdownPreview.innerHTML = '<p style="color: var(--text-dim); text-align: center; margin-top: 3rem;">No note selected</p>';
  setSaveStatus('');
  if (elements.wordCount) elements.wordCount.textContent = '0 words';
}

// ==============================================================================
// 5. Autosave & Live Sync
// ==============================================================================
function scheduleAutosave() {
  if (!state.activeNoteId) return;

  const current = state.notes.find(n => n.id === state.activeNoteId);
  if (current && current.access_level === 'view') return; // Read-only

  setSaveStatus('Saving...');
  clearTimeout(state.saveTimeout);

  state.saveTimeout = setTimeout(async () => {
    await saveActiveNote();
  }, 600);
}

async function saveActiveNote() {
  if (!state.activeNoteId || state.isSaving) return;

  const current = state.notes.find(n => n.id === state.activeNoteId);
  if (current && current.access_level === 'view') return;

  state.isSaving = true;

  const title = elements.noteTitleInput.value;
  const content = elements.markdownTextarea.value;
  const folderId = elements.noteFolderSelect.value || null;
  const rawTags = elements.noteTagsInput.value
    .split(/[\s,]+/)
    .map(t => t.replace(/^#/, '').trim())
    .filter(Boolean);

  try {
    const res = await fetch(`/api/notes/${state.activeNoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        folderId,
        tags: rawTags
      })
    });

    if (!res.ok) throw new Error('Failed to save note');
    const updated = await res.json();

    const noteInState = state.notes.find(n => n.id === updated.id);
    if (noteInState) {
      noteInState.title = updated.title;
      noteInState.tags = updated.tags;
      noteInState.folder_id = updated.folder_id;
      noteInState.folder_name = updated.folder_name;
      noteInState.preview = updated.content.replace(/[#*`_\[\]]/g, '').trim().substring(0, 120);
      noteInState.updated_at = updated.updated_at;
      renderNotesList();
    }

    setSaveStatus('Saved');
  } catch (err) {
    console.error(err);
    setSaveStatus('Failed to save!');
  } finally {
    state.isSaving = false;
  }
}

function setSaveStatus(text) {
  if (elements.saveStatus) {
    elements.saveStatus.textContent = text;
  }
}

function updateWordCount() {
  if (!elements.wordCount) return;
  const text = elements.markdownTextarea.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  elements.wordCount.textContent = `${words} words • ${chars} chars`;
}

function updatePreview() {
  if (!elements.markdownPreview) return;
  const raw = elements.markdownTextarea.value;
  elements.markdownPreview.innerHTML = window.WikiMarkdown.render(raw);
}

// ==============================================================================
// 6. Image Upload (Clipboard & Drag-and-Drop)
// ==============================================================================
async function uploadImageFile(file) {
  if (!state.activeNoteId) {
    alert('Please select a note first.');
    return;
  }

  setSaveStatus('Uploading image...');

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    insertTextAtCursor(`\n![${data.originalName || 'Image'}](${data.url})\n`);
    updatePreview();
    updateWordCount();
    scheduleAutosave();

    setSaveStatus('Image inserted & saved');
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to upload image');
    setSaveStatus('Upload failed');
  }
}

function insertTextAtCursor(textToInsert) {
  const textarea = elements.markdownTextarea;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;

  textarea.value = text.substring(0, start) + textToInsert + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
  textarea.focus();
}

function wrapSelection(before, after) {
  const textarea = elements.markdownTextarea;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);

  const replacement = before + (selected || 'Text') + after;
  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = textarea.selectionStart + (selected || 'Text').length;
  textarea.focus();

  updatePreview();
  updateWordCount();
  scheduleAutosave();
}

// ==============================================================================
// 7. View Modes (Write, Split, Preview) - DESKTOP & MOBILE FIXED
// ==============================================================================
function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('wiki_view_mode', mode);

  elements.editorWorkspace.classList.remove('view-edit', 'view-split', 'view-preview');
  elements.editorWorkspace.classList.add(`view-${mode}`);

  [elements.modeEditBtn, elements.modeSplitBtn, elements.modePreviewBtn].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });

  if (mode === 'edit' && elements.modeEditBtn) elements.modeEditBtn.classList.add('active');
  if (mode === 'split' && elements.modeSplitBtn) elements.modeSplitBtn.classList.add('active');
  if (mode === 'preview' && elements.modePreviewBtn) elements.modePreviewBtn.classList.add('active');

  if (mode === 'split' || mode === 'preview') {
    updatePreview();
  }
}

function openMobileSidebar() {
  elements.sidebar.classList.add('open');
  elements.drawerBackdrop.classList.add('open');
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove('open');
  elements.drawerBackdrop.classList.remove('open');
}

// ==============================================================================
// 8. Sharing Modal & Logic
// ==============================================================================
function populateShareUsersDropdown() {
  if (!elements.shareUserSelect) return;
  elements.shareUserSelect.innerHTML = '<option value="">Select a user...</option>';
  state.allUsers.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.username} (${u.role})`;
    elements.shareUserSelect.appendChild(opt);
  });
}

async function openShareModal(type, id, title) {
  state.shareContext = { type, id, title };
  elements.shareModalTitle.textContent = `Share ${type === 'folder' ? 'Folder' : 'Note'}: "${title}"`;
  elements.publicShareUrlInput.value = '';

  // Switch to Tab 1 by default
  switchShareTab('users');
  elements.shareModal.classList.remove('hidden');

  await loadActiveShares();
}

function switchShareTab(tab) {
  if (tab === 'users') {
    elements.tabUsersBtn.classList.add('active');
    elements.tabPublicBtn.classList.remove('active');
    elements.tabUsersContent.classList.remove('hidden');
    elements.tabPublicContent.classList.add('hidden');
  } else {
    elements.tabUsersBtn.classList.remove('active');
    elements.tabPublicBtn.classList.add('active');
    elements.tabUsersContent.classList.add('hidden');
    elements.tabPublicContent.classList.remove('hidden');
  }
}

async function loadActiveShares() {
  const { type, id } = state.shareContext;
  if (!id) return;

  try {
    const res = await fetch(`/api/shares/item/${type}/${id}`);
    if (!res.ok) return;

    const shares = await res.json();
    elements.activeSharesList.innerHTML = '';

    const userShares = shares.filter(s => s.shared_with_user_id);
    const publicShare = shares.find(s => s.share_token);

    if (publicShare) {
      const fullUrl = `${window.location.origin}/shared/${publicShare.share_token}`;
      elements.publicShareUrlInput.value = fullUrl;
    }

    if (userShares.length === 0) {
      elements.activeSharesList.innerHTML = '<span style="color: var(--text-dim); font-size: 0.85rem;">Not shared with any users yet.</span>';
      return;
    }

    userShares.forEach(share => {
      const item = document.createElement('div');
      item.className = 'share-item';
      item.innerHTML = `
        <div>
          <b>${escapeHtml(share.shared_with_username)}</b> 
          <span style="color: var(--text-muted); font-size: 0.8rem;">(${share.permission === 'edit' ? 'Can Edit' : 'View Only'})</span>
        </div>
        <button class="btn btn-danger-ghost btn-sm revoke-btn">Revoke</button>
      `;

      item.querySelector('.revoke-btn').addEventListener('click', async () => {
        await fetch(`/api/shares/${share.id}`, { method: 'DELETE' });
        await loadActiveShares();
      });

      elements.activeSharesList.appendChild(item);
    });

  } catch (err) {
    console.error('Error loading active shares:', err);
  }
}

async function shareWithSelectedUser() {
  const targetUserId = elements.shareUserSelect.value;
  const permission = elements.sharePermissionSelect.value;
  const { type, id } = state.shareContext;

  if (!targetUserId) {
    alert('Please select a user to share with.');
    return;
  }

  try {
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemType: type,
        itemId: id,
        targetUserId,
        permission
      })
    });

    if (!res.ok) throw new Error('Failed to share item');

    elements.shareUserSelect.value = '';
    await loadActiveShares();
  } catch (err) {
    console.error(err);
    alert('Failed to share item.');
  }
}

async function generatePublicShareLink() {
  const { type, id } = state.shareContext;
  try {
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemType: type,
        itemId: id,
        isPublic: true
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate link');

    const token = data.share.share_token;
    const fullUrl = `${window.location.origin}/shared/${token}`;
    elements.publicShareUrlInput.value = fullUrl;

    navigator.clipboard.writeText(fullUrl);
    alert('Public share link generated and copied to clipboard!');
  } catch (err) {
    console.error(err);
    alert('Failed to generate public share link.');
  }
}

// ==============================================================================
// 9. Event Listeners Setup
// ==============================================================================
function setupEventListeners() {
  // Theme Toggle
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Logout
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  }

  // New Note
  if (elements.newNoteBtn) {
    elements.newNoteBtn.addEventListener('click', () => createNewNote());
  }

  // Built-in Folders Filter clicks
  elements.folderAll.addEventListener('click', () => setFolderFilter('all'));
  elements.folderUncategorized.addEventListener('click', () => setFolderFilter('uncategorized'));
  elements.folderShared.addEventListener('click', () => setFolderFilter('shared'));

  // Add Folder Modal
  elements.addFolderBtn.addEventListener('click', () => {
    elements.newFolderNameInput.value = '';
    elements.createFolderModal.classList.remove('hidden');
    elements.newFolderNameInput.focus();
  });

  const closeFolderModal = () => elements.createFolderModal.classList.add('hidden');
  elements.closeFolderModalBtn.addEventListener('click', closeFolderModal);
  elements.cancelFolderModalBtn.addEventListener('click', closeFolderModal);

  elements.submitFolderModalBtn.addEventListener('click', async () => {
    const name = elements.newFolderNameInput.value.trim();
    if (name) {
      await createFolder(name);
      closeFolderModal();
    }
  });

  elements.newFolderNameInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const name = elements.newFolderNameInput.value.trim();
      if (name) {
        await createFolder(name);
        closeFolderModal();
      }
    }
  });

  // Share Note Modal Trigger
  elements.shareNoteBtn.addEventListener('click', () => {
    if (!state.activeNoteId) {
      alert('Please select a note to share.');
      return;
    }
    const current = state.notes.find(n => n.id === state.activeNoteId);
    openShareModal('note', state.activeNoteId, current ? current.title : 'Note');
  });

  // Share Modal controls
  const closeShareModal = () => elements.shareModal.classList.add('hidden');
  elements.closeShareModalBtn.addEventListener('click', closeShareModal);
  elements.doneShareModalBtn.addEventListener('click', closeShareModal);

  elements.tabUsersBtn.addEventListener('click', () => switchShareTab('users'));
  elements.tabPublicBtn.addEventListener('click', () => switchShareTab('public'));

  elements.addShareUserBtn.addEventListener('click', shareWithSelectedUser);
  elements.generatePublicLinkBtn.addEventListener('click', generatePublicShareLink);

  elements.copyPublicLinkBtn.addEventListener('click', () => {
    const val = elements.publicShareUrlInput.value;
    if (val) {
      navigator.clipboard.writeText(val);
      alert('Link copied to clipboard!');
    }
  });

  // Search Input
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      loadNotes(false);
    });
  }

  // Mobile Drawer
  if (elements.mobileMenuBtn) {
    elements.mobileMenuBtn.addEventListener('click', openMobileSidebar);
  }
  if (elements.closeSidebarBtn) {
    elements.closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  }
  if (elements.drawerBackdrop) {
    elements.drawerBackdrop.addEventListener('click', closeMobileSidebar);
  }

  // Editor Inputs & Autosave
  elements.noteTitleInput.addEventListener('input', scheduleAutosave);
  elements.noteTagsInput.addEventListener('input', scheduleAutosave);
  elements.noteFolderSelect.addEventListener('change', scheduleAutosave);

  elements.markdownTextarea.addEventListener('input', () => {
    updatePreview();
    updateWordCount();
    scheduleAutosave();
  });

  // Note Actions
  if (elements.pinNoteBtn) elements.pinNoteBtn.addEventListener('click', togglePinActiveNote);
  if (elements.deleteNoteBtn) elements.deleteNoteBtn.addEventListener('click', deleteActiveNote);

  // View Mode Switchers (Desktop and Mobile)
  if (elements.modeEditBtn) elements.modeEditBtn.addEventListener('click', () => setViewMode('edit'));
  if (elements.modeSplitBtn) elements.modeSplitBtn.addEventListener('click', () => setViewMode('split'));
  if (elements.modePreviewBtn) elements.modePreviewBtn.addEventListener('click', () => setViewMode('preview'));

  // Clipboard Paste (Ctrl+V) for Images
  elements.markdownTextarea.addEventListener('paste', (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          uploadImageFile(file);
        }
        break;
      }
    }
  });

  // Drag & Drop for Images
  const dropZone = elements.editorWorkspace;
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.dropOverlay.classList.add('active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.dropOverlay.classList.remove('active');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        uploadImageFile(file);
      } else {
        alert('Only image files (PNG, JPG, WebP, GIF, SVG, BMP) can be inserted.');
      }
    }
  });

  // Toolbar Image Button
  if (elements.imageFileInput) {
    elements.imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadImageFile(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  // Keyboard Shortcuts (Ctrl+S / Cmd+S)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveActiveNote();
    }
  });

  // Toolbar Formatting Buttons
  setupToolbarButtons();
}

function setupToolbarButtons() {
  document.querySelectorAll('[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.getAttribute('data-format');
      switch (format) {
        case 'bold': wrapSelection('**', '**'); break;
        case 'italic': wrapSelection('*', '*'); break;
        case 'h1': wrapSelection('# ', ''); break;
        case 'h2': wrapSelection('## ', ''); break;
        case 'h3': wrapSelection('### ', ''); break;
        case 'list': wrapSelection('- ', ''); break;
        case 'task': wrapSelection('- [ ] ', ''); break;
        case 'code': wrapSelection('```\n', '\n```'); break;
        case 'link': wrapSelection('[', '](https://)'); break;
        case 'image':
          if (elements.imageFileInput) elements.imageFileInput.click();
          break;
      }
    });
  });
}

// ==============================================================================
// 10. Utility Functions
// ==============================================================================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Start application
document.addEventListener('DOMContentLoaded', initApp);
