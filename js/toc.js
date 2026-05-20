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

const MAX_LEVEL = 6; // show all Markdown heading levels (h1-h6)
const COLLAPSE_LEVEL = 3; // items at this level and deeper start collapsed
const TOC_WIDTH_STORAGE_KEY = 'claude-toc-width';
const TOC_WIDTH_MIN = 160;
const TOC_WIDTH_MAX = 480;
const TOC_MODE_STORAGE_KEY = 'claude-toc-mode';
const TOC_HOVER_DELAY_MS = 150; // small wait before auto-expand so a quick cursor cross doesn't open the panel

// Per-branch expand/collapse chevron. Points right when collapsed; CSS
// rotates it 90° when the branch is expanded.
const ICON_CHEVRON = '<svg viewBox="0 0 10 10" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M3.5 2.5L7 5L3.5 7.5z"/></svg>';
// Pushpin: round head + stem. CSS rotates it 35° in auto mode to suggest "unpinned".
const ICON_PIN = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="5" r="3" fill="currentColor"/><line x1="8" y1="8" x2="8" y2="14"/></svg>';

function slugify(text) {
  // \p{L}/\p{N} cover letters and digits in every script, so this works for
  // Japanese (hiragana, katakana), Hangul, CJK extensions, etc. The previous
  // [一-龥] character class only matched the CJK Unified Ideographs basic
  // block and silently stripped everything else.
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
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
    // Fall back to a position-based id when slugify yields nothing (e.g. a
    // heading composed entirely of emoji or punctuation). Without this the
    // heading would be silently dropped from the TOC.
    const id = h.id || slugify(h.textContent) || `heading-${items.length + 1}`;
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
  const created = []; // { li, level, childOl } for the post-process pass

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
    created.push({ li, level: it.level, childOl });
  }

  // Second pass:
  //   - leaf items: remove the empty child <ol> we always preallocated
  //   - parents: insert a chevron toggle; default-collapse if level >= COLLAPSE_LEVEL
  for (const entry of created) {
    if (entry.childOl.children.length === 0) {
      entry.childOl.remove();
      continue;
    }
    const chevron = document.createElement('button');
    chevron.type = 'button';
    chevron.className = 'claude-toc__chevron';
    chevron.setAttribute('aria-label', '展开/收起');
    chevron.innerHTML = ICON_CHEVRON;
    chevron.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      entry.li.classList.toggle('is-collapsed');
    });
    entry.li.insertBefore(chevron, entry.li.firstChild);
    if (entry.level >= COLLAPSE_LEVEL) entry.li.classList.add('is-collapsed');
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
  let lastActiveId = null;
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
    if (activeId === lastActiveId) return;
    // Toggle only the two affected items — full forEach would be O(headings)
    // per scroll tick, which is noticeable on long documents.
    if (lastActiveId) tocItems.get(lastActiveId)?.classList.remove('is-active');
    if (activeId) tocItems.get(activeId)?.classList.add('is-active');
    lastActiveId = activeId;
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

function buildPin(panel) {
  // Pinned (manual) ↔ unpinned (auto) toggle. Manual = current behavior:
  // panel stays where the user put it. Auto = panel hides as a strip and
  // slides in on hover. See plugin.scss for the visual state difference.
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'claude-toc__pin';
  btn.title = '钉住目录 / 鼠标 hover 自动显示';
  btn.setAttribute('aria-label', '切换目录自动隐藏');
  btn.innerHTML = ICON_PIN;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = panel.dataset.mode === 'auto' ? 'manual' : 'auto';
    applyMode(panel, next);
    setStoredMode(next);
  });
  return btn;
}

function getStoredMode() {
  try {
    return localStorage.getItem(TOC_MODE_STORAGE_KEY) === 'auto' ? 'auto' : 'manual';
  } catch {
    return 'manual';
  }
}

function setStoredMode(mode) {
  try { localStorage.setItem(TOC_MODE_STORAGE_KEY, mode); } catch {}
}

function applyMode(panel, mode) {
  panel.dataset.mode = mode;
  // Switching to auto immediately collapses to the hover-strip — this both
  // demonstrates the new behavior to the user and matches the design
  // (auto-mode is "TOC hides until you hover"). Switching back to manual
  // leaves the current is-collapsed state alone; the user takes over.
  if (mode === 'auto') panel.classList.add('is-collapsed');
}

function attachAutoHover(panel) {
  let openTimer = null;
  panel.addEventListener('mouseenter', () => {
    if (panel.dataset.mode !== 'auto') return;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => panel.classList.remove('is-collapsed'), TOC_HOVER_DELAY_MS);
  });
  panel.addEventListener('mouseleave', () => {
    // Always clear pending open so a quick mode switch mid-delay doesn't leak.
    clearTimeout(openTimer);
    if (panel.dataset.mode !== 'auto') return;
    panel.classList.add('is-collapsed');
  });
}

function buildPanel(items) {
  const aside = document.createElement('aside');
  aside.className = 'claude-toc';
  // Default-collapsed on narrow viewports.
  if (window.matchMedia('(max-width: 1100px)').matches) aside.classList.add('is-collapsed');
  aside.appendChild(buildToggle(aside));
  aside.appendChild(buildPin(aside));
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
    // Apply persisted mode before mounting so the user doesn't see a flicker
    // (e.g. auto mode expanding momentarily then collapsing).
    applyMode(panel, getStoredMode());
    document.body.appendChild(panel);
    attachResize(panel);
    attachAutoHover(panel);

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
