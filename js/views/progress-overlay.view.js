import { formatBytes } from '../lib/format.js';

/** Overlay de pantalla completa que bloquea la interacción mientras algo se sube/procesa. */
export function openProgressOverlay({ title = 'Subiendo…' } = {}) {
  const el = document.createElement('div');
  el.className = 'upload-overlay';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.innerHTML = `
    <div class="upload-overlay__panel">
      <span class="spinner" aria-hidden="true"></span>
      <strong class="upload-overlay__title" data-title>${title}</strong>
      <div class="upload-overlay__bar"><div class="upload-overlay__fill" data-fill style="width:0%"></div></div>
      <div class="upload-overlay__foot">
        <span class="upload-overlay__pct" data-pct>0%</span>
        <span class="upload-overlay__bytes" data-bytes></span>
      </div>
    </div>
  `;

  document.body.append(el);
  document.body.style.overflow = 'hidden';

  const fill = el.querySelector('[data-fill]');
  const pct = el.querySelector('[data-pct]');
  const bytesEl = el.querySelector('[data-bytes]');
  const titleEl = el.querySelector('[data-title]');

  // El navegador dispara pocos eventos de progreso en conexiones rápidas/loopback
  // (a veces uno solo, directo al 100%). Se interpola cuadro a cuadro hacia el valor
  // real para que la barra avance de forma continua en vez de saltar de golpe.
  let target = 0;
  let displayed = 0;
  let raf = null;
  let closed = false;

  function paint() {
    const value = Math.round(displayed * 100);
    fill.style.width = `${value}%`;
    pct.textContent = `${value}%`;
  }

  function tick() {
    raf = null;
    if (closed) return;

    const diff = target - displayed;
    displayed = Math.abs(diff) < 0.004 ? target : displayed + diff * 0.2;
    paint();

    if (displayed !== target) raf = requestAnimationFrame(tick);
  }

  return {
    /** progress: { loaded, total, ratio } del evento real de subida. */
    setProgress({ loaded, total, ratio }) {
      el.classList.remove('is-indeterminate');
      target = Math.max(0, Math.min(1, ratio));
      bytesEl.textContent = `${formatBytes(loaded)} / ${formatBytes(total)}`;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    /** Para la fase posterior a la subida (procesamiento en el servidor), sin porcentaje conocido. */
    setIndeterminate(label = 'Procesando…') {
      target = 1;
      displayed = 1;
      paint();
      el.classList.add('is-indeterminate');
      pct.textContent = label;
      bytesEl.textContent = '';
    },
    setTitle(text) {
      titleEl.textContent = text;
    },
    close() {
      closed = true;
      el.remove();
      document.body.style.overflow = '';
    },
  };
}
