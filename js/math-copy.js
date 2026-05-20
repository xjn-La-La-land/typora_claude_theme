/**
 * Math formula copy.
 *
 * Inline math (mjx-container without display="true"):
 *   - cursor: copy + subtle bg darken on hover
 *   - click anywhere in the formula → copy LaTeX silently
 *   - silent on success; brief outline flash on failure
 *
 * Block math (mjx-container[display="true"], wrapped in .md-math-block):
 *   - top-right copy button (same hover-reveal pattern as code blocks)
 *   - ✓ for 2s on success, ✗ for 2s on failure
 *
 * LaTeX source: MathJax's assistive MathML emits the original LaTeX as a
 * data-latex attribute on the root <math> element. Fallback to an adjacent
 * <script type="math/tex"> sibling, which Typora also emits for inline math.
 */

import { copyText, flashFail, attachHoverCopyButton } from './copy-utils.js';

function extractLatex(mjxContainer) {
  const rootMath = mjxContainer.querySelector('mjx-assistive-mml > math[data-latex]');
  if (rootMath) {
    const s = rootMath.getAttribute('data-latex');
    if (s) return s.trim();
  }
  // Fallback: <script type="math/tex"> right after the container (inline math).
  const sib = mjxContainer.nextElementSibling;
  if (sib && sib.tagName === 'SCRIPT' && /math\/tex/.test(sib.type || '')) {
    return sib.textContent.trim();
  }
  return null;
}

function attachInline(container) {
  const latex = extractLatex(container);
  if (!latex) return false;
  container.classList.add('claude-math-inline');
  container.title = '点击复制 LaTeX';
  container.addEventListener('click', async (e) => {
    // Don't intercept if the user is selecting text — drag-select should win.
    if (window.getSelection?.().toString()) return;
    e.preventDefault();
    try {
      await copyText(latex);
      // Silent on success by design.
    } catch {
      flashFail(container, 'claude-copy-failed', 600);
    }
  });
  return true;
}

function attachBlock(blockEl) {
  const mjx = blockEl.querySelector('mjx-container');
  if (!mjx) return false;
  const latex = extractLatex(mjx);
  if (!latex) return false;
  blockEl.classList.add('claude-math-block');
  attachHoverCopyButton(blockEl, latex, { title: '复制 LaTeX', label: '复制 LaTeX' });
  return true;
}

export default {
  name: 'math-copy',
  init(ctx) {
    const root = document.getElementById('write') || document.body;
    // Block first: collect the wrapper divs so inline pass can skip containers
    // already handled by the block button.
    const blocks = root.querySelectorAll('.md-math-block, .mathjax-block');
    let blockCount = 0;
    blocks.forEach((b) => { if (attachBlock(b)) blockCount++; });

    let inlineCount = 0;
    const inlines = root.querySelectorAll('mjx-container:not([display="true"])');
    inlines.forEach((c) => {
      // Skip containers that sit inside an already-handled block wrapper.
      if (c.closest('.md-math-block, .mathjax-block')) return;
      if (attachInline(c)) inlineCount++;
    });
    ctx.log(`math-copy: ${blockCount} block, ${inlineCount} inline`);
  },
};
