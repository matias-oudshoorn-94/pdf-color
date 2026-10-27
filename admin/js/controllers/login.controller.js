import { session } from '/js/models/session.js';
import { logoMark } from '/js/views/logo.view.js';
import { toastErr } from '/js/lib/toast.js';

/** Pantalla de acceso propia del panel: solo entran usuarios con rol admin. */
export function loginScreen(onSuccess) {
  const view = document.createElement('div');

  view.className = 'admin-login';
  view.innerHTML = `
    <div class="admin-login__card">
      <div class="admin-login__head">
        ${logoMark({ size: 72 })}
        <span class="sidebar__tag">Panel de administración</span>
      </div>
      <form class="form" id="login-form" novalidate>
        <label class="field">
          <span class="field__label">Email</span>
          <input class="input" name="email" type="email" required autocomplete="email" autofocus />
        </label>
        <label class="field">
          <span class="field__label">Contraseña</span>
          <input class="input" name="password" type="password" required autocomplete="current-password" />
        </label>
        <p class="field__error" id="login-error" hidden></p>
        <button class="btn btn--primary btn--block" type="submit">Ingresar</button>
      </form>
      <a class="muted" href="/" style="text-align:center;font-size:.85rem">← Volver al sitio</a>
    </div>
  `;

  const form = view.querySelector('#login-form');
  const errorBox = view.querySelector('#login-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const button = form.querySelector('button[type="submit"]');
    errorBox.hidden = true;
    button.disabled = true;

    try {
      const user = await session.login(Object.fromEntries(new FormData(form)));

      if (user.role !== 'admin') {
        await session.logout();
        throw new Error('Esta cuenta no tiene permisos de administrador');
      }

      onSuccess();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      toastErr(error.message);
      button.disabled = false;
    }
  });

  return view;
}
