import { session } from '/js/models/session.js';
import { logoMark } from '/js/views/logo.view.js';
import { esc } from '/js/lib/dom.js';
import { toastErr } from '/js/lib/toast.js';
import { loginScreen } from './controllers/login.controller.js';
import { AdminApi } from './models/admin.api.js';
import { NAV_GROUPS, SECTIONS, navigate, onNavigate, resolve } from './router.js';
import { ICONS } from './views/icons.view.js';

const app = document.getElementById('app');

// Desplegables abiertos a mano, para que sigan abiertos al cambiar de sección.
// El grupo de la sección actual se abre siempre.
const OPEN_GROUPS_KEY = 'pdfcolor.admin.openGroups';

function readOpenGroups() {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveOpenGroups(ids) {
  try {
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...ids]));
  } catch {
    // Sin localStorage (modo privado): los desplegables simplemente no se recuerdan.
  }
}

// En el celular el menú se abre con un botón; queda abierto hasta elegir una sección.
let mobileMenuOpen = false;

function navLink(section, activePath, { child = false } = {}) {
  return `
    <a class="sidebar__link ${child ? 'sidebar__link--child' : ''}" href="${section.path}" data-link
       ${section.path === activePath ? 'aria-current="page"' : ''}>
      ${child ? '' : ICONS[section.icon] ?? ''}
      <span class="sidebar__label">${section.label}</span>
      ${section.alert ? `<span class="sidebar__count sidebar__count--alert" data-alert="${section.alert}" hidden></span>` : ''}
    </a>`;
}

function navGroup(group, activePath, openGroups) {
  const sections = SECTIONS.filter((section) => section.group === group.id);
  const hasActive = sections.some((section) => section.path === activePath);

  return `
    <details class="sidebar__group" data-group="${group.id}" ${hasActive || openGroups.has(group.id) ? 'open' : ''}>
      <summary class="sidebar__link sidebar__group-head ${hasActive ? 'has-active' : ''}">
        ${ICONS[group.icon]}
        <span class="sidebar__label">${group.label}</span>
        <span class="sidebar__chevron">${ICONS.chevron}</span>
      </summary>
      <div class="sidebar__group-items">
        ${sections.map((section) => navLink(section, activePath, { child: true })).join('')}
      </div>
    </details>`;
}

function shell(user, activePath) {
  const openGroups = readOpenGroups();
  const activeSection = SECTIONS.find((section) => section.path === activePath);

  return `
    <div class="admin-shell">
      <aside class="sidebar ${mobileMenuOpen ? 'is-open' : ''}">
        <div class="sidebar__brand">
          ${logoMark({ size: 44 })}
          <span class="sidebar__tag">Panel de administración</span>
          <button class="btn btn--sm sidebar__toggle" id="menu-toggle" type="button" aria-expanded="${mobileMenuOpen}">
            ${ICONS.menu} ${activeSection ? activeSection.label : 'Menú'}
          </button>
        </div>

        <nav class="sidebar__nav">
          ${SECTIONS.filter((section) => !section.group).map((section) => navLink(section, activePath)).join('')}
          <div class="sidebar__divider"></div>
          ${NAV_GROUPS.map((group) => navGroup(group, activePath, openGroups)).join('')}
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
  baseTitle = `${title} · Panel PDF Color`;
  applyTitle();
  view.innerHTML = html;

  await mount?.(view);
}

// Título de la pestaña con la cantidad de pendientes adelante, ej. "(3) Resumen · Panel PDF Color",
// para notarlo aunque el panel esté en otra pestaña.
let baseTitle = 'Panel PDF Color';
let pendingTotal = 0;

function applyTitle() {
  document.title = pendingTotal > 0 ? `(${pendingTotal}) ${baseTitle}` : baseTitle;
}

// Contadores de pedidos nuevos y mensajes sin leer en el menú lateral.
async function renderAlerts() {
  if (!session.isAdmin) return;

  try {
    const alerts = await AdminApi.alerts();
    pendingTotal = 0;

    for (const section of SECTIONS.filter((item) => item.alert)) {
      const count = alerts[section.alert] ?? 0;
      const badge = app.querySelector(`[data-alert="${section.alert}"]`);
      pendingTotal += count;

      if (!badge) continue;

      badge.hidden = count === 0;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.title = `${count} ${section.alertTitle}`;
    }

    applyTitle();
  } catch {
    // Si falla, se deja lo que había: no es motivo para cortar el panel.
  }
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
      mobileMenuOpen = false;
      navigate(link.getAttribute('href'));
    });
  }

  for (const group of app.querySelectorAll('[data-group]')) {
    group.addEventListener('toggle', () => {
      const openGroups = readOpenGroups();

      if (group.open) openGroups.add(group.dataset.group);
      else openGroups.delete(group.dataset.group);

      saveOpenGroups(openGroups);
    });
  }

  app.querySelector('#menu-toggle').addEventListener('click', (event) => {
    mobileMenuOpen = !mobileMenuOpen;
    app.querySelector('.sidebar').classList.toggle('is-open', mobileMenuOpen);
    event.currentTarget.setAttribute('aria-expanded', String(mobileMenuOpen));
  });

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
  renderAlerts();
}

document.addEventListener('admin:alerts-changed', renderAlerts);

// Revisa cada minuto si entraron pedidos o mensajes nuevos.
setInterval(renderAlerts, 60_000);

onNavigate(paint);
window.addEventListener('popstate', paint);

// Pinta ya mismo (pantalla de login mientras se confirma la sesión) en vez de
// dejar todo en blanco hasta que /auth/me responda.
paint();
session.load().then(paint);
