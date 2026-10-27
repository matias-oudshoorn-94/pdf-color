import { cart } from '../models/cart.js';
import { session } from '../models/session.js';
import { OrdersModel, SettingsModel, TaxonomyModel } from '../models/resources.js';
import { esc } from '../lib/dom.js';
import { formatMoney, truncate } from '../lib/format.js';
import { emptyState, orderCard } from '../views/components.view.js';
import { toastErr, toastOk } from '../lib/toast.js';
import { navigate } from '../router.js';
import { bestDiscountPercent, ringCharge, itemTotal } from '../lib/pricing.js';
import { paintThumbnail } from '../lib/thumbnail.js';
import { getRecaptchaToken, recaptchaDisclaimer } from '../lib/recaptcha.js';
import { attachAddressAutocomplete } from '../lib/google.js';

// "Pagar en el local" está oculto por ahora: solo Mercado Pago. Poner en true para volver a ofrecerlo.
const PAY_IN_STORE_ENABLED = false;

const ICON_ATTRS ='viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const storeIcon = `
  <svg ${ICON_ATTRS}>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
    <path d="M9 20v-6h6v6" />
  </svg>
`;

const truckIcon = `
  <svg ${ICON_ATTRS}>
    <path d="M3 7h11v9H3z" />
    <path d="M14 10h4l3 3v3h-7z" />
    <circle cx="7.5" cy="18" r="1.6" />
    <circle cx="17.5" cy="18" r="1.6" />
  </svg>
`;

const cashIcon = `
  <svg ${ICON_ATTRS}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 10h.01" />
    <path d="M18 14h.01" />
  </svg>
`;

const cardIcon = `
  <svg ${ICON_ATTRS}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </svg>
`;

const minusIcon = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
`;

const plusIcon = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
`;

const trashIcon = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
`;

const OPTIONS = {
  paperSize: [
    ['A4', 'A4'],
    ['oficio', 'Oficio'],
  ],
  finish: [
    ['anillado', 'Anillado'],
    ['simple', 'Suelto'],
  ],
  doubleSide: [
    ['true', 'Doble faz'],
    ['false', 'Simple faz'],
  ],
};

const toggle = (name, value) => `
  <div class="mini-toggle">
    ${OPTIONS[name]
      .map(
        ([v, label]) =>
          `<button type="button" class="mini-toggle__btn ${v === value ? 'is-selected' : ''}" data-toggle="${name}" data-value="${v}">${label}</button>`,
      )
      .join('')}
  </div>
`;

const itemRow = (item, pricePerSheet, priceRing, tiers) => {
  const totalPages = (item.pageCount ?? 1) * item.copies;
  const discountPercent = bestDiscountPercent(totalPages, tiers);
  const breakdown = `${item.pageCount ?? 1} página(s) × ${item.copies} copia(s) × ${formatMoney(pricePerSheet)}${
    ringCharge(item, priceRing) ? ` + anillado (${formatMoney(ringCharge(item, priceRing))})` : ''
  }`;

  return `
  <tr data-item="${item.fileId}">
    <td>
      <div class="cart-item__lead">
        <div class="item-thumb" data-thumb data-state="loading">
          <img alt="" loading="lazy" />
        </div>
        <div class="checkout-items-table__stack">
          <span class="cart-item__title" title="${esc(item.title)}">${esc(truncate(item.title, 20))}</span>
          <span class="muted" style="font-size:0.82rem">
            ${discountPercent ? `<span class="badge badge--sales">-${discountPercent}%</span> ` : ''}
            <strong>${formatMoney(itemTotal(item, pricePerSheet, priceRing, tiers))}</strong>
          </span>
          <span class="muted" style="font-size:0.72rem">${esc(breakdown)}</span>
        </div>
      </div>
    </td>
    <td data-label="Copias">
      <div class="qty-stepper">
        <button type="button" class="qty-stepper__btn" data-qty="dec" aria-label="Restar copia">${minusIcon}</button>
        <input class="input qty-stepper__input" type="number" min="1" max="999" value="${item.copies}" data-field="copies" />
        <button type="button" class="qty-stepper__btn" data-qty="inc" aria-label="Sumar copia">${plusIcon}</button>
      </div>
    </td>
    <td data-label="Formato" class="checkout-items-table__stack-cell">
      <div class="checkout-items-table__stack">
        ${toggle('paperSize', item.paperSize)}
        ${toggle('finish', item.finish)}
        ${toggle('doubleSide', String(item.doubleSide))}
      </div>
    </td>
    <td class="checkout-items-table__actions">
      <button class="btn btn--sm btn--ghost" data-action="remove" aria-label="Quitar ${esc(item.title)}" title="Quitar">${trashIcon}</button>
    </td>
  </tr>
`;
};

export function cartPage() {
  return {
    html: `
      <section class="page">
        <header class="page__head">
          <div>
            <h2>Mi pedido</h2>
            <p>Configurá cómo querés imprimir cada archivo.</p>
          </div>
          <a class="btn btn--ghost" href="/catalogo" data-link>Agregar más archivos</a>
        </header>
        <div id="order-content"></div>
      </section>
    `,
    async mount(root) {
      const content = root.querySelector('#order-content');
      let itemsBox = null;
      let summary = null;

      let pricePerSheet = 0;
      let priceRing = 0;
      let shippingPrice = 0;
      let deliveryMethod = 'retiro';
      let deliveryAddress = '';
      let pickupPointId = '';
      let pickupPoints = [];
      let discountTiers = [];
      // Por ahora solo se cobra con Mercado Pago; "Pagar en el local" queda oculto (ver PAY_IN_STORE_ENABLED).
      let paymentMethod = PAY_IN_STORE_ENABLED ? 'efectivo' : 'mercadopago';

      const errors = { pickupPoint: '', address: '' };

      try {
        ({
          settings: { price_per_sheet: pricePerSheet, price_ring: priceRing, shipping_price: shippingPrice },
        } = await SettingsModel.get());
      } catch {
        pricePerSheet = 0;
        priceRing = 0;
        shippingPrice = 0;
      }

      try {
        ({ pickupPoints } = await TaxonomyModel.pickupPoints());
      } catch {
        pickupPoints = [];
      }

      try {
        ({ discountTiers } = await TaxonomyModel.discountTiers());
      } catch {
        discountTiers = [];
      }

      function orderTotal() {
        const itemsTotal = cart.items.reduce((sum, item) => sum + itemTotal(item, pricePerSheet, priceRing, discountTiers), 0);

        return itemsTotal + (deliveryMethod === 'envio' ? shippingPrice : 0);
      }

      function render() {
        if (cart.count === 0) {
          content.innerHTML = `
            <div class="empty-cart">
              <h3>No tenés ningún archivo en tu pedido</h3>
              <p class="muted">Agregá archivos a tu pedido y continuá la compra.</p>
              <a class="btn btn--primary btn--lg" href="/catalogo" data-link>Ir al catálogo</a>
            </div>
          `;
          itemsBox = null;
          summary = null;
          return;
        }

        content.innerHTML = `
          <div class="grid grid--split">
            <div class="stack" id="items"></div>
            <div class="card card--pad stack" id="summary"></div>
          </div>
        `;
        itemsBox = content.querySelector('#items');
        summary = content.querySelector('#summary');

        itemsBox.innerHTML = `
          <div class="table-wrap">
            <table class="table checkout-items-table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Copias</th>
                  <th>Formato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${cart.items.map((item) => itemRow(item, pricePerSheet, priceRing, discountTiers)).join('')}
              </tbody>
            </table>
          </div>
        `;

        for (const item of cart.items) {
          const thumb = itemsBox.querySelector(`[data-item="${item.fileId}"] [data-thumb]`);
          if (thumb) paintThumbnail(thumb, { id: item.fileId, mime_type: item.mimeType });
        }

        const selectedPoint = pickupPoints.find((p) => String(p.id) === String(pickupPointId));
        const payInStoreDisabled = deliveryMethod === 'envio';

        summary.innerHTML = `
          <h3>Resumen</h3>
          <p>${cart.count} archivo(s) · ${cart.items.reduce((a, i) => a + Number(i.copies), 0)} copias en total.</p>
          ${deliveryMethod === 'envio' && shippingPrice > 0 ? `<p class="muted">Envío: ${formatMoney(shippingPrice)}</p>` : ''}
          <p class="checkout-total">Total: <strong>${formatMoney(orderTotal())}</strong></p>
          <div class="checkout-section">
            <h4 class="checkout-section__title">Entrega</h4>
            <div class="delivery-toggle">
              <button type="button" class="delivery-toggle__btn ${deliveryMethod === 'retiro' ? 'is-selected' : ''}" data-delivery="retiro">
                ${storeIcon} Retiro en sucursal
              </button>
              <button type="button" class="delivery-toggle__btn ${deliveryMethod === 'envio' ? 'is-selected' : ''}" data-delivery="envio">
                ${truckIcon} Envío a domicilio
              </button>
            </div>
            <div id="pickup-fields" ${deliveryMethod === 'retiro' ? '' : 'hidden'}>
              <div class="field">
                <span class="field__label">Punto de retiro</span>
                <div class="pickup-grid ${errors.pickupPoint ? 'is-invalid' : ''}" id="pickup-grid">
                  ${pickupPoints
                    .map(
                      (p) => `
                        <button type="button" class="pickup-card ${String(p.id) === String(pickupPointId) ? 'is-selected' : ''}" data-pickup="${p.id}">
                          <span class="pickup-card__name">${esc(p.name)}</span>
                          <span class="pickup-card__address">${esc(p.address)}</span>
                          ${p.notes ? `<span class="pickup-card__notes">${esc(p.notes)}</span>` : ''}
                        </button>
                      `,
                    )
                    .join('')}
                </div>
                <span class="field__error" ${errors.pickupPoint ? '' : 'hidden'}>${esc(errors.pickupPoint)}</span>
              </div>
              ${
                selectedPoint
                  ? `
                    <div class="map-embed">
                      <iframe
                        src="https://maps.google.com/maps?q=${encodeURIComponent(selectedPoint.address)}&output=embed"
                        loading="lazy" title="Mapa de ${esc(selectedPoint.name)}"
                      ></iframe>
                    </div>
                  `
                  : ''
              }
            </div>
            <label class="field" id="delivery-address-field" ${deliveryMethod === 'envio' ? '' : 'hidden'}>
              <span class="field__label">Dirección de envío</span>
              <div class="searchable-select">
                <textarea class="textarea ${errors.address ? 'is-invalid' : ''}" id="delivery-address" maxlength="300"
                          autocomplete="off" placeholder="Calle, número, piso, localidad…">${esc(deliveryAddress)}</textarea>
                <div class="searchable-select__list" id="delivery-address-suggestions" role="listbox" hidden></div>
              </div>
              <span class="field__error" ${errors.address ? '' : 'hidden'}>${esc(errors.address)}</span>
            </label>
          </div>
          <div class="checkout-section">
            <h4 class="checkout-section__title">Forma de Pago</h4>
            <div class="delivery-toggle">
              ${
                PAY_IN_STORE_ENABLED
                  ? `<button type="button" class="delivery-toggle__btn ${paymentMethod === 'efectivo' ? 'is-selected' : ''}"
                             data-payment="efectivo" ${payInStoreDisabled ? 'disabled' : ''}>
                       ${cashIcon} Pagar en el local
                     </button>`
                  : ''
              }
              <button type="button" class="delivery-toggle__btn ${paymentMethod === 'mercadopago' ? 'is-selected' : ''}" data-payment="mercadopago">
                ${cardIcon} Mercado Pago
              </button>
            </div>
            ${PAY_IN_STORE_ENABLED && payInStoreDisabled ? '<span class="field__hint">Con envío a domicilio el pago es con Mercado Pago.</span>' : ''}
          </div>
          ${
            session.isAuth
              ? '<button class="btn btn--primary btn--lg btn--block" id="confirm">Confirmar pedido</button>'
              : `<p class="muted">Para confirmar el pedido ingresá o creá tu cuenta. No vas a perder lo que armaste.</p>
                 <a class="btn btn--primary btn--lg btn--block" href="/login?next=/pedido" data-link>Ingresar y confirmar</a>
                 <a class="btn btn--block" href="/registro?next=/pedido" data-link>Crear cuenta</a>`
          }
          <button class="btn btn--ghost btn--block" id="clear">Vaciar pedido</button>
          ${recaptchaDisclaimer}
        `;
        bind();
      }

      function bind() {
        for (const card of itemsBox.querySelectorAll('[data-item]')) {
          const fileId = Number(card.dataset.item);
          card.querySelector('[data-action="remove"]').addEventListener('click', () => {
            cart.remove(fileId);
            render();
          });
          for (const control of card.querySelectorAll('[data-field]')) {
            control.addEventListener('change', () => {
              const field = control.dataset.field;
              const value =
                control.type === 'checkbox'
                  ? control.checked
                  : control.type === 'number'
                    ? Math.max(1, Math.min(999, Number(control.value) || 1))
                    : control.value;
              if (control.type === 'number') control.value = value;
              cart.update(fileId, { [field]: value });
              render();
            });
          }
          for (const button of card.querySelectorAll('[data-toggle]')) {
            button.addEventListener('click', () => {
              const raw = button.dataset.value;
              const value = raw === 'true' ? true : raw === 'false' ? false : raw;
              cart.update(fileId, { [button.dataset.toggle]: value });
              render();
            });
          }
          for (const button of card.querySelectorAll('[data-qty]')) {
            button.addEventListener('click', () => {
              const current = Number(card.querySelector('[data-field="copies"]').value) || 1;
              const next = Math.max(1, Math.min(999, current + (button.dataset.qty === 'inc' ? 1 : -1)));
              cart.update(fileId, { copies: next });
              render();
            });
          }
        }

        for (const button of summary.querySelectorAll('[data-delivery]')) {
          button.addEventListener('click', () => {
            deliveryMethod = button.dataset.delivery;
            // Envío a domicilio solo se paga con Mercado Pago.
            if (deliveryMethod === 'envio') paymentMethod = 'mercadopago';
            render();
          });
        }

        for (const button of summary.querySelectorAll('[data-payment]')) {
          button.addEventListener('click', () => {
            if (button.disabled) return;
            paymentMethod = button.dataset.payment;
            render();
          });
        }

        for (const card of summary.querySelectorAll('[data-pickup]')) {
          card.addEventListener('click', () => {
            pickupPointId = card.dataset.pickup;
            errors.pickupPoint = '';
            render();
          });
        }

        const addressInput = summary.querySelector('#delivery-address');

        addressInput?.addEventListener('input', (event) => {
          deliveryAddress = event.target.value;
          if (errors.address) {
            errors.address = '';
            event.target.classList.remove('is-invalid');
            summary.querySelector('#delivery-address-field .field__error').hidden = true;
          }
        });

        if (addressInput) {
          attachAddressAutocomplete(addressInput, summary.querySelector('#delivery-address-suggestions'), (address) => {
            deliveryAddress = address;
          });
        }

        summary.querySelector('#clear').addEventListener('click', () => {
          cart.clear();
          render();
        });

        summary.querySelector('#confirm')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;

          errors.pickupPoint = '';
          errors.address = '';

          if (deliveryMethod === 'envio' && deliveryAddress.trim().length < 5) {
            errors.address = 'Ingresá la dirección de envío';
            toastErr(errors.address);
            render();
            summary.querySelector('#delivery-address').focus();
            return;
          }

          if (deliveryMethod === 'retiro' && !pickupPointId) {
            errors.pickupPoint = 'Elegí un punto de retiro';
            toastErr(errors.pickupPoint);
            render();
            summary.querySelector('#pickup-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          button.disabled = true;
          try {
            const recaptchaToken = await getRecaptchaToken('checkout');
            const { order, paymentUrl } = await OrdersModel.create({
              deliveryMethod,
              deliveryAddress: deliveryMethod === 'envio' ? deliveryAddress.trim() : undefined,
              pickupPointId: deliveryMethod === 'retiro' ? pickupPointId : undefined,
              paymentMethod,
              items: cart.items.map(({ title, pageCount, ...item }) => item),
              recaptchaToken,
            });

            if (paymentUrl) {
              // El pedido todavía no existe: recién se crea si el pago se confirma.
              // El carrito queda intacto por si vuelve sin pagar y quiere terminarlo de otra forma.
              toastOk('Te llevamos a Mercado Pago…');
              window.location.href = paymentUrl;
              return;
            }

            cart.clear();
            navigate(`/pedido/resultado?order=${order.id}`);
          } catch (error) {
            toastErr(error.message);
            button.disabled = false;
          }
        });
      }

      render();
    },
  };
}

export function ordersPage() {
  return {
    html: `
      <section class="page">
        <header class="page__head">
          <div>
            <h2>Mis pedidos</h2>
            <p>Seguí el estado de cada impresión.</p>
          </div>
        </header>
        <div id="orders"><div class="skeleton"></div></div>
      </section>
    `,
    async mount(root) {
      const box = root.querySelector('#orders');
      try {
        const { orders } = await OrdersModel.mine();
        box.innerHTML = orders.length
          ? `<div class="grid grid--cards">${orders.map(orderCard).join('')}</div>`
          : emptyState('Todavía no hiciste pedidos', 'Armá uno desde el catálogo.');
      } catch (error) {
        box.innerHTML = emptyState('No se pudieron cargar los pedidos', error.message);
      }
    },
  };
}
