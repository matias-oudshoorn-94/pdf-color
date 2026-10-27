import { el } from '/js/lib/dom.js';

/** Modal reutilizable: devuelve una promesa que resuelve con los datos del formulario o null. */
export function openModal({ title, body, confirmLabel = 'Guardar', onSubmit, onMount }) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });

    overlay.innerHTML = `
      <div class="modal__card">
        <div class="modal__head">
          <h3>${title}</h3>
          <button class="btn btn--sm btn--ghost" data-close type="button">Cerrar</button>
        </div>
        <form class="form" data-form>
          ${body}
          <p class="field__error" data-error hidden></p>
          <div class="modal__actions">
            <button class="btn btn--ghost" type="button" data-close>Cancelar</button>
            <button class="btn btn--primary" type="submit">${confirmLabel}</button>
          </div>
        </form>
      </div>
    `;

    const form = overlay.querySelector('[data-form]');
    const errorBox = overlay.querySelector('[data-error]');

    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };

    function onKey(event) {
      if (event.key === 'Escape') close(null);
    }

    for (const button of overlay.querySelectorAll('[data-close]')) {
      button.addEventListener('click', () => close(null));
    }

    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) close(null);
    });

    document.addEventListener('keydown', onKey);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      const submit = form.querySelector('button[type="submit"]');
      errorBox.hidden = true;
      submit.disabled = true;

      try {
        const result = await onSubmit(Object.fromEntries(new FormData(form)), form);
        close(result ?? true);
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        submit.disabled = false;
      }
    });

    document.body.append(overlay);
    onMount?.(form);
    form.querySelector('input, select, textarea')?.focus();
  });
}

/** Confirmación simple con el mismo estilo del panel. */
export function confirmAction(message, confirmLabel = 'Eliminar') {
  return openModal({
    title: 'Confirmar',
    body: `<p>${message}</p>`,
    confirmLabel,
    onSubmit: () => true,
  });
}
