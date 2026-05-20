/**
 * Table copy — copy the whole table as Markdown source.
 *
 * Typora's HTML export discards the original markdown, so we serialize the
 * rendered <table> back to Markdown ourselves. Only the inline elements
 * Typora actually emits inside <th>/<td> are supported (strong/em/code/a/
 * br/img); anything else is unwrapped to its text content. Cells with very
 * rich content (nested lists, blockquotes, multi-paragraph) won't round-trip
 * cleanly — by design, the result is a best-effort that the user may need
 * to clean up.
 */

import { attachHoverCopyButton } from './copy-utils.js';

function nodeToMd(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = node.tagName.toLowerCase();
  const inner = () => Array.from(node.childNodes).map(nodeToMd).join('');
  switch (tag) {
    case 'strong':
    case 'b':
      return `**${inner()}**`;
    case 'em':
    case 'i':
      return `*${inner()}*`;
    case 'code':
      return '`' + node.textContent + '`';
    case 'a':
      return `[${inner()}](${node.getAttribute('href') || ''})`;
    case 'br':
      return ' '; // markdown table cells must be single-line
    case 'img':
      return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
    default:
      // Unknown wrapper (typically Typora's <span> shells) — unwrap.
      return inner();
  }
}

function cellToMd(cell) {
  return Array.from(cell.childNodes)
    .map(nodeToMd)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '\\|');
}

function detectAlign(cell) {
  const styleAlign = cell.style?.textAlign;
  const attrAlign = cell.getAttribute?.('align');
  return styleAlign || attrAlign || null;
}

function tableToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return '';
  const matrix = rows.map((tr) => Array.from(tr.children).map(cellToMd));
  const header = matrix[0];
  const body = matrix.slice(1);

  // Alignment is taken from the header row's style/attribute. Default `---`
  // when none is set, which is what Typora normally produces.
  const headerCells = Array.from(rows[0].children);
  const sep = headerCells.map((c) => {
    const a = detectAlign(c);
    if (a === 'center') return ':---:';
    if (a === 'right') return '---:';
    if (a === 'left') return ':---';
    return '---';
  });

  return [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

export default {
  name: 'table-copy',
  init(ctx) {
    const tables = document.querySelectorAll('#write table');
    if (tables.length === 0) {
      ctx.log('table-copy: no tables, skipping');
      return;
    }
    let count = 0;
    tables.forEach((table) => {
      // Anchor the button on the <figure.table-figure> wrapper when present
      // (gives a stable positioning context); fall back to <table> itself.
      const figure = table.closest('figure.table-figure');
      const host = figure || table;
      host.classList.add('claude-table-host');
      attachHoverCopyButton(host, () => tableToMarkdown(table), {
        title: '复制为 Markdown',
        label: '复制表格',
      });
      count++;
    });
    ctx.log(`table-copy attached to ${count} table(s)`);
  },
};
