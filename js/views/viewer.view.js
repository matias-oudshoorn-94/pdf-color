import { esc } from '../lib/dom.js';
import { truncate } from '../lib/format.js';

const PREVIEWABLE = (mime = '') => mime === 'application/pdf' || mime.startsWith('image/');

const body = (file) => {
  const src = `/api/files/${file.id}/preview`;

  if (file.mime_type === 'application/pdf') {
    return `<iframe class="viewer__frame" src="${src}#view=FitH" title="${esc(file.title)}"></iframe>`;
  }

  if (file.mime_type.startsWith('image/')) {
    return `<img class="viewer__image" src="${src}" alt="${esc(file.title)}" />`;
  }

  return `
    <div class="viewer__fallback">
      <strong>No se puede previsualizar este formato</strong>
    </div>
  `;
};

/** Visor de archivos en pantalla completa. Se cierra con Escape, la X o el fondo. */
export function openViewer(file) {
  const overlay = document.createElement('div');

  overlay.className = 'viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="viewer__card">
      <header class="viewer__head">
        <div class="viewer__title">
          <strong title="${esc(file.title)}">${esc(truncate(file.title))}</strong>
          <span class="muted">${esc(file.original_name)}</span>
        </div>
        <div class="row">
          <button class="btn btn--sm btn--ghost" data-close type="button" aria-label="Cerrar">Cerrar</button>
        </div>
      </header>
      <div class="viewer__body">${body(file)}</div>
    </div>
  `;

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
  };

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  overlay.querySelector('[data-close]').addEventListener('click', close);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.style.overflow = 'hidden';
  document.body.append(overlay);
  overlay.querySelector('[data-close]').focus();

  return close;
}

export { PREVIEWABLE as isPreviewable };
