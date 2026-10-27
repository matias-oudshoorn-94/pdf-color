import { session } from './models/session.js';
import { homePage } from './controllers/home.controller.js';
import { forgotPasswordPage, loginPage, registerPage, resetPasswordPage } from './controllers/auth.controller.js';
import { catalogPage } from './controllers/catalog.controller.js';
import { uploadPage } from './controllers/upload.controller.js';
import { cartPage, ordersPage } from './controllers/orders.controller.js';
import { paymentResultPage } from './controllers/payment-result.controller.js';
import { aboutPage, contactPage } from './controllers/pages.controller.js';
import { accountPage } from './controllers/account.controller.js';
import { orderDetailPage } from './controllers/order-detail.controller.js';
import { emptyState } from './views/components.view.js';

const routes = {
  '/': { page: homePage },
  '/nosotros': { page: aboutPage },
  '/contacto': { page: contactPage },
  '/login': { page: loginPage, guest: true },
  '/registro': { page: registerPage, guest: true },
  '/recuperar-contrasena': { page: forgotPasswordPage, guest: true },
  '/restablecer-contrasena': { page: resetPasswordPage, guest: true },
  '/catalogo': { page: catalogPage },
  '/subir': { page: uploadPage },
  '/pedido': { page: cartPage },
  // Sin auth: a la vuelta de Mercado Pago puede no haber sesión (otro navegador).
  '/pedido/resultado': { page: paymentResultPage },
  '/pedidos': { page: ordersPage, auth: true },
  '/cuenta': { page: accountPage, auth: true },
};

const notFound = () => ({ html: `<section class="page">${emptyState('Página no encontrada', 'Revisá la dirección.')}</section>` });

/** Rutas con parámetros. */
const DETAIL_ROUTES = [
  { pattern: /^\/pedidos\/(\d+)$/, auth: true, page: (id) => orderDetailPage(Number(id)) },
];

function matchRoute(path) {
  if (routes[path]) return routes[path];

  for (const route of DETAIL_ROUTES) {
    const match = path.match(route.pattern);

    if (match) return { ...route, page: () => route.page(match[1]) };
  }

  return null;
}

let onRender = () => {};

export function onRouteChange(fn) {
  onRender = fn;
}

export function navigate(path, { replace = false } = {}) {
  if (path === location.pathname) return render();
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  render();
}

export async function render() {
  const path = location.pathname;
  const route = matchRoute(path);

  // Las rutas públicas no esperan nada; solo las que dependen de si hay sesión
  // (protegidas o exclusivas de invitado) esperan a que /auth/me resuelva.
  if (route?.auth || route?.guest) {
    await session.load();
  }

  // Con ?next= para volver acá después de ingresar (ej: la vuelta de Mercado Pago
  // en otro navegador, donde no hay sesión, no pierde el resultado del pago).
  if (route?.auth && !session.isAuth) {
    return navigate(`/login?next=${encodeURIComponent(path + location.search)}`, { replace: true });
  }
  if (route?.guest && session.isAuth) return navigate('/catalogo', { replace: true });

  onRender(path);

  const view = document.getElementById('view');
  const { html, mount } = route ? route.page() : notFound();
  view.innerHTML = html;
  window.scrollTo({ top: 0 });
  await mount?.(view);
}

export function startRouter() {
  window.addEventListener('popstate', render);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link) return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
  });

  render();
}
