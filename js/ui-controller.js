/**
 * ui-controller.js
 * Manages AR viewer UI: mode switching, sliders, HUD controls,
 * toast notifications, and screenshot capture.
 */

window.UIController = (function () {

  let currentMode = 'furniture';
  let onModeChange = null;

  /* ── Toast ─────────────────────────────────────────────── */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(msg, type = 'info', duration = 2500) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = `show ${type}`;
    toastTimer = setTimeout(() => { toast.className = ''; }, duration);
  }

  /* ── Mode switching ─────────────────────────────────────── */
  const modeTabs     = document.querySelectorAll('.mode-tab');
  const furnCtrl     = document.getElementById('furniture-controls');
  const accCtrl      = document.getElementById('accessories-controls');
  const paintCtrl    = document.getElementById('paint-controls');
  const hintText     = document.getElementById('hint-text');

  const hints = {
    furniture:   '👆 Tap to place product on a surface',
    accessories: '🤳 Face the camera to try on accessories',
    paint:       '🎨 Choose a color to preview on your walls'
  };

  function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

    furnCtrl.style.display  = mode === 'furniture'   ? 'flex' : 'none';
    accCtrl.style.display   = mode === 'accessories' ? 'flex' : 'none';
    paintCtrl.style.display = mode === 'paint'       ? 'flex' : 'none';

    hintText.textContent = hints[mode];
    hintText.classList.remove('hidden');
    setTimeout(() => hintText.classList.add('hidden'), 3000);

    if (onModeChange) onModeChange(mode);
  }

  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  /* ── Furniture controls ─────────────────────────────────── */
  const scaleSlider  = document.getElementById('scale-slider');
  const rotateSlider = document.getElementById('rotate-slider');
  const btnPlace     = document.getElementById('btn-place');
  const btnRemove    = document.getElementById('btn-remove');

  let onScale  = null;
  let onRotate = null;
  let onPlace  = null;
  let onRemove = null;

  scaleSlider.addEventListener('input', () => {
    if (onScale) onScale(Number(scaleSlider.value) / 100);
  });
  rotateSlider.addEventListener('input', () => {
    if (onRotate) onRotate((Number(rotateSlider.value) * Math.PI) / 180);
  });
  btnPlace.addEventListener('click', () => {
    if (onPlace) onPlace();
    showToast('📌 Product placed!', 'success');
  });
  btnRemove.addEventListener('click', () => {
    if (onRemove) onRemove();
    showToast('🗑 Removed', 'info');
    rotateSlider.value = 0;
    scaleSlider.value  = 100;
  });

  /* ── Accessories controls ───────────────────────────────── */
  const accItems       = document.querySelectorAll('.acc-item');
  const accSizeSlider  = document.getElementById('acc-size-slider');
  let   onAccChange    = null;
  let   onAccSize      = null;

  accItems.forEach(item => {
    item.addEventListener('click', () => {
      accItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (onAccChange) onAccChange(item.dataset.acc);
    });
  });
  accSizeSlider.addEventListener('input', () => {
    if (onAccSize) onAccSize(Number(accSizeSlider.value) / 100);
  });

  /* ── Paint controls ─────────────────────────────────────── */
  const swatches       = document.querySelectorAll('.swatch');
  const customColor    = document.getElementById('custom-color');
  const paintOpacity   = document.getElementById('paint-opacity');
  const btnBeforeAfter = document.getElementById('btn-before-after');
  const btnClearPaint  = document.getElementById('btn-clear-paint');

  let onColorChange    = null;
  let onOpacityChange  = null;
  let onBeforeAfter    = null;
  let onClearPaint     = null;
  let beforeAfterMode  = false;

  swatches.forEach(sw => {
    sw.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      customColor.value = sw.dataset.color;
      if (onColorChange) onColorChange(sw.dataset.color);
    });
  });
  customColor.addEventListener('input', () => {
    swatches.forEach(s => s.classList.remove('active'));
    if (onColorChange) onColorChange(customColor.value);
  });
  paintOpacity.addEventListener('input', () => {
    if (onOpacityChange) onOpacityChange(Number(paintOpacity.value) / 100);
  });
  btnBeforeAfter.addEventListener('click', () => {
    beforeAfterMode = !beforeAfterMode;
    btnBeforeAfter.textContent = beforeAfterMode ? '🎨 Show Paint' : '👁 Before / After';
    if (onBeforeAfter) onBeforeAfter(beforeAfterMode);
  });
  btnClearPaint.addEventListener('click', () => {
    if (onClearPaint) onClearPaint();
    showToast('Paint cleared', 'info');
  });

  /* ── Screenshot ─────────────────────────────────────────── */
  const btnScreenshot = document.getElementById('btn-screenshot');
  const flash         = document.getElementById('flash');

  function takeScreenshot(arCanvas, videoEl) {
    // Composite camera feed + AR canvas
    const w = arCanvas.width, h = arCanvas.height;
    const composite = document.createElement('canvas');
    composite.width  = w;
    composite.height = h;
    const ctx = composite.getContext('2d');

    // Draw video
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, 0, 0, w, h);
    ctx.restore();

    // Draw AR overlay
    ctx.drawImage(arCanvas, 0, 0);

    // Flash effect
    flash.classList.add('snap');
    setTimeout(() => flash.classList.remove('snap'), 150);

    // Download
    composite.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `arviz-snapshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📸 Screenshot saved!', 'success');
    });
  }

  /* ── Product pill ───────────────────────────────────────── */
  function setProductInfo(name, price) {
    document.getElementById('pill-name').textContent  = name;
    document.getElementById('pill-price').textContent = price || '';
  }

  /* ── Flip camera ────────────────────────────────────────── */
  const btnFlip = document.getElementById('btn-flip');
  let   onFlip  = null;
  btnFlip.addEventListener('click', () => { if (onFlip) onFlip(); });

  /* ── Auto hide hint ─────────────────────────────────────── */
  setTimeout(() => hintText.classList.add('hidden'), 4000);

  return {
    // Mode
    switchMode,
    getMode: () => currentMode,
    set onModeChange(fn) { onModeChange = fn; },

    // Furniture
    set onScale(fn)  { onScale  = fn; },
    set onRotate(fn) { onRotate = fn; },
    set onPlace(fn)  { onPlace  = fn; },
    set onRemove(fn) { onRemove = fn; },

    // Accessories
    set onAccChange(fn) { onAccChange = fn; },
    set onAccSize(fn)   { onAccSize   = fn; },

    // Paint
    set onColorChange(fn)   { onColorChange   = fn; },
    set onOpacityChange(fn) { onOpacityChange = fn; },
    set onBeforeAfter(fn)   { onBeforeAfter   = fn; },
    set onClearPaint(fn)    { onClearPaint    = fn; },
    getPaintColor:   () => customColor.value,
    getPaintOpacity: () => Number(paintOpacity.value) / 100,

    // Misc
    takeScreenshot,
    setProductInfo,
    showToast,
    set onFlip(fn) { onFlip = fn; },
    btnScreenshot
  };
})();
