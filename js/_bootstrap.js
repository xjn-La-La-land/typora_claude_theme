/**
 * Claude-Like Typora Theme — HTML enhancement plugin bootstrap.
 *
 * Architecture: each feature module exports an object { name, init(ctx) }.
 * Bootstrap collects all modules, then on DOMContentLoaded calls init() on each.
 * Errors in one module are caught and logged; other modules continue.
 */

// Modules
import themeSwitcher from './theme-switcher.js';
import widthControl from './width-control.js';
import codeEnhance from './code-enhance.js';
import mathCopy from './math-copy.js';
import tableCopy from './table-copy.js';
import imageLightbox from './image-lightbox.js';
import footnote from './footnote.js';
import toc from './toc.js';

const modules = [
  themeSwitcher,
  widthControl,
  codeEnhance,
  mathCopy,
  tableCopy,
  imageLightbox,
  footnote,
  toc,
];

function buildContext() {
  return {
    log: (...args) => console.info('[claude-plugin]', ...args),
    warn: (...args) => console.warn('[claude-plugin]', ...args),
  };
}

function bootstrap() {
  const ctx = buildContext();
  ctx.log(`bootstrap starting, ${modules.length} module(s) registered`);
  for (const mod of modules) {
    try {
      mod.init(ctx);
      ctx.log(`module "${mod.name}" initialized`);
    } catch (e) {
      ctx.warn(`module "${mod.name}" failed:`, e);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
