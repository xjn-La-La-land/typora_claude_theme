/**
 * Floating TOC + active-section highlight.
 *
 * Algorithm:
 *   1. Scan #write h1..h6, assign stable ids (use existing or slugify).
 *   2. Build nested tree by heading level.
 *   3. Render as <ol> nested list in <aside class="claude-toc">.
 *   4. Use IntersectionObserver to track which heading is currently "active".
 *   5. Click TOC item → smooth scrollIntoView + update location.hash.
 *   6. On viewports < 1100px, collapse panel to a hamburger.
 */

const MAX_LEVEL = 3; // show h1-h3 only
const TOC_WIDTH_STORAGE_KEY = 'claude-toc-width';
const TOC_WIDTH_MIN = 160;
const TOC_WIDTH_MAX = 480;

function slugify(text) {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w一-龥 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectHeadings(root) {
  const all = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const used = new Set();
  const items = [];
  for (const h of all) {
    const level = Number(h.tagName.slice(1));
    if (level > MAX_LEVEL) continue;
    let id = h.id || slugify(h.textContent);
    if (!id) continue;
    let unique = id;
    let n = 1;
    while (used.has(unique)) unique = `${id}-${++n}`;
    used.add(unique);
    if (!h.id) h.id = unique;
    items.push({ level, id: unique, text: h.textContent.trim(), el: h });
  }
  return items;
}

function renderList(items) {
  // Convert flat list with levels to nested <ol>.
  const root = document.createElement('ol');
  root.className = 'claude-toc__list';
  const stack = [{ level: 0, ol: root }];

  for (const it of items) {
    while (stack[stack.length - 1].level >= it.level) stack.pop();
    const parent = stack[stack.length - 1].ol;
    const li = document.createElement('li');
    li.className = `claude-toc__item is-level-${it.level}`;
    li.dataset.targetId = it.id;
    const a = document.createElement('a');
    a.href = `#${it.id}`;
    a.textContent = it.text;
    a.className = 'claude-toc__link';
    li.appendChild(a);
    parent.appendChild(li);
    const childOl = document.createElement('ol');
    li.appendChild(childOl);
    stack.push({ level: it.level, ol: childOl });
  }
  return root;
}

function attachScrollSpy(items) {
  if (!('IntersectionObserver' in window)) return; // graceful skip
  const tocItems = new Map(); // id → li
  document.querySelectorAll('.claude-toc__item').forEach((li) => {
    tocItems.set(li.dataset.targetId, li);
  });

  const visible = new Set();
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target.id);
      else visible.delete(e.target.id);
    }
    // Pick the topmost visible heading (in document order).
    let activeId = null;
    for (const it of items) {
      if (visible.has(it.id)) { activeId = it.id; break; }
    }
    tocItems.forEach((li, id) => li.classList.toggle('is-active', id === activeId));
  }, { rootMargin: '0px 0px -65% 0px', threshold: 0 });
  items.forEach((it) => obs.observe(it.el));
}

function buildToggle(panel) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'claude-toc__toggle';
  btn.setAttribute('aria-label', '展开/收起目录');
  btn.textContent = '≡';
  btn.addEventListener('click', () => panel.classList.toggle('is-collapsed'));
  return btn;
}

function buildPanel(items) {
  const aside = document.createElement('aside');
  aside.className = 'claude-toc';
  // Default-collapsed on narrow viewports.
  if (window.matchMedia('(max-width: 1100px)').matches) aside.classList.add('is-collapsed');
  aside.appendChild(buildToggle(aside));
  const header = document.createElement('div');
  header.className = 'claude-toc__header';
  header.textContent = '目录';
  aside.appendChild(header);
  aside.appendChild(renderList(items));
  // Resize handle at the right edge; CSS handles the visual treatment.
  const handle = document.createElement('div');
  handle.className = 'claude-toc__resize';
  handle.setAttribute('aria-hidden', 'true');
  aside.appendChild(handle);
  return aside;
}

function clampWidth(w) {
  return Math.max(TOC_WIDTH_MIN, Math.min(TOC_WIDTH_MAX, w));
}

function restoreWidth(panel) {
  try {
    const stored = parseInt(localStorage.getItem(TOC_WIDTH_STORAGE_KEY), 10);
    if (!Number.isNaN(stored)) {
      panel.style.setProperty('--claude-toc-width', `${clampWidth(stored)}px`);
    }
  } catch {}
}

function attachResize(panel) {
  const handle = panel.querySelector('.claude-toc__resize');
  if (!handle) return;
  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  function onMouseMove(e) {
    if (!dragging) return;
    const w = clampWidth(startWidth + (e.clientX - startX));
    panel.style.setProperty('--claude-toc-width', `${w}px`);
  }

  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    try {
      const final = parseInt(panel.style.getPropertyValue('--claude-toc-width'), 10);
      if (!Number.isNaN(final)) localStorage.setItem(TOC_WIDTH_STORAGE_KEY, String(final));
    } catch {}
  }

  handle.addEventListener('mousedown', (e) => {
    // Resize handle is hidden in collapsed state; defense if user finds it anyway.
    if (panel.classList.contains('is-collapsed')) return;
    e.preventDefault();
    startX = e.clientX;
    startWidth = panel.getBoundingClientRect().width;
    dragging = true;
    panel.classList.add('is-resizing');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

export default {
  name: 'toc',
  init(ctx) {
    const root = document.getElementById('write') || document.body;
    const items = collectHeadings(root);
    if (items.length === 0) {
      ctx.log('toc: no headings, skipping');
      return;
    }
    const panel = buildPanel(items);
    restoreWidth(panel);
    document.body.appendChild(panel);
    attachResize(panel);

    // Smooth-scroll behavior on TOC links (let location.hash update naturally).
    panel.addEventListener('click', (e) => {
      const a = e.target.closest('a.claude-toc__link');
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${id}`);
      }
    });

    attachScrollSpy(items);

    ctx.log(`toc rendered with ${items.length} heading(s)`);
  },
};
