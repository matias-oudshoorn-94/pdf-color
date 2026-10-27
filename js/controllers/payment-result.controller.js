import { cart } from '../models/cart.js';
import { session } from '../models/session.js';
import { OrdersModel } from '../models/resources.js';
import { esc } from '../lib/dom.js';
import { formatMoney } from '../lib/format.js';
import { emptyState } from '../views/components.view.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** El pedido recién nace cuando el pago se confirma (webhook, o el chequeo de
 * respaldo que hace el propio GET /orders/pending/:id). Puede tardar unos
 * segundos más que la redirección de vuelta, así que se reintenta un poco. */
async function fetchPromotedOrder(pendingId, preferenceId) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { status, order, user } = await OrdersModel.pending(pendingId, preferenceId);

    // Vuelta de Mercado Pago en un navegador sin sesión: el backend ya la inició.
    if (user) session.set(user);

    if (status === 'promoted') return order;
    if (attempt === 3) return null;

    await sleep(1500);
  }

  return null;
}

const MESSAGES = {
  confirmed: { title: '¡Tu pedido fue confirmado!', hint: 'Pagás al retirar o recibir tu pedido.', success: true },
  approved: { title: '¡Pago aprobado!', hint: 'Ya estamos preparando tu pedido.', success: true },
  confirming: {
    title: 'Estamos confirmando tu pago',
    hint: 'Mercado Pago dice que se aprobó: en unos minutos lo vas a ver reflejado en "Mis pedidos". No hace falta que hagas nada más.',
  },
  rejected: {
    title: 'El pago fue rechazado',
    hint: 'Tu pedido sigue armado tal cual lo dejaste: podés reintentar el pago cuando quieras.',
  },
  pending: {
    title: 'Tu pago quedó pendiente de confirmación',
    hint: 'Todavía no se acreditó. Tu pedido sigue armado tal cual lo dejaste por si querés reintentar el pago.',
  },
  unknown: {
    title: 'No pudimos confirmar el pago',
    hint: 'Tu pedido sigue armado tal cual lo dejaste: podés reintentar el pago cuando quieras.',
  },
};

function resolveNotPromotedMessage(urlStatus) {
  if (urlStatus === 'approved') return MESSAGES.confirming;
  if (urlStatus === 'rejected' || urlStatus === 'cancelled') return MESSAGES.rejected;
  if (urlStatus === 'pending' || urlStatus === 'in_process') return MESSAGES.pending;

  return MESSAGES.unknown;
}

export function paymentResultPage() {
  return {
    html: `
      <section class="page">
        <div id="result" class="card card--pad stack" style="max-width:520px;margin-inline:auto">
          <div class="skeleton" style="height:120px"></div>
        </div>
      </section>
    `,
    async mount(root) {
      const box = root.querySelector('#result');
      const params = new URLSearchParams(location.search);
      const ref = params.get('external_reference') ?? '';
      const pendingMatch = ref.match(/^pending-(\d+)$/);
      const plainOrderId = pendingMatch ? null : Number(params.get('order') ?? ref);
      const urlStatus = params.get('collection_status') ?? params.get('status') ?? '';

      if (!pendingMatch && !plainOrderId) {
        box.innerHTML = emptyState('No pudimos identificar el pedido', 'Revisá "Mis pedidos" para ver su estado.');
        return;
      }

      try {
        let order = null;
        let message;

        if (pendingMatch) {
          order = await fetchPromotedOrder(pendingMatch[1], params.get('preference_id') ?? '');

          if (order) {
            cart.clear();
            message = MESSAGES.approved;
          } else {
            // No se confirmó (rechazado, pendiente, o abandonado): el carrito
            // nunca se tocó, sigue tal cual para que pueda terminar la compra.
            message = resolveNotPromotedMessage(urlStatus);
          }
        } else {
          ({ order } = await OrdersModel.detail(plainOrderId));
          message = MESSAGES.confirmed;
        }

        const buttons = order
          ? message.success
            ? `
              <a class="btn btn--primary btn--lg btn--block" href="/pedidos/${order.id}" data-link>Ver estado de pedido</a>
              <a class="btn btn--ghost btn--block" href="/catalogo" data-link>Hacer otra compra</a>
            `
            : `
              <a class="btn btn--primary btn--block" href="/pedidos/${order.id}" data-link>Ver pedido</a>
              <a class="btn btn--ghost btn--block" href="/pedidos" data-link>Mis pedidos</a>
            `
          : message === MESSAGES.confirming
            ? '<a class="btn btn--primary btn--block" href="/pedidos" data-link>Mis pedidos</a>'
            : `
              <a class="btn btn--primary btn--lg btn--block" href="/pedido" data-link>Volver a mi pedido</a>
              <a class="btn btn--ghost btn--block" href="/catalogo" data-link>Catálogo</a>
            `;

        box.innerHTML = `
          <h2>${esc(message.title)}</h2>
          <p class="muted">${esc(message.hint)}</p>
          ${
            order
              ? `<dl class="spec spec--wide">
                   <div><dt>Pedido</dt><dd>#${order.id}</dd></div>
                   <div><dt>Total</dt><dd><strong>${formatMoney(order.total)}</strong></dd></div>
                 </dl>`
              : ''
          }
          ${buttons}
        `;
      } catch (error) {
        box.innerHTML = emptyState('No se pudo cargar el resultado', error.message);
      }
    },
  };
}
