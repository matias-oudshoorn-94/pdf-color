import { session } from '../models/session.js';
import { logoMark } from '../views/logo.view.js';
import { toastErr, toastOk } from '../lib/toast.js';
import { navigate } from '../router.js';
import { getRecaptchaToken, recaptchaDisclaimer } from '../lib/recaptcha.js';
import { renderGoogleButton } from '../lib/google.js';

const aside = `
  <div class="hero">
    ${logoMark({ size: 140 })}
    <h1>Tu imprenta, online.</h1>
    <p class="hero__lead">Guardá tus archivos una vez y volvé a pedirlos las veces que quieras.</p>
  </div>
`;

function formShell(title, subtitle, fields, submitLabel, footer, extra = '') {
  return `
    <section class="page">
      <div class="auth-layout">
        ${aside}
        <div class="card card--pad">
          <h2>${title}</h2>
          <p style="margin-bottom:18px">${subtitle}</p>
          <form class="form" id="auth-form" novalidate>
            ${fields}
            <p class="field__error" id="form-error" hidden></p>
            <button class="btn btn--primary btn--block" type="submit">${submitLabel}</button>
            ${recaptchaDisclaimer}
          </form>
          ${extra}
          <p class="muted" style="margin-top:16px;font-size:.85rem">${footer}</p>
        </div>
      </div>
    </section>
  `;
}

const field = (id, label, type, extra = '') => `
  <label class="field">
    <span class="field__label">${label}</span>
    <input class="input" id="${id}" name="${id}" type="${type}" ${extra} />
  </label>
`;

/** Ruta a la que volver después de ingresar (ej: /login?next=/pedido desde el checkout). */
function nextPath() {
  const next = new URLSearchParams(location.search).get('next') ?? '';

  return next.startsWith('/') && !next.startsWith('//') ? next : '/catalogo';
}

/** Mantiene el ?next= al pasar entre login y registro. */
const withNext = (path) => (location.search.includes('next=') ? path + location.search : path);

const defaultOnSuccess = () => {
  toastOk('¡Bienvenido!');
  navigate(nextPath());
};

// Oculto hasta que el botón de Google carga: sin google.client_id configurado no aparece nada.
const googleSection = `
  <div id="google-login" hidden>
    <div class="auth-divider"><span>o</span></div>
    <div class="auth-google" data-google-button></div>
  </div>
`;

async function mountGoogle(root) {
  const section = root.querySelector('#google-login');

  // El botón necesita medir su ancho, así que el contenedor tiene que estar visible al pintarlo.
  section.hidden = false;

  const rendered = await renderGoogleButton(section.querySelector('[data-google-button]'), async (credential) => {
    try {
      await session.loginWithGoogle(credential);
      defaultOnSuccess();
    } catch (error) {
      toastErr(error.message);
    }
  });

  if (!rendered) section.hidden = true;
}

function bind(root, action, handler, onSuccess = defaultOnSuccess) {
  const form = root.querySelector('#auth-form');
  const errorBox = root.querySelector('#form-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    errorBox.hidden = true;
    button.disabled = true;

    try {
      const recaptchaToken = await getRecaptchaToken(action);
      const result = await handler({ ...data, recaptchaToken });
      onSuccess(result, data);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      toastErr(error.message);
    } finally {
      button.disabled = false;
    }
  });
}

export function loginPage() {
  return {
    html: formShell(
      'Ingresar',
      'Accedé con tu email y contraseña.',
      field('email', 'Email', 'email', 'required autocomplete="email" placeholder="vos@email.com"') +
        field('password', 'Contraseña', 'password', 'required autocomplete="current-password"') +
        '<p style="text-align:right;margin-top:-8px">' +
        '<a href="/recuperar-contrasena" data-link style="text-decoration:underline;font-size:.85rem">¿Olvidaste tu contraseña?</a>' +
        '</p>',
      'Ingresar',
      `¿No tenés cuenta? <a href="${withNext('/registro')}" data-link style="text-decoration:underline">Registrate</a>`,
      googleSection,
    ),
    mount: (root) => {
      bind(root, 'login', (data) => session.login(data));
      mountGoogle(root);
    },
  };
}

export function registerPage() {
  return {
    html: formShell(
      'Crear cuenta',
      'Necesitás una cuenta para confirmar tus pedidos y seguir su estado.',
      field('name', 'Nombre y apellido', 'text', 'required minlength="2" autocomplete="name"') +
        field('email', 'Email', 'email', 'required autocomplete="email"') +
        field('phone', 'Teléfono', 'tel', 'required minlength="6" autocomplete="tel"') +
        field('password', 'Contraseña', 'password', 'required minlength="8" autocomplete="new-password"') +
        '<span class="field__hint">Mínimo 8 caracteres.</span>',
      'Crear cuenta',
      `¿Ya tenés cuenta? <a href="${withNext('/login')}" data-link style="text-decoration:underline">Ingresá</a>`,
      googleSection,
    ),
    mount: (root) => {
      bind(root, 'register', (data) => session.register(data));
      mountGoogle(root);
    },
  };
}

export function forgotPasswordPage() {
  return {
    html: formShell(
      'Recuperar contraseña',
      'Ingresá tu email y te mandamos un link para definir una contraseña nueva.',
      field('email', 'Email', 'email', 'required autocomplete="email" placeholder="vos@email.com"'),
      'Enviar link',
      `<a href="/login" data-link style="text-decoration:underline">Volver a ingresar</a>`,
    ),
    mount: (root) =>
      bind(
        root,
        'forgot_password',
        (data) => session.forgotPassword(data.email, data.recaptchaToken),
        () => {
          root.querySelector('#auth-form').replaceWith(
            Object.assign(document.createElement('p'), {
              className: 'muted',
              textContent:
                'Si ese email está registrado, te enviamos un link para restablecer tu contraseña. Revisá tu bandeja de entrada (y spam).',
            }),
          );
        },
      ),
  };
}

export function resetPasswordPage() {
  const token = new URLSearchParams(location.search).get('token') ?? '';

  if (!token) {
    return {
      html: `
        <section class="page">
          <div class="auth-layout">
            ${aside}
            <div class="card card--pad">
              <h2>Link inválido</h2>
              <p class="muted" style="margin-bottom:18px">Este link no es válido o ya venció. Pedí uno nuevo.</p>
              <a class="btn btn--primary btn--block" href="/recuperar-contrasena" data-link>Pedir un link nuevo</a>
            </div>
          </div>
        </section>
      `,
    };
  }

  return {
    html: formShell(
      'Elegí una contraseña nueva',
      'Definí la nueva contraseña para tu cuenta.',
      field('password', 'Contraseña nueva', 'password', 'required minlength="8" autocomplete="new-password"') +
        field('passwordConfirm', 'Repetir contraseña', 'password', 'required minlength="8" autocomplete="new-password"') +
        '<span class="field__hint">Mínimo 8 caracteres.</span>',
      'Guardar contraseña',
      `<a href="/login" data-link style="text-decoration:underline">Volver a ingresar</a>`,
    ),
    mount: (root) =>
      bind(root, 'reset_password', (data) => {
        if (data.password !== data.passwordConfirm) {
          throw new Error('Las contraseñas no coinciden');
        }

        return session.resetPassword(token, data.password, data.recaptchaToken);
      }),
  };
}
