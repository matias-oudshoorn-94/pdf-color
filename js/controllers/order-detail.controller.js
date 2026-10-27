import { OrdersModel } from '../models/resources.js';
import { esc } from '../lib/dom.js';
import { fileKind, formatDate, formatMoney, STATUS_LABELS, truncate } from '../lib/format.js';
import { paintThumbnail } from '../lib/thumbnail.js';
import { emptyState, statusBadge } from '../views/components.view.js';
import { openViewer, isPreviewable } from '../views/viewer.view.js';

const FINISH_LABELS = {
  simple: 'Suelto',
  anillado: 'Anillado',
  // Terminaciones descontinuadas: se conservan solo para mostrar pedidos antiguos.
  engrapado: 'Engrapado',
  encuadernado: 'Encuadernado',
};

const DELIVERY_LABELS = { retiro: 'Retiro en sucursal', envio: 'Envío a domicilio' };

const STATUS_HINTS = {
  pendiente: 'Recibimos tu pedido y está en la cola de impresión.',
  en_proceso: 'Lo estamos imprimiendo.',
  listo: '¡Ya podés pasar a retirarlo!',
  entregado: 'Pedido entregado. ¡Gracias!',
  cancelado: 'Este pedido fue cancelado.',
};

const itemCard = (item) => `
  <article class="card card--file" data-item="${item.id}">
    <div class="card__thumb" data-thumb data-state="loading">
      <img alt="" loading="lazy" />
      <span class="card__thumb-kind">${esc(fileKind(item.mime_type))}</span>
    </div>
    <div class="card__head">
      <h3 class="card__title" title="${esc(item.title)}">${esc(truncate(item.title))}</h3>
    </div>

    <dl class="spec">
      <div><dt>Copias</dt><dd>${item.copies}</dd></div>
      <div><dt>Hoja</dt><dd>${esc(item.paper_size)}</dd></div>
      <div><dt>Faz</dt><dd>${Number(item.double_side) ? 'Doble faz' : 'Simple faz'}</dd></div>
      <div><dt>Terminación</dt><dd>${esc(FINISH_LABELS[item.finish] ?? item.finish)}</dd></div>
      <div><dt>Páginas del archivo</dt><dd>${item.pages}</dd></div>
      ${Number(item.discount_percent) ? `<div><dt>Descuento</dt><dd>-${item.discount_percent}% por cantidad</dd></div>` : ''}
      <div><dt>Subtotal</dt><dd><strong>${formatMoney(item.total_price)}</strong></dd></div>
    </dl>

    ${item.notes ? `<p class="muted">Nota: ${esc(item.notes)}</p>` : ''}

    <div class="card__actions">
      ${isPreviewable(item.mime_type) ? '<button class="btn btn--sm" data-action="preview">Ver archivo</button>' : ''}
    </div>
  </article>
`;

export function orderDetailPage(id) {
  return {
    html: `
      <section class="page">
        <a class="btn btn--sm btn--ghost" href="/pedidos" data-link style="width:fit-content">← Volver a mis pedidos</a>
        <div id="detail"><div class="skeleton" style="height:180px"></div></div>
      </section>
    `,
    async mount(root) {
      const container = root.querySelector('#detail');

      let order;

      try {
        ({ order } = await OrdersModel.detail(id));
      } catch (error) {
        container.innerHTML = emptyState('No se pudo cargar el pedido', error.message);
        return;
      }

      const totalCopies = order.items.reduce((sum, item) => sum + Number(item.copies), 0);

      container.innerHTML = `
        <div class="card card--pad stack">
          <div class="card__head">
            <h2>Pedido #${order.id}</h2>
            ${statusBadge(order.status)}
          </div>
          <p>${esc(STATUS_HINTS[order.status] ?? '')}</p>

          <dl class="spec spec--wide">
            <div><dt>Fecha</dt><dd>${formatDate(order.created_at)}</dd></div>
            <div><dt>Última actualización</dt><dd>${formatDate(order.updated_at)}</dd></div>
            <div><dt>Archivos</dt><dd>${order.items.length}</dd></div>
            <div><dt>Copias totales</dt><dd>${totalCopies}</dd></div>
            <div><dt>Total del pedido</dt><dd><strong>${formatMoney(order.total)}</strong></dd></div>
            <div><dt>Entrega</dt><dd>${esc(DELIVERY_LABELS[order.delivery_method] ?? order.delivery_method)}</dd></div>
            ${
              order.delivery_method === 'retiro' && order.pickup_point_name
                ? `<div><dt>Punto de retiro</dt><dd>${esc(order.pickup_point_name)}<br /><span class="muted">${esc(order.pickup_point_address)}</span></dd></div>`
                : ''
            }
            ${order.delivery_address ? `<div><dt>Dirección</dt><dd>${esc(order.delivery_address)}</dd></div>` : ''}
            ${
              order.delivery_method === 'envio' && Number(order.shipping_price) > 0
                ? `<div><dt>Costo de envío</dt><dd>${formatMoney(order.shipping_price)}</dd></div>`
                : ''
            }
          </dl>

          ${order.notes ? `<p><strong>Tu nota:</strong> ${esc(order.notes)}</p>` : ''}
        </div>

        <h2 style="margin-top:8px">Archivos del pedido</h2>
        <div class="grid grid--cards">${order.items.map(itemCard).join('')}</div>
      `;

      for (const card of container.querySelectorAll('[data-item]')) {
        const item = order.items.find((i) => String(i.id) === card.dataset.item);

        const thumb = card.querySelector('[data-thumb]');
        if (thumb) paintThumbnail(thumb, { id: item.file_id, mime_type: item.mime_type });

        card.querySelector('[data-action="preview"]')?.addEventListener('click', () =>
          openViewer({
            id: item.file_id,
            title: item.title,
            original_name: item.original_name,
            mime_type: item.mime_type,
          }),
        );
      }
    },
  };
}

export { STATUS_LABELS };
