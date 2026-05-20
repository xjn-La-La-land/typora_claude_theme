/**
 * Code block enhancement:
 *   1. Inject a single "copy" icon button in the top-right of each outer code block.
 *   2. Render line numbers via a JS gutter when applicable.
 *
 * Typora "Export HTML with styles" wraps each code line in its own
 * <pre class="CodeMirror-line">, so we filter to outer code blocks only
 * (skip CodeMirror line pres and any nested-in-pre pre).
 */

import { attachHoverCopyButton } from './copy-utils.js';

function isOuterCodeBlock(pre) {
  // Skip CodeMirror line elements (inner per-line pres from Typora's "with styles" export).
  if (pre.classList.contains('CodeMirror-line')) return false;
  // Defense in depth: skip any pre nested under another pre.
  if (pre.parentElement?.closest('pre')) return false;
  return true;
}

function isCodeBlock(pre) {
  // Heuristic: pre with code child OR pre with non-empty text content.
  if (pre.querySelector('code')) return true;
  if (pre.textContent.trim().length > 0) return true;
  return false;
}

function extractCode(pre) {
  // Prefer a <code> child (standard markdown export).
  const code = pre.querySelector('code');
  if (code) return code.innerText;
  // CodeMirror-style export: join each rendered line's text with newlines.
  const cmCode = pre.querySelector('.CodeMirror-code');
  if (cmCode) {
    const lines = Array.from(cmCode.querySelectorAll('.CodeMirror-line'));
    if (lines.length > 0) return lines.map((l) => l.innerText).join('\n');
  }
  // Last resort.
  return pre.innerText;
}

function applyLineNumbers(pre) {
  // Only runs for plain <pre><code> exports (e.g. Typora's basic HTML export).
  // For CodeMirror-style "with styles" exports, CodeMirror provides its own gutter and
  // we silently do nothing here.
  const code = pre.querySelector('code');
  if (!code) return;
  const lines = code.innerText.split('\n');
  // Trim a single trailing newline (common in code blocks) to avoid showing an extra empty line.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return;
  const gutter = document.createElement('span');
  gutter.className = 'claude-code-gutter';
  gutter.setAttribute('aria-hidden', 'true');
  gutter.textContent = lines.map((_, i) => i + 1).join('\n');
  pre.classList.add('claude-code-has-gutter');
  pre.insertBefore(gutter, code);
}

export default {
  name: 'code-enhance',
  init(ctx) {
    const pres = document.querySelectorAll('#write pre');
    if (pres.length === 0) {
      ctx.log('code-enhance: no code blocks, skipping');
      return;
    }
    let count = 0;
    pres.forEach((pre) => {
      if (!isOuterCodeBlock(pre)) return;
      if (!isCodeBlock(pre)) return;
      attachHoverCopyButton(pre, () => extractCode(pre), { title: '复制代码', label: '复制代码' });
      applyLineNumbers(pre);
      count++;
    });
    ctx.log(`code-enhance attached to ${count} code block(s)`);
  },
};
