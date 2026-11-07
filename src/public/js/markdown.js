/**
 * WikiAlternative - Autarker, sicherer Markdown-Parser (Keine CDN-Abhängigkeit)
 * Unterstützt Überschriften, Listen, Checkboxen, Codeblöcke, Bilder, Links, Tabellen und Zitate.
 */
(function(window) {
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseMarkdown(md) {
    if (!md) return '';

    // Zeilenumbrüche vereinheitlichen
    let text = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Codeblöcke vorübergehend maskieren
    const codeBlocks = [];
    text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push({ lang, code: escapeHtml(code.trim()) });
      return id;
    });

    // Inline-Code maskieren
    const inlineCodes = [];
    text = text.replace(/`([^`\n]+)`/g, (match, code) => {
      const id = `__INLINE_CODE_${inlineCodes.length}__`;
      inlineCodes.push(escapeHtml(code));
      return id;
    });

    // Zeilenweise verarbeiten
    const lines = text.split('\n');
    const result = [];
    let inList = false;
    let listType = null;
    let inBlockquote = false;
    let inTable = false;
    let tableHeaders = [];

    function closeList() {
      if (inList) {
        result.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
    }

    function closeBlockquote() {
      if (inBlockquote) {
        result.push('</blockquote>');
        inBlockquote = false;
      }
    }

    function closeTable() {
      if (inTable) {
        result.push('</tbody></table>');
        inTable = false;
        tableHeaders = [];
      }
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Horizontale Linie (--- oder ***)
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        closeList();
        closeBlockquote();
        closeTable();
        result.push('<hr>');
        continue;
      }

      // Überschriften (# bis ######)
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        closeList();
        closeBlockquote();
        closeTable();
        const level = headingMatch[1].length;
        const content = formatInline(headingMatch[2]);
        result.push(`<h${level}>${content}</h${level}>`);
        continue;
      }

      // Zitate (> Zitat)
      const bqMatch = line.match(/^>\s?(.*)$/);
      if (bqMatch) {
        closeList();
        closeTable();
        if (!inBlockquote) {
          result.push('<blockquote>');
          inBlockquote = true;
        }
        result.push(`<p>${formatInline(bqMatch[1])}</p>`);
        continue;
      } else {
        closeBlockquote();
      }

      // Checklisten / Tasklisten (- [ ] oder - [x])
      const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        closeBlockquote();
        closeTable();
        if (!inList || listType !== 'ul') {
          closeList();
          result.push('<ul class="task-list" style="list-style: none; padding-left: 0;">');
          inList = true;
          listType = 'ul';
        }
        const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked disabled' : 'disabled';
        result.push(`<li><input type="checkbox" ${checked}> ${formatInline(taskMatch[2])}</li>`);
        continue;
      }

      // Ungeordnete Listen (- oder * oder +)
      const ulMatch = line.match(/^[-*+]\s+(.*)$/);
      if (ulMatch) {
        closeBlockquote();
        closeTable();
        if (!inList || listType !== 'ul') {
          closeList();
          result.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        result.push(`<li>${formatInline(ulMatch[1])}</li>`);
        continue;
      }

      // Nummerierte Listen (1. )
      const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (olMatch) {
        closeBlockquote();
        closeTable();
        if (!inList || listType !== 'ol') {
          closeList();
          result.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        result.push(`<li>${formatInline(olMatch[2])}</li>`);
        continue;
      }

      // Listen schließen wenn keine Listenzeile
      closeList();

      // Tabellen (| Spalte 1 | Spalte 2 |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        const isSeparator = cells.every(c => /^:?-+:?$/.test(c));

        if (!inTable) {
          // Kopfzeile
          tableHeaders = cells;
          result.push('<table><thead><tr>');
          cells.forEach(c => result.push(`<th>${formatInline(c)}</th>`));
          result.push('</tr></thead><tbody>');
          inTable = true;
          continue;
        } else if (isSeparator) {
          // Trennzeile ignorieren
          continue;
        } else {
          // Datenzeile
          result.push('<tr>');
          cells.forEach(c => result.push(`<td>${formatInline(c)}</td>`));
          result.push('</tr>');
          continue;
        }
      } else {
        closeTable();
      }

      // Code-Block Platzhalter
      if (line.startsWith('__CODE_BLOCK_')) {
        result.push(line);
        continue;
      }

      // Normaler Absatz oder Leerzeile
      if (line.trim() === '') {
        continue;
      }

      result.push(`<p>${formatInline(line)}</p>`);
    }

    closeList();
    closeBlockquote();
    closeTable();

    let output = result.join('\n');

    // Codeblöcke wieder einsetzen
    codeBlocks.forEach((item, idx) => {
      const placeholder = `__CODE_BLOCK_${idx}__`;
      const langClass = item.lang ? ` class="language-${escapeHtml(item.lang)}"` : '';
      const html = `<pre><code${langClass}>${item.code}</code></pre>`;
      output = output.replace(placeholder, html);
    });

    // Inline-Codes wieder einsetzen
    inlineCodes.forEach((item, idx) => {
      const placeholder = `__INLINE_CODE_${idx}__`;
      output = output.replace(placeholder, `<code>${item}</code>`);
    });

    return output;
  }

  // Inline-Formatierungen (Fett, Kursiv, Bilder, Links, Durchgestrichen)
  function formatInline(str) {
    if (!str) return '';

    // Bilder: ![Alt](url)
    str = str.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      const safeUrl = escapeHtml(url);
      const safeAlt = escapeHtml(alt);
      return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy">`;
    });

    // Links: [Text](url)
    str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const safeUrl = escapeHtml(url);
      const safeText = formatInline(text);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
    });

    // Fett + Kursiv: ***text***
    str = str.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Fett: **text**
    str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Kursiv: *text*
    str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Durchgestrichen: ~~text~~
    str = str.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    return str;
  }

  window.WikiMarkdown = {
    render: parseMarkdown
  };
})(window);

