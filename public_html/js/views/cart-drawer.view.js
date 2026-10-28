import { cart } from '../models/cart.js';
import { SettingsModel, TaxonomyModel } from '../models/resources.js';
import { esc } from '../lib/dom.js';
import { formatMoney, truncate } from '../lib/format.js';
import { itemTotal, ringCharge } from '../lib/pricing.js';
import { paintThumbnail } from '../lib/thumbnail.js';
import { navigate } from '../router.js';

let cachedSettings = null;
let cachedTiers = null;

/** El precio no cambia durante la sesión: se pide una sola vez. */
async function loadSettings() {
  if (cachedSettings) return cachedSettings;

  try {
    ({ settings: cachedSettings } = await SettingsModel.get());
  } catch {
    cachedSettings = { price_ring: 0, shipping_price: 0 };
  }

  return cachedSettings;
}

/** Los precios por cantidad tampoco cambian durante la sesión. */
async function loadPriceTiers() {
  if (cachedTiers) return cachedTiers;

  try {
    ({ priceTiers: cachedTiers } = await TaxonomyModel.priceTiers());
  } catch {
    cachedTiers = { doble: [], simple: [] };
  }

  return cachedTiers;
}

const itemRow = (item, priceTiers, priceRing) => `
  <div class="cart-drawer__item" data-item="${item.fileId}">
    <div class="item-thumb" data-thumb data-state="loading">
      <img alt="" loading="lazy" />
    </div>
    <div class="cart-drawer__item-body">
      <div class="cart-drawer__item-head">
        <strong title="${esc(item.title)}">${esc(truncate(item.title, 40))}</strong>
        <span>${formatMoney(itemTotal(item, priceTiers, priceRing))}</span>
      </div>
      <span class="muted">
        ${item.copies} copia${item.copies === 1 ? '' : 's'}${ringCharge(item, priceRing) ? ' · anillado' : ''}
      </span>
    </div>
    <button class="cart-drawer__item-remove" type="button" data-remove="${item.fileId}" aria-label="Quitar ${esc(item.title)} del pedido">×</button>
  </div>
`;

/** Mini-carrito lateral: se abre al agregar un archivo al pedido. */
export async function openCartDrawer() {
  const settings = await loadSettings();
  const priceRing = Number(settings.price_ring) || 0;
  const priceTiers = await loadPriceTiers();

  const overlay = document.createElement('div');
  overlay.className = 'cart-drawer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Tu pedido');

  const close = () => {
    unsubscribe();
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
  };

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  function render() {
    const items = cart.items;
    const total = items.reduce((sum, item) => sum + itemTotal(item, priceTiers, priceRing), 0);

    overlay.innerHTML = `
      <aside class="cart-drawer__panel">
        <header class="cart-drawer__head">
          <h3>Tu pedido${items.length ? ` · ${items.length}` : ''}</h3>
          <button class="btn btn--sm btn--ghost" data-close type="button" aria-label="Cerrar">Cerrar</button>
        </header>
        <div class="cart-drawer__items">
          ${
            items.length
              ? items.map((item) => itemRow(item, priceTiers, priceRing)).join('')
              : '<p class="muted">Todavía no agregaste archivos.</p>'
          }
        </div>
        <footer class="cart-drawer__footer">
          <p class="cart-drawer__total">Total estimado <strong>${formatMoney(total)}</strong></p>
          <button class="btn btn--primary btn--block" data-action="checkout" ${items.length ? '' : 'disabled'}>
            Finalizar pedido
          </button>
          <button class="btn btn--ghost btn--block" data-action="continue">Continuar comprando</button>
        </footer>
      </aside>
    `;

    for (const item of items) {
      const thumb = overlay.querySelector(`[data-item="${item.fileId}"] [data-thumb]`);
      if (thumb) paintThumbnail(thumb, { id: item.fileId, mime_type: item.mimeType });
    }
  }

  // Delegado una sola vez: el contenido interno se reemplaza en cada render().
  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]') || event.target.closest('[data-action="continue"]')) {
      close();
      return;
    }

    if (event.target.closest('[data-action="checkout"]')) {
      close();
      navigate('/pedido');
      return;
    }

    const removeButton = event.target.closest('[data-remove]');
    if (removeButton) {
      cart.remove(Number(removeButton.dataset.remove));
    }
  });

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  const unsubscribe = cart.subscribe(render);

  render();
  document.body.style.overflow = 'hidden';
  document.body.append(overlay);
  overlay.querySelector('[data-close]').focus();

  return close;
}
