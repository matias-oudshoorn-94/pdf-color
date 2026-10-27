import { session } from '/js/models/session.js';
import { logoMark } from '/js/views/logo.view.js';
import { esc } from '/js/lib/dom.js';
import { toastErr } from '/js/lib/toast.js';
import { loginScreen } from './controllers/login.controller.js';
import { AdminApi } from './models/admin.api.js';
import { SECTIONS, navigate, onNavigate, resolve } from './router.js';

const app = document.getElementById('app');

function shell(user, activePath) {
  return `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="sidebar__brand">
          ${logoMark({ size: 44 })}
          <span class="sidebar__tag">Panel de administración</span>
        </div>

        <nav class="sidebar__nav">
          ${SECTIONS.map(
            (section) => `
              <a class="sidebar__link" href="${section.path}" data-link
                 ${section.path === activePath ? 'aria-current="page"' : ''}>${section.label}</a>`,
          ).join('')}
        </nav>

        <div class="sidebar__footer">
          <span>${esc(user.name)}<br /><span class="muted">${esc(user.email)}</span></span>
          <a class="btn btn--sm btn--ghost" href="/">Ver el sitio</a>
          <button class="btn btn--sm" id="logout" type="button">Cerrar sesión</button>
        </div>
      </aside>

      <main class="admin-main">
        <header class="admin-head">
          <h1 id="section-title"></h1>
          <div class="copies-sold" title="Copias de todos los pedidos no cancelados">
            <span class="copies-sold__value" id="copies-sold">—</span>
            <span class="copies-sold__label">Copias vendidas</span>
          </div>
        </header>
        <div id="view"></div>
      </main>
    </div>
  `;
}

async function renderSection() {
  const { page } = resolve();
  const { title, html, mount } = page();
  const view = document.getElementById('view');

  document.getElementById('section-title').textContent = title;
  document.title = `${title} · Panel PDF Color`;
  view.innerHTML = html;

  await mount?.(view);
}

// Se pide de nuevo en cada cambio de sección, así refleja pedidos nuevos o cancelados.
async function renderCopiesSold() {
  const target = document.getElementById('copies-sold');

  try {
    const { copiesSold } = await AdminApi.copiesSold();
    target.textContent = copiesSold.toLocaleString('es-AR');
  } catch {
    target.textContent = '—';
  }
}

function paint() {
  if (!session.isAdmin) {
    app.replaceChildren(loginScreen(paint));

    return;
  }

  app.innerHTML = shell(session.user, resolve().activePath);

  for (const link of app.querySelectorAll('[data-link]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.getAttribute('href'));
    });
  }

  app.querySelector('#logout').addEventListener('click', async () => {
    try {
      await session.logout();
      paint();
    } catch (error) {
      toastErr(error.message);
    }
  });

  renderSection();
  renderCopiesSold();
}

onNavigate(paint);
window.addEventListener('popstate', paint);

// Pinta ya mismo (pantalla de login mientras se confirma la sesión) en vez de
// dejar todo en blanco hasta que /auth/me responda.
paint();
session.load().then(paint);
