import { dashboardPage } from './controllers/dashboard.controller.js';
import { reportsPage } from './controllers/reports.controller.js';
import { ordersPage } from './controllers/orders.controller.js';
import { orderDetailPage } from './controllers/order-detail.controller.js';
import { filesPage } from './controllers/files.controller.js';
import { adminsPage, clientsPage } from './controllers/users.controller.js';
import { careersPage, institutionsPage, locationsPage, subjectsPage, yearsPage } from './controllers/taxonomy.controller.js';
import { discountTiersPage, pickupPointsPage } from './controllers/checkout.controller.js';
import { messagesPage } from './controllers/messages.controller.js';
import { settingsPage } from './controllers/settings.controller.js';

/** Secciones visibles en el menú lateral. */
export const SECTIONS = [
  { path: '/admin', label: 'Resumen', page: dashboardPage },
  { path: '/admin/reportes', label: 'Reportes', page: reportsPage },
  { path: '/admin/precios', label: 'Precios', page: settingsPage },
  { path: '/admin/descuentos', label: 'Descuentos por cantidad', page: discountTiersPage },
  { path: '/admin/puntos-retiro', label: 'Puntos de retiro', page: pickupPointsPage },
  { path: '/admin/pedidos', label: 'Pedidos', page: ordersPage },
  { path: '/admin/archivos', label: 'Archivos', page: filesPage },
  { path: '/admin/localidades', label: 'Localidades', page: locationsPage },
  { path: '/admin/instituciones', label: 'Instituciones', page: institutionsPage },
  { path: '/admin/anios', label: 'Años', page: yearsPage },
  { path: '/admin/carreras', label: 'Carreras', page: careersPage },
  { path: '/admin/materias', label: 'Materias', page: subjectsPage },
  { path: '/admin/clientes', label: 'Clientes', page: clientsPage },
  { path: '/admin/administradores', label: 'Administradores', page: adminsPage },
  { path: '/admin/mensajes', label: 'Mensajes', page: messagesPage },
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
