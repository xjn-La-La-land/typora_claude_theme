/**
 * Code block enhancement:
 *   1. Inject a "copy" button in the top-right of each <pre> block.
 *   2. Render line numbers via a JS gutter; line numbers do not enter the clipboard.
 *
 * Selector strategy: target every <pre> that is a direct descendant of #write or
 * has at least one <code> child. We don't depend on Typora's md-fences classes
 * (which may change across versions).
 */

function isCodeBlock(pre) {
  // Heuristic: pre with code child OR pre with non-empty text content.
  if (pre.querySelector('code')) return true;
  if (pre.textContent.trim().length > 0) return true;
  return false;
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
  btn.textContent = '复制';
  btn.title = '复制代码';
  btn.setAttribute('aria-label', '复制代码');
  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code') || pre;
    const text = code.innerText;
    try {
      await copyText(text);
      btn.textContent = '✓';
      btn.classList.add('is-success');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('is-success');
      }, 2000);
    } catch (e) {
      btn.textContent = '失败';
      btn.classList.add('is-error');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('is-error');
      }, 2000);
    }
  });
  pre.appendChild(btn);
}

function applyLineNumbers(pre) {
  // We use a JS gutter approach because Typora's <pre><code> uses newline text
  // (not per-line <span>) which makes pure-CSS line numbering unworkable.
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
      if (!isCodeBlock(pre)) return;
      pre.style.position = pre.style.position || 'relative';
      attachCopyButton(pre);
      applyLineNumbers(pre);
      count++;
    });
    ctx.log(`code-enhance attached to ${count} code block(s)`);
  },
};
