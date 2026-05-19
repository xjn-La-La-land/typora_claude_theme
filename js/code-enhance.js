/**
 * Code block enhancement:
 *   1. Inject a single "copy" icon button in the top-right of each outer code block.
 *   2. Render line numbers via a JS gutter when applicable.
 *
 * Typora "Export HTML with styles" wraps each code line in its own
 * <pre class="CodeMirror-line">, so we filter to outer code blocks only
 * (skip CodeMirror line pres and any nested-in-pre pre).
 */

// 14x14 SVG icons rendered with stroke=currentColor so they inherit the button color.
const ICON_COPY = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8.5" rx="1.5"/><path d="M3 11V4a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.5 3.5L13 4.5"/></svg>';
const ICON_FAIL = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

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

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback: textarea + execCommand
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('execCommand failed'));
    } finally {
      document.body.removeChild(ta);
    }
  });
}

function attachCopyButton(pre) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'claude-code-copy-btn';
  btn.title = '复制代码';
  btn.setAttribute('aria-label', '复制代码');
  btn.innerHTML = ICON_COPY;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await copyText(extractCode(pre));
      btn.innerHTML = ICON_CHECK;
      btn.classList.add('is-success');
      setTimeout(() => {
        btn.innerHTML = ICON_COPY;
        btn.classList.remove('is-success');
      }, 2000);
    } catch (err) {
      btn.innerHTML = ICON_FAIL;
      btn.classList.add('is-error');
      setTimeout(() => {
        btn.innerHTML = ICON_COPY;
        btn.classList.remove('is-error');
      }, 2000);
    }
  });
  pre.appendChild(btn);
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
      pre.style.position = pre.style.position || 'relative';
      attachCopyButton(pre);
      applyLineNumbers(pre);
      count++;
    });
    ctx.log(`code-enhance attached to ${count} code block(s)`);
  },
};
