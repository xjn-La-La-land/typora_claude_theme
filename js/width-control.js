/**
 * Content width control — three buttons (narrow / default / wide) sitting
 * below the theme switcher. Clicking sets a data-content-width attribute on
 * <html>; plugin.scss has the corresponding `#write { max-width }` overrides.
 * "default" removes the attribute so the theme's responsive max-widths apply.
 * Selection persists via localStorage.
 */

const STORAGE_KEY = 'claude-content-width';
const WIDTHS = ['narrow', 'default', 'wide'];

// 14x10 SVGs: three horizontal bars whose length grows with the choice.
// currentColor lets the bars inherit the button's text color.
const ICON_NARROW  = '<svg viewBox="0 0 20 14" width="14" height="10" fill="currentColor" aria-hidden="true"><rect x="6" y="3"    width="8"  height="1.5"/><rect x="6" y="6.25" width="8"  height="1.5"/><rect x="6" y="9.5"  width="8"  height="1.5"/></svg>';
const ICON_DEFAULT = '<svg viewBox="0 0 20 14" width="14" height="10" fill="currentColor" aria-hidden="true"><rect x="4" y="3"    width="12" height="1.5"/><rect x="4" y="6.25" width="12" height="1.5"/><rect x="4" y="9.5"  width="12" height="1.5"/></svg>';
const ICON_WIDE    = '<svg viewBox="0 0 20 14" width="14" height="10" fill="currentColor" aria-hidden="true"><rect x="2" y="3"    width="16" height="1.5"/><rect x="2" y="6.25" width="16" height="1.5"/><rect x="2" y="9.5"  width="16" height="1.5"/></svg>';

const ICONS  = { narrow: ICON_NARROW, default: ICON_DEFAULT, wide: ICON_WIDE };
const LABELS = { narrow: '窄', default: '默认', wide: '宽' };

function getInitialWidth() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (WIDTHS.includes(stored)) return stored;
  } catch {
    // localStorage unavailable
  }
  return null; // null = use theme's responsive default (no override)
}

function applyWidth(width) {
  if (width === null || width === 'default') {
    document.documentElement.removeAttribute('data-content-width');
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  } else {
    document.documentElement.setAttribute('data-content-width', width);
    try { localStorage.setItem(STORAGE_KEY, width); } catch {}
  }
}

function buildControl(currentWidth) {
  const root = document.createElement('div');
  root.className = 'claude-width-control';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '正文宽度');

  for (const w of WIDTHS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'claude-width-control__btn';
    btn.dataset.width = w;
    btn.title = LABELS[w];
    btn.setAttribute('aria-label', `正文宽度：${LABELS[w]}`);
    btn.innerHTML = ICONS[w];
    // "default" is implicit when no localStorage value exists.
    if (w === currentWidth || (currentWidth === null && w === 'default')) {
      btn.classList.add('is-active');
    }
    btn.addEventListener('click', () => {
      applyWidth(w);
      root.querySelectorAll('.claude-width-control__btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.width === w);
      });
    });
    root.appendChild(btn);
  }
  return root;
}

export default {
  name: 'width-control',
  init(ctx) {
    const initial = getInitialWidth();
    if (initial) applyWidth(initial);
    const control = buildControl(initial);
    document.body.appendChild(control);
    ctx.log('width-control mounted');
  },
};
