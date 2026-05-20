/**
 * Content width control — a horizontal slider that adjusts #write's max-width
 * continuously. The pill sits below the theme switcher in the top-right.
 *
 * When the user touches the slider, we set --claude-content-max on <html> and
 * mark data-content-width="custom"; plugin.scss has the gated override:
 *   html[data-content-width] #write { max-width: var(--claude-content-max) !important }
 *
 * On first load with no stored value, no override is applied and the theme's
 * responsive media queries decide the width.
 *
 * Storage: localStorage["claude-content-width"] = "<integer px>"
 */

const STORAGE_KEY = 'claude-content-width';
const WIDTH_MIN = 560;
const WIDTH_MAX = 1800;
const WIDTH_STEP = 10;
const WIDTH_DEFAULT = 980; // slider start position when no preference is stored

function getStoredWidth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const v = parseInt(raw, 10);
    if (Number.isNaN(v)) return null;
    if (v < WIDTH_MIN || v > WIDTH_MAX) return null;
    return v;
  } catch {
    return null;
  }
}

function setWidth(width) {
  document.documentElement.style.setProperty('--claude-content-max', `${width}px`);
  document.documentElement.setAttribute('data-content-width', 'custom');
}

// Persist separately from the visual apply. Dragging the slider fires `input`
// for every step; we don't want to hit localStorage hundreds of times per drag.
function persistWidth(width) {
  try { localStorage.setItem(STORAGE_KEY, String(width)); } catch {}
}

function buildControl(initialWidth) {
  const root = document.createElement('div');
  root.className = 'claude-width-control';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '正文宽度');

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'claude-width-control__slider';
  slider.min = String(WIDTH_MIN);
  slider.max = String(WIDTH_MAX);
  slider.step = String(WIDTH_STEP);
  slider.value = String(initialWidth ?? WIDTH_DEFAULT);
  slider.title = '正文宽度';
  slider.setAttribute('aria-label', '正文宽度');

  // Updates the CSS variable that drives the linear-gradient track fill.
  // WebKit/Blink lack a native "filled-portion" pseudo, so we synthesize it
  // with a gradient on the input's own background.
  const updateFill = () => {
    const v = parseInt(slider.value, 10);
    const pct = ((v - WIDTH_MIN) / (WIDTH_MAX - WIDTH_MIN)) * 100;
    slider.style.setProperty('--claude-slider-fill', `${pct}%`);
  };
  updateFill();

  slider.addEventListener('input', () => {
    setWidth(parseInt(slider.value, 10));
    updateFill();
  });
  // `change` fires on release (mouseup / keyboard commit), so persistence
  // happens once per gesture instead of once per pixel.
  slider.addEventListener('change', () => {
    persistWidth(parseInt(slider.value, 10));
  });

  root.appendChild(slider);
  return root;
}

export default {
  name: 'width-control',
  init(ctx) {
    const stored = getStoredWidth();
    if (stored !== null) setWidth(stored); // already in storage; no need to re-persist
    const control = buildControl(stored);
    document.body.appendChild(control);
    ctx.log('width-control mounted');
  },
};
