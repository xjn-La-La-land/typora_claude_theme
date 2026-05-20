/**
 * Shared copy helpers — used by code-enhance, math-copy, table-copy.
 *
 * Three modules attach a hover-revealed copy button at the top-right of some
 * host element (pre, .md-math-block, figure.table-figure). The host gets a
 * `.claude-copy-hover` class on mouseenter/leave; CSS uses that to fade the
 * button in. Click runs copyText() and swaps the icon to ✓ for 2s on success
 * or ✗ for 2s on failure.
 */

export const ICON_COPY = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8.5" rx="1.5"/><path d="M3 11V4a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>';
export const ICON_CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.5 3.5L13 4.5"/></svg>';
export const ICON_FAIL = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

export function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure contexts (some file:// setups, ancient browsers).
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

/**
 * Briefly mark an element as "copy failed" by toggling a class. Used by the
 * inline-math click target, where the design omits success feedback for a
 * quieter aesthetic but still wants to flag failures so the user doesn't
 * paste stale clipboard content without realizing.
 */
export function flashFail(el, className = 'claude-copy-failed', ms = 600) {
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}

/**
 * Mount a hover-revealed copy button at the top-right of `host`. `getText`
 * is either a string or a function that returns one (deferred so callers
 * like table-copy can compute markdown lazily when the user clicks).
 *
 * Caller is responsible for ensuring `host` has `position: relative` via CSS.
 */
export function attachHoverCopyButton(host, getText, { title = '复制', label = title } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'claude-copy-btn';
  btn.title = title;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = ICON_COPY;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await copyText(typeof getText === 'function' ? getText() : getText);
      btn.innerHTML = ICON_CHECK;
      btn.classList.add('is-success');
      setTimeout(() => { btn.innerHTML = ICON_COPY; btn.classList.remove('is-success'); }, 2000);
    } catch {
      btn.innerHTML = ICON_FAIL;
      btn.classList.add('is-error');
      setTimeout(() => { btn.innerHTML = ICON_COPY; btn.classList.remove('is-error'); }, 2000);
    }
  });
  // JS-managed hover toggle — CSS :hover on the host can be flaky when child
  // elements (CodeMirror, MathJax SVG) capture pointer events.
  host.addEventListener('mouseenter', () => host.classList.add('claude-copy-hover'));
  host.addEventListener('mouseleave', () => host.classList.remove('claude-copy-hover'));
  host.appendChild(btn);
  return btn;
}
