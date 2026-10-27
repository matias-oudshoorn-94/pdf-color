import { session } from './models/session.js';
import { cart } from './models/cart.js';
import { contact } from './models/contact.js';
import { layoutView } from './views/layout.view.js';
import { navigate, onRouteChange, render, startRouter } from './router.js';
import { toastErr } from './lib/toast.js';

const app = document.getElementById('app');
let currentPath = location.pathname;

function closeAccountMenu() {
  const menu = app.querySelector('[data-account-menu]');
  const toggle = app.querySelector('[data-account-toggle]');

  if (!menu || menu.hidden) return;

  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
}

function paintLayout(path = currentPath) {
  currentPath = path;

  // paintLayout() se puede llamar sin que haya cambiado la ruta (ej: cuando la
  // sesión o el contacto resuelven después del primer pintado): si #view ya
  // tiene el contenido de la página montado, se preserva el nodo real (con sus
  // listeners) en vez de perderlo dentro de un innerHTML nuevo y vacío.
  const previousView = document.getElementById('view');

  app.innerHTML = layoutView({ user: session.user, path, cartCount: cart.count, whatsapp: contact.data?.whatsapp });

  if (previousView) {
    document.getElementById('view').replaceWith(previousView);
  }

  app.querySelector('[data-action="burger"]').addEventListener('click', () => {
    const nav = app.querySelector('#nav');
    nav.dataset.open = nav.dataset.open === 'true' ? 'false' : 'true';
  });

  const toggle = app.querySelector('[data-account-toggle]');

  toggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    const menu = app.querySelector('[data-account-menu]');
    const willOpen = menu.hidden;

    menu.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });

  app.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    try {
      await session.logout();
      navigate('/');
    } catch (error) {
      toastErr(error.message);
    }
  });
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-account]')) closeAccountMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAccountMenu();
});

function syncCheckoutBar() {
  const shouldShow = cart.count > 0 && currentPath !== '/pedido';
  let bar = app.querySelector('[data-checkout-bar]');

  if (!shouldShow) {
    bar?.remove();
    document.body.classList.remove('has-checkout-bar');
    return;
  }

  if (!bar) {
    app.querySelector('.shell')?.insertAdjacentHTML(
      'beforeend',
      `<div class="checkout-bar" data-checkout-bar>
         <div class="container checkout-bar__inner">
           <span class="checkout-bar__count"></span>
           <a class="btn btn--primary checkout-bar__cta" href="/pedido" data-link>Finalizar compra</a>
         </div>
       </div>`,
    );
    bar = app.querySelector('[data-checkout-bar]');
  }

  bar.querySelector('.checkout-bar__count').textContent = `${cart.count} archivo${cart.count === 1 ? '' : 's'} en tu pedido`;
  document.body.classList.add('has-checkout-bar');
}

// El layout se repinta en cada navegación; el carrito sólo actualiza su contador
// y la barra flotante para no destruir la vista montada.
onRouteChange((path) => {
  paintLayout(path);
  syncCheckoutBar();
});
cart.subscribe(() => {
  const badge = app.querySelector('[data-cart-count]');

  if (badge) {
    badge.textContent = cart.count;
    badge.hidden = cart.count === 0;
  }

  syncCheckoutBar();
});

// El menú/shell se pinta ya mismo (como invitado si la sesión todavía no llegó):
// antes la página entera quedaba en blanco hasta que /auth/me y /contact
// respondían, así que un backend lento (o un simple pico de latencia) dejaba
// el sitio vacío varios segundos sin ningún error visible.
paintLayout();
session.subscribe(() => paintLayout(currentPath));
contact.load().then(() => paintLayout(currentPath));
session.load();
startRouter();

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.status === 401) {
    session.set(null);
    render();
  }
});

// Limpieza del service worker de la PWA (ya eliminada) en navegadores que lo tenían instalado.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}
