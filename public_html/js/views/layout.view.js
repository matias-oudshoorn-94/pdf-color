import { esc } from '../lib/dom.js';
import { logoMark } from './logo.view.js';
import { socialLinks, whatsappLink } from './social.view.js';

const LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/nosotros', label: 'Quiénes somos' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/subir', label: 'Subir archivo' },
  { href: '/catalogo', label: 'Catálogo' },
];

const ACCOUNT_LINKS = [
  { href: '/cuenta', label: 'Mis datos' },
  { href: '/pedidos', label: 'Mis pedidos' },
  { href: '/pedido', label: 'Pedido en curso' },
];

const cartIcon = `
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
    <circle cx="10" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
  </svg>
`;

const chevron = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
`;

export function layoutView({ user, path, cartCount, whatsapp }) {
  const navLinks = LINKS
    .map(
      (link) =>
        `<a class="nav__link" href="${link.href}" data-link ${path === link.href ? 'aria-current="page"' : ''}>
           ${esc(link.label)}
         </a>`,
    )
    .join('');

  const cart = `
    <a class="cart" href="/pedido" data-link aria-label="Mi pedido" title="Mi pedido">
      ${cartIcon}
      <span class="cart__count" data-cart-count ${cartCount ? '' : 'hidden'}>${cartCount}</span>
    </a>`;

  const checkoutBar =
    cartCount > 0 && path !== '/pedido'
      ? `<div class="checkout-bar" data-checkout-bar>
           <div class="container checkout-bar__inner">
             <span class="checkout-bar__count">${cartCount} archivo${cartCount === 1 ? '' : 's'} en tu pedido</span>
             <a class="btn btn--primary checkout-bar__cta" href="/pedido" data-link>Finalizar compra</a>
           </div>
         </div>`
      : '';

  const account = user
    ? `<div class="account" data-account>
         <button class="account__toggle" type="button" data-account-toggle aria-expanded="false" aria-haspopup="true">
           <span class="account__avatar">${esc(user.name.trim().charAt(0).toUpperCase())}</span>
           <span class="account__name">Mi cuenta</span>
           ${chevron}
         </button>
         <div class="account__menu" data-account-menu hidden>
           <div class="account__header">
             <strong>${esc(user.name)}</strong>
             <span class="muted">${esc(user.email)}</span>
           </div>
           ${ACCOUNT_LINKS.map(
             (link) => `<a class="account__item" href="${link.href}" data-link>${esc(link.label)}</a>`,
           ).join('')}
           ${user.role === 'admin' ? '<a class="account__item" href="/admin">Panel de administración</a>' : ''}
           <button class="account__item account__item--danger" type="button" data-action="logout">Cerrar sesión</button>
         </div>
       </div>`
    : `<a class="btn btn--sm btn--ghost" href="/login" data-link>Ingresar</a>
       <a class="btn btn--sm btn--primary" href="/registro" data-link>Crear cuenta</a>`;

  return `
    <div class="shell">
      <div class="topbar">
        <div class="container topbar__inner">
          <span class="topbar__text">Imprimimos con la mejor calidad, rápido y cerca tuyo.</span>
          <div class="topbar__social">
            ${socialLinks({ className: 'social social--topbar' })}
            ${whatsappLink(whatsapp, { className: 'social social--topbar social--whatsapp' })}
          </div>
        </div>
      </div>

      <header class="header">
        <div class="container header__inner">
          <a class="brand" href="/" data-link aria-label="PDF Color · inicio">
            ${logoMark({ size: 72 })}
          </a>

          <button class="burger" type="button" aria-label="Abrir menú" data-action="burger">☰</button>

          <nav class="nav" id="nav">
            ${navLinks}
            <div class="nav__actions">
              ${cart}
              ${account}
            </div>
          </nav>
        </div>
      </header>

      <main class="main">
        <div class="container" id="view"></div>
      </main>

      <footer class="footer">
        <div class="container footer__inner">
          <span>© ${new Date().getFullYear()} PDF Color · Imprenta Mar del Plata</span>
          <div class="social-footer social--footer-group">${socialLinks({ className: 'social social--footer' })}</div>
          <span>Desarrollado por <a style="color:#4ade80;font-weight:bold" href="https://api.whatsapp.com/send?phone=5492235044427">Matias Oudshoorn</a></span>
        </div>
      </footer>

      ${checkoutBar}
    </div>
  `;
}
