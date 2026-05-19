/**
 * Theme switcher — inserts a small control in the top-right corner of the exported HTML
 * with three dots (light/grey/dark). Clicking sets data-theme on <html> and persists
 * choice in localStorage.
 */

const STORAGE_KEY = 'claude-theme';
const THEMES = ['light', 'grey', 'dark'];

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode); fall through
  }
  return null; // null = leave inline :root palette as-is
}

function applyTheme(theme) {
  if (theme === null) {
    document.documentElement.removeAttribute('data-theme');
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  } else {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }
}

function buildSwitcher(currentTheme) {
  const root = document.createElement('div');
  root.className = 'claude-theme-switcher';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '主题切换');

  for (const t of THEMES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'claude-theme-switcher__btn';
    btn.dataset.theme = t;
    btn.title = t;
    btn.setAttribute('aria-label', `切换到 ${t} 主题`);
    if (t === currentTheme) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      applyTheme(t);
      root.querySelectorAll('.claude-theme-switcher__btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.theme === t);
      });
    });
    root.appendChild(btn);
  }
  return root;
}

export default {
  name: 'theme-switcher',
  init(ctx) {
    const initial = getInitialTheme();
    if (initial) applyTheme(initial);
    const switcher = buildSwitcher(initial);
    document.body.appendChild(switcher);
    ctx.log('theme-switcher mounted');
  },
};
