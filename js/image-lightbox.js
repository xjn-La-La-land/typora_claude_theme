/**
 * Image lightbox + caption.
 * - Wraps each <img alt="..."> in <figure> with <figcaption> showing alt text.
 * - Click image → fullscreen overlay with image + caption; Esc or click overlay closes.
 * - Skip images with class "no-lightbox".
 */

function wrapWithCaption(img) {
  if (img.parentElement?.tagName === 'FIGURE') return; // already wrapped
  const figure = document.createElement('figure');
  figure.className = 'claude-figure';
  img.parentElement.insertBefore(figure, img);
  figure.appendChild(img);
  const alt = (img.getAttribute('alt') || '').trim();
  if (alt) {
    const caption = document.createElement('figcaption');
    caption.className = 'claude-figcaption';
    caption.textContent = alt;
    figure.appendChild(caption);
  }
}

let overlay; // singleton

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'claude-lightbox-overlay';
  overlay.innerHTML = `
    <img class="claude-lightbox-img" alt="">
    <div class="claude-lightbox-caption"></div>
  `;
  overlay.addEventListener('click', (e) => {
    // Click on overlay background (not the image itself) closes.
    if (e.target === overlay) close();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function open(src, alt) {
  const ov = ensureOverlay();
  ov.querySelector('.claude-lightbox-img').src = src;
  ov.querySelector('.claude-lightbox-caption').textContent = alt || '';
  ov.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function close() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
}

export default {
  name: 'image-lightbox',
  init(ctx) {
    const imgs = document.querySelectorAll('#write img:not(.no-lightbox)');
    if (imgs.length === 0) {
      ctx.log('image-lightbox: no images, skipping');
      return;
    }
    imgs.forEach((img) => {
      wrapWithCaption(img);
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => open(img.currentSrc || img.src, img.getAttribute('alt')));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    ctx.log(`image-lightbox attached to ${imgs.length} image(s)`);
  },
};
