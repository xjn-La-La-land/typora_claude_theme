/**
 * Footnote popover — hover a footnote ref to see its content without scrolling.
 *
 * DOM contract (Typora HTML export):
 *   - Ref:  <sup><a href="#fn:N" id="fnref:N">N</a></sup>
 *   - Body: <div class="footnotes"><ol><li id="fn:N">…content…</li></ol></div>
 */

const HOVER_DELAY_MS = 400;

function findFootnoteBody(refHref) {
  // refHref like "#fn:1"
  const id = refHref.replace(/^#/, '');
  const li = document.getElementById(id);
  if (!li) return null;
  // Clone to avoid mutating the original DOM.
  // Strip Typora's back-jump links AND any <script>/<style> for defensive injection safety.
  // We intentionally preserve other inline tags (code, strong, em, a) so rich footnote
  // formatting renders correctly. Footnote bodies are author-controlled local content;
  // this is a minimal defense, not a full sanitizer.
  const clone = li.cloneNode(true);
  clone.querySelectorAll('a.footnote-backref, a[href^="#fnref"], script, style').forEach((n) => n.remove());
  return clone.innerHTML.trim();
}

let popover;
let hoverTimer = null;

function ensurePopover() {
  if (popover) return popover;
  popover = document.createElement('div');
  popover.className = 'claude-footnote-popover';
  popover.addEventListener('mouseleave', hide);
  document.body.appendChild(popover);
  return popover;
}

function show(anchor, html) {
  const pop = ensurePopover();
  pop.innerHTML = html;
  const rect = anchor.getBoundingClientRect();
  pop.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 360)}px`;
  pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
  pop.classList.add('is-open');
}

function hide() {
  if (!popover) return;
  popover.classList.remove('is-open');
}

export default {
  name: 'footnote',
  init(ctx) {
    if (!document.querySelector('.footnotes, .footnote-section')) {
      ctx.log('footnote: no footnote section, skipping');
      return;
    }
    const refs = document.querySelectorAll('sup > a[href^="#fn"], a.footnote-ref');
    if (refs.length === 0) {
      ctx.log('footnote: no refs, skipping');
      return;
    }
    refs.forEach((a) => {
      a.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          const html = findFootnoteBody(a.getAttribute('href'));
          if (html) show(a, html);
        }, HOVER_DELAY_MS);
      });
      a.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        // Don't hide immediately — user may be moving toward the popover.
        setTimeout(() => {
          if (!popover?.matches(':hover')) hide();
        }, 200);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hide();
    });
    ctx.log(`footnote attached to ${refs.length} ref(s)`);
  },
};
