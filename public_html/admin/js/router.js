import { dashboardPage } from './controllers/dashboard.controller.js';
import { reportsPage } from './controllers/reports.controller.js';
import { ordersPage } from './controllers/orders.controller.js';
import { orderDetailPage } from './controllers/order-detail.controller.js';
import { filesPage } from './controllers/files.controller.js';
import { adminsPage, clientsPage } from './controllers/users.controller.js';
import { careersPage, institutionsPage, locationsPage, subjectsPage, yearsPage } from './controllers/taxonomy.controller.js';
import { pickupPointsPage, priceTiersPage } from './controllers/checkout.controller.js';
import { messagesPage } from './controllers/messages.controller.js';
import { mpAccountsPage } from './controllers/mp-accounts.controller.js';
import { settingsPage } from './controllers/settings.controller.js';

/**
 * Secciones del menú lateral. `alert` es el contador de /admin/alerts que se muestra
 * al lado del nombre cuando hay algo pendiente. Las que no tienen `group` van arriba,
 * siempre visibles y con ícono; el resto se agrupa en los desplegables de NAV_GROUPS.
 */
export const SECTIONS = [
  { path: '/admin', label: 'Resumen', page: dashboardPage, icon: 'home' },
  { path: '/admin/pedidos', label: 'Pedidos', page: ordersPage, icon: 'orders', alert: 'pendingOrders', alertTitle: 'pedidos nuevos' },
  { path: '/admin/mensajes', label: 'Mensajes', page: messagesPage, icon: 'messages', alert: 'unreadMessages', alertTitle: 'mensajes sin leer' },
  { path: '/admin/reportes', label: 'Reportes', page: reportsPage, icon: 'reports' },

  { path: '/admin/archivos', label: 'Archivos', page: filesPage, group: 'catalogo' },
  { path: '/admin/localidades', label: 'Localidades', page: locationsPage, group: 'catalogo' },
  { path: '/admin/instituciones', label: 'Instituciones', page: institutionsPage, group: 'catalogo' },
  { path: '/admin/anios', label: 'Años', page: yearsPage, group: 'catalogo' },
  { path: '/admin/carreras', label: 'Carreras', page: careersPage, group: 'catalogo' },
  { path: '/admin/materias', label: 'Materias', page: subjectsPage, group: 'catalogo' },

  { path: '/admin/precios-por-cantidad', label: 'Precios por cantidad', page: priceTiersPage, group: 'precios' },
  { path: '/admin/precios', label: 'Recargos y envío', page: settingsPage, group: 'precios' },
  { path: '/admin/puntos-retiro', label: 'Puntos de retiro', page: pickupPointsPage, group: 'precios' },
  { path: '/admin/mercadopago', label: 'Cuentas de Mercado Pago', page: mpAccountsPage, group: 'precios' },

  { path: '/admin/clientes', label: 'Clientes', page: clientsPage, group: 'usuarios' },
  { path: '/admin/administradores', label: 'Administradores', page: adminsPage, group: 'usuarios' },
];

/** Desplegables del menú, en el orden en que se muestran (debajo de las secciones sueltas). */
export const NAV_GROUPS = [
  { id: 'catalogo', label: 'Catálogo', icon: 'catalog' },
  { id: 'precios', label: 'Precios y cobros', icon: 'prices' },
  { id: 'usuarios', label: 'Usuarios', icon: 'users' },
];

/** Rutas con parámetros que no aparecen en el menú. */
const DETAIL_ROUTES = [
  { pattern: /^\/admin\/pedidos\/(\d+)$/, parent: '/admin/pedidos', page: (id) => orderDetailPage(Number(id)) },
];

let listener = () => {};

export function onNavigate(callback) {
  listener = callback;
}

export function navigate(path) {
  if (path === location.pathname) return listener();

  history.pushState({}, '', path);
  listener();
}

/** Devuelve { page, activePath } para la URL actual. */
export function resolve() {
  const path = location.pathname.replace(/\/$/, '') || '/admin';

  for (const route of DETAIL_ROUTES) {
    const match = path.match(route.pattern);

    if (match) {
      return { page: () => route.page(match[1]), activePath: route.parent };
    }
  }

  const section = SECTIONS.find((item) => item.path === path) ?? SECTIONS[0];

  return { page: section.page, activePath: section.path };
}
