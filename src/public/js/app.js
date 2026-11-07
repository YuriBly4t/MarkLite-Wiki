/**
 * WikiAlternative - Client-Side Applikationslogik
 */

// Globaler Zustand
const state = {
  user: null,
  notes: [],
  activeNoteId: null,
  activeTag: null,
  searchQuery: '',
  viewMode: 'split', // 'edit' | 'split' | 'preview'
  saveTimeout: null,
  isSaving: false
};

// DOM-Elemente
const elements = {
  // Navigation & Drawer
  sidebar: document.getElementById('sidebar'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userNameDisplay: document.getElementById('userNameDisplay'),

  // Listen & Suche
  searchInput: document.getElementById('searchInput'),
  tagPillsContainer: document.getElementById('tagPillsContainer'),
  notesListContainer: document.getElementById('notesListContainer'),
  newNoteBtn: document.getElementById('newNoteBtn'),

  // Editor-Bereich
  editorWorkspace: document.getElementById('editorWorkspace'),
  noteTitleInput: document.getElementById('noteTitleInput'),
  noteTagsInput: document.getElementById('noteTagsInput'),
  markdownTextarea: document.getElementById('markdownTextarea'),
  markdownPreview: document.getElementById('markdownPreview'),
  dropOverlay: document.getElementById('dropOverlay'),
  imageFileInput: document.getElementById('imageFileInput'),

  // Aktionen & Status
  saveStatus: document.getElementById('saveStatus'),
  wordCount: document.getElementById('wordCount'),
  pinNoteBtn: document.getElementById('pinNoteBtn'),
  deleteNoteBtn: document.getElementById('deleteNoteBtn'),

  // Ansichts-Umschalter
  modeEditBtn: document.getElementById('modeEditBtn'),
  modeSplitBtn: document.getElementById('modeSplitBtn'),
  modePreviewBtn: document.getElementById('modePreviewBtn')
};

// ==============================================================================
// 1. Initialisierung & Authentifizierung
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

    setupEventListeners();
    await loadTags();
    await loadNotes();

    // Ansichtsmodus für kleine Bildschirme initialisieren
    if (window.innerWidth <= 868) {
      setViewMode('edit');
    } else {
      setViewMode('split');
    }

  } catch (err) {
    console.error('Initialisierungsfehler:', err);
  }
}

// ==============================================================================
// 2. Theme-Verwaltung (Dark / Light Mode)
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
// 3. Notizen-Verwaltung (Laden, Erstellen, Filtern)
// ==============================================================================
async function loadNotes(autoSelectFirst = true) {
  try {
    let url = '/api/notes?';
    if (state.searchQuery) url += `search=${encodeURIComponent(state.searchQuery)}&`;
    if (state.activeTag) url += `tag=${encodeURIComponent(state.activeTag)}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Fehler beim Laden der Notizen');

    state.notes = await res.json();
    renderNotesList();

    if (state.notes.length === 0) {
      if (!state.searchQuery && !state.activeTag) {
        // Erste Willkommens-Notiz anlegen
        await createNewNote(
          'Willkommen bei WikiAlternative 🚀',
          '# Hallo!\n\nDies ist deine erste Notiz in deinem persönlichen Markdown-Wiki.\n\n### Wichtigste Funktionen:\n- **Markdown-Formatierung**: Überschriften, Listen, Tabellen und Codeblöcke.\n- **Bilder einfügen**: Einfach einen Screenshot mit `Strg + V` einfügen oder ein Bild hineinziehen (Drag & Drop)!\n- **Checklisten**:\n  - [x] WebApp aufsetzen\n  - [ ] Erste Notiz schreiben\n  - [ ] Bild einfügen\n\nSchreibe einfach los!',
          ['willkommen', 'tutorial']
        );
      } else {
        clearEditor();
      }
    } else if (autoSelectFirst) {
      // Wenn aktuelle Notiz noch in der Liste ist, beibehalten, sonst erste wählen
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

  // "Alle"-Pill
  const allPill = document.createElement('span');
  allPill.className = `tag-pill ${!state.activeTag ? 'active' : ''}`;
  allPill.textContent = 'Alle';
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
        Keine Notizen gefunden
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
    if (note.is_pinned) {
      titleEl.innerHTML = `<span title="Angepinnt">📌</span> ${escapeHtml(note.title)}`;
    } else {
      titleEl.textContent = note.title;
    }

    const previewEl = document.createElement('div');
    previewEl.className = 'note-item-preview';
    previewEl.textContent = note.preview || 'Keine Vorschau verfügbar';

    const metaEl = document.createElement('div');
    metaEl.className = 'note-item-meta';

    const dateStr = formatDate(note.updated_at);
    const tagsHtml = (note.tags || []).slice(0, 3).map(t => `<span class="note-item-tag">#${escapeHtml(t)}</span>`).join('');

    metaEl.innerHTML = `
      <span>${dateStr}</span>
      <div class="note-item-tags">${tagsHtml}</div>
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
    if (!res.ok) throw new Error('Notiz konnte nicht geladen werden');

    const note = await res.json();
    elements.noteTitleInput.value = note.title || '';
    elements.noteTagsInput.value = (note.tags || []).map(t => `#${t}`).join(' ');
    elements.markdownTextarea.value = note.content || '';

    updatePinButtonState(note.is_pinned);
    updatePreview();
    updateWordCount();
    setSaveStatus('Gespeichert');

  } catch (err) {
    console.error(err);
  }
}

async function createNewNote(customTitle, customContent, customTags) {
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: customTitle || 'Neue Notiz',
        content: customContent || '',
        tags: customTags || []
      })
    });

    if (!res.ok) throw new Error('Fehler beim Anlegen');
    const newNote = await res.json();

    await loadTags();
    await loadNotes(false);
    selectNote(newNote.id);
    closeMobileSidebar();

    // Fokus auf Editor setzen
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
  const title = current ? current.title : 'diese Notiz';

  if (!confirm(`Möchtest du "${title}" wirklich löschen?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/notes/${state.activeNoteId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Fehler beim Löschen');

    state.activeNoteId = null;
    await loadTags();
    await loadNotes(true);
  } catch (err) {
    console.error(err);
    alert('Fehler beim Löschen der Notiz.');
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

    if (!res.ok) throw new Error('Fehler beim Pinnen');
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
    elements.pinNoteBtn.title = 'Notiz entpinnen';
  } else {
    elements.pinNoteBtn.classList.remove('btn-primary');
    elements.pinNoteBtn.classList.add('btn-ghost');
    elements.pinNoteBtn.title = 'Notiz anpinnen';
  }
}

function clearEditor() {
  elements.noteTitleInput.value = '';
  elements.noteTagsInput.value = '';
  elements.markdownTextarea.value = '';
  elements.markdownPreview.innerHTML = '<p style="color: var(--text-dim); text-align: center; margin-top: 3rem;">Keine Notiz ausgewählt</p>';
  setSaveStatus('');
  if (elements.wordCount) elements.wordCount.textContent = '0 Wörter';
}

// ==============================================================================
// 4. Autosave & Live-Synchronisierung
// ==============================================================================
function scheduleAutosave() {
  if (!state.activeNoteId) return;

  setSaveStatus('Wird gespeichert...');
  clearTimeout(state.saveTimeout);

  state.saveTimeout = setTimeout(async () => {
    await saveActiveNote();
  }, 600);
}

async function saveActiveNote() {
  if (!state.activeNoteId || state.isSaving) return;

  state.isSaving = true;

  const title = elements.noteTitleInput.value;
  const content = elements.markdownTextarea.value;
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
        tags: rawTags
      })
    });

    if (!res.ok) throw new Error('Fehler beim Speichern');
    const updated = await res.json();

    // Titel und Vorschau in der Seitenleiste aktualisieren
    const noteInState = state.notes.find(n => n.id === updated.id);
    if (noteInState) {
      noteInState.title = updated.title;
      noteInState.tags = updated.tags;
      noteInState.preview = updated.content.replace(/[#*`_\[\]]/g, '').trim().substring(0, 120);
      noteInState.updated_at = updated.updated_at;
      renderNotesList();
    }

    setSaveStatus('Gespeichert');
  } catch (err) {
    console.error(err);
    setSaveStatus('Fehler beim Speichern!');
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
  elements.wordCount.textContent = `${words} Wörter • ${chars} Zeichen`;
}

function updatePreview() {
  if (!elements.markdownPreview) return;
  const raw = elements.markdownTextarea.value;
  elements.markdownPreview.innerHTML = window.WikiMarkdown.render(raw);
}

// ==============================================================================
// 5. Bild-Upload (Clipboard Paste & Drag & Drop)
// ==============================================================================
async function uploadImageFile(file) {
  if (!state.activeNoteId) {
    alert('Bitte wähle zuerst eine Notiz aus.');
    return;
  }

  setSaveStatus('Bild wird hochgeladen...');

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Upload fehlgeschlagen');
    }

    // Markdown-Bildcode an der Cursor-Position einfügen
    insertTextAtCursor(`\n![${data.originalName || 'Bild'}](${data.url})\n`);
    updatePreview();
    updateWordCount();
    scheduleAutosave();

    setSaveStatus('Bild eingefügt & gespeichert');
  } catch (err) {
    console.error(err);
    alert(err.message || 'Fehler beim Hochladen des Bildes');
    setSaveStatus('Upload fehlgeschlagen');
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
// 6. Ansichtsmodus & Responsive Drawer
// ==============================================================================
function setViewMode(mode) {
  state.viewMode = mode;

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
// 7. Event-Listener Einrichten
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

  // Neue Notiz
  if (elements.newNoteBtn) {
    elements.newNoteBtn.addEventListener('click', () => createNewNote());
  }

  // Suche
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

  // Editor Inputs
  elements.noteTitleInput.addEventListener('input', scheduleAutosave);
  elements.noteTagsInput.addEventListener('input', scheduleAutosave);

  elements.markdownTextarea.addEventListener('input', () => {
    updatePreview();
    updateWordCount();
    scheduleAutosave();
  });

  // Notiz-Aktionen
  if (elements.pinNoteBtn) elements.pinNoteBtn.addEventListener('click', togglePinActiveNote);
  if (elements.deleteNoteBtn) elements.deleteNoteBtn.addEventListener('click', deleteActiveNote);

  // Ansichtsmodus
  if (elements.modeEditBtn) elements.modeEditBtn.addEventListener('click', () => setViewMode('edit'));
  if (elements.modeSplitBtn) elements.modeSplitBtn.addEventListener('click', () => setViewMode('split'));
  if (elements.modePreviewBtn) elements.modePreviewBtn.addEventListener('click', () => setViewMode('preview'));

  // --- Clipboard Paste (Ctrl+V) für Bilder ---
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

  // --- Drag & Drop für Bilder ---
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
        alert('Nur Bilddateien (PNG, JPG, WebP, GIF, SVG) können eingefügt werden.');
      }
    }
  });

  // Toolbar Image-Button
  if (elements.imageFileInput) {
    elements.imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadImageFile(e.target.files[0]);
        e.target.value = ''; // Reset für erneute Auswahl
      }
    });
  }

  // Keyboard Shortcuts (Strg+S)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveActiveNote();
    }
  });

  // Toolbar Formatierungs-Buttons
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
// 8. Hilfsfunktionen
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
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

// App starten
document.addEventListener('DOMContentLoaded', initApp);

