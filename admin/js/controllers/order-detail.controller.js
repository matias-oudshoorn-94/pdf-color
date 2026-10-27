import { AdminApi } from '../models/admin.api.js';
import { navigate } from '../router.js';
import { confirmAction } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { fileKind, formatDate, formatMoney, STATUS_LABELS, truncate } from '/js/lib/format.js';
import { paintThumbnail } from '/js/lib/thumbnail.js';
import { emptyState, statusBadge } from '/js/views/components.view.js';
import { openViewer, isPreviewable } from '/js/views/viewer.view.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

const DELIVERY_LABELS = { retiro: 'Retiro en sucursal', envio: 'Envío a domicilio' };
const PAYMENT_METHOD_LABELS = { efectivo: 'Efectivo', mercadopago: 'Mercado Pago' };
const PAYMENT_STATUS_LABELS = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  approved: 'Aprobado',
  pending: 'Pendiente',
  in_process: 'En proceso',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  charged_back: 'Contracargo',
};
const PAYMENT_STATUS_CLASS = { aprobado: 'badge--sales', approved: 'badge--sales', rechazado: 'badge--cancelado', rejected: 'badge--cancelado', cancelled: 'badge--cancelado' };

const paymentBadge = (status) => {
  const className = PAYMENT_STATUS_CLASS[status] ?? '';
  return `<span class="badge ${className}">${esc(PAYMENT_STATUS_LABELS[status] ?? status)}</span>`;
};
const FINISH_LABELS = {
  simple: 'Suelto',
  anillado: 'Anillado',
  // Terminaciones descontinuadas: se conservan solo para mostrar pedidos antiguos.
  engrapado: 'Engrapado',
  encuadernado: 'Encuadernado',
};

const itemCard = (item) => `
  <article class="card card--file" data-item="${item.id}" data-file="${item.file_id}">
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
      <div><dt>Precio por página</dt><dd>${formatMoney(item.unit_price)}</dd></div>
      ${Number(item.discount_percent) ? `<div><dt>Descuento</dt><dd>-${item.discount_percent}% por cantidad</dd></div>` : ''}
      <div><dt>Subtotal</dt><dd><strong>${formatMoney(item.total_price)}</strong></dd></div>
    </dl>

    ${item.notes ? `<p class="muted">Nota: ${esc(item.notes)}</p>` : ''}

    <div class="card__meta"><span title="${esc(item.original_name)}">${esc(truncate(item.original_name, 40))}</span></div>

    <div class="card__actions">
      ${isPreviewable(item.mime_type) ? '<button class="btn btn--sm" data-action="preview" type="button">Ver archivo</button>' : ''}
      <a class="btn btn--sm btn--ghost" href="${AdminApi.downloadUrl(item.file_id)}">Descargar</a>
    </div>
  </article>
`;

export function orderDetailPage(id) {
  return {
    title: `Pedido #${id}`,
    html: '<div id="detail"><div class="skeleton" style="height:200px"></div></div>',
    async mount(root) {
      const container = root.querySelector('#detail');

      let order;

      try {
        ({ order } = await AdminApi.order(id));
      } catch (error) {
        container.innerHTML = emptyState('No se pudo cargar el pedido', error.message);
        return;
      }

      const totalCopies = order.items.reduce((sum, item) => sum + Number(item.copies), 0);
      const canNotify = order.delivery_method === 'retiro' && !['entregado', 'cancelado'].includes(order.status);

      container.innerHTML = `
        <div class="detail-head">
          <button class="btn btn--sm btn--ghost" id="back" type="button">← Volver a pedidos</button>
          <div class="row">
            <select class="select" id="status" style="min-width:180px">
              ${Object.entries(STATUS_LABELS)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
            <button class="btn btn--sm btn--danger" id="delete" type="button">Borrar pedido</button>
          </div>
        </div>

        <div class="grid grid--split" style="margin-top:18px">
          <article class="card card--pad stack">
            <div class="card__head">
              <h2>Pedido #${order.id}</h2>
              ${statusBadge(order.status)}
            </div>
            <dl class="spec spec--wide">
              <div><dt>Ingresado</dt><dd>${formatDate(order.created_at)}</dd></div>
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
              <div><dt>Pago</dt><dd>${esc(PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method)} · ${paymentBadge(order.payment_status)}</dd></div>
              ${order.mp_status_detail ? `<div><dt>Detalle del pago</dt><dd class="muted">${esc(order.mp_status_detail)}</dd></div>` : ''}
            </dl>
            ${
              order.payment_method === 'efectivo'
                ? `<button class="btn btn--sm btn--ghost" id="toggle-payment" type="button" style="width:fit-content">
                     ${order.payment_status === 'aprobado' ? 'Marcar como pendiente' : 'Marcar como pagado'}
                   </button>`
                : ''
            }
            ${order.notes ? `<p><strong>Nota del cliente:</strong> ${esc(order.notes)}</p>` : ''}
            ${
              canNotify
                ? `<div class="row" style="align-items:center">
                     <button class="btn btn--sm btn--primary" id="notify-ready" type="button">
                       ${order.ready_notified_at ? 'Volver a notificar al cliente' : 'Notificar al cliente'}
                     </button>
                     <span class="muted">
                       ${
                         order.ready_notified_at
                           ? `Aviso de "listo para retirar" enviado el ${formatDate(order.ready_notified_at)}`
                           : 'Le manda un mail avisando que ya puede retirar el pedido'
                       }
                     </span>
                   </div>`
                : ''
            }
          </article>

          <article class="card card--pad stack">
            <h3 class="card__title">Cliente</h3>
            <dl class="spec spec--wide">
              <div><dt>Nombre</dt><dd>${esc(order.customer_name)}</dd></div>
              <div><dt>Email</dt><dd><a href="mailto:${esc(order.customer_email)}" style="text-decoration:underline">${esc(order.customer_email)}</a></dd></div>
              <div><dt>Teléfono</dt><dd>${order.customer_phone ? esc(order.customer_phone) : '—'}</dd></div>
            </dl>
          </article>
        </div>

        <h2 style="margin-top:26px">Archivos a imprimir</h2>
        <div class="grid grid--cards" id="items">
          ${order.items.map(itemCard).join('')}
        </div>
      `;

      root.querySelector('#back').addEventListener('click', () => navigate('/admin/pedidos'));

      root.querySelector('#status').addEventListener('change', async (event) => {
        try {
          await AdminApi.updateOrderStatus(order.id, event.target.value);
          toastOk('Estado actualizado');
          navigate(`/admin/pedidos/${order.id}`);
        } catch (error) {
          toastErr(error.message);
        }
      });

      root.querySelector('#toggle-payment')?.addEventListener('click', async () => {
        const next = order.payment_status === 'aprobado' ? 'pendiente' : 'aprobado';

        try {
          await AdminApi.updateOrderPaymentStatus(order.id, next);
          toastOk('Estado de pago actualizado');
          navigate(`/admin/pedidos/${order.id}`);
        } catch (error) {
          toastErr(error.message);
        }
      });

      root.querySelector('#notify-ready')?.addEventListener('click', async (event) => {
        const question =
          `¿Avisarle a ${esc(order.customer_name)} (${esc(order.customer_email)}) que el pedido #${order.id} está listo para retirar?` +
          (order.status === 'listo' ? '' : ' El pedido pasa a "Listo para retirar".');

        if (!(await confirmAction(question, 'Notificar'))) return;

        const button = event.currentTarget;
        button.disabled = true;

        try {
          await AdminApi.notifyOrderReady(order.id);
          toastOk('Cliente notificado');
          navigate(`/admin/pedidos/${order.id}`);
        } catch (error) {
          toastErr(error.message);
          button.disabled = false;
        }
      });

      root.querySelector('#delete').addEventListener('click', async () => {
        if (!(await confirmAction(`¿Borrar el pedido #${order.id}? Esta acción no se puede deshacer.`))) return;

        try {
          await AdminApi.deleteOrder(order.id);
          toastOk('Pedido eliminado');
          navigate('/admin/pedidos');
        } catch (error) {
          toastErr(error.message);
        }
      });

      for (const card of root.querySelectorAll('[data-item]')) {
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
