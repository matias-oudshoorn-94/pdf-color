import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { navigate } from '../router.js';
import { confirmAction } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { formatDate, formatMoney, STATUS_LABELS, truncate } from '/js/lib/format.js';
import { statusBadge } from '/js/views/components.view.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

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

const itemLine = (item) => `
  <a href="${AdminApi.downloadUrl(item.file_id)}" style="text-decoration:underline" title="${esc(item.title)}">${esc(truncate(item.title, 40))}</a>
  <span class="muted">· ${item.copies} copia(s) ·
  ${esc(item.paper_size)}${Number(item.double_side) ? ' · doble faz' : ''}${
    item.finish !== 'simple' ? ` · ${esc(item.finish)}` : ''
  }${Number(item.discount_percent) ? ` · -${item.discount_percent}%` : ''}</span>
`;

export function ordersPage() {
  const table = dataTable({
    searchPlaceholder: 'Buscar por cliente, email o #pedido',
    defaultSort: 'created_at',
    emptyTitle: 'Sin pedidos',
    emptyHint: 'No hay pedidos que coincidan con el filtro.',
    filters: [
      {
        id: 'status-filter',
        name: 'status',
        html: `<select class="select" id="status-filter">
                 <option value="">Todos los estados</option>
                 ${Object.entries(STATUS_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
               </select>`,
      },
    ],
    columns: [
      { key: 'id', label: '#' },
      { key: 'customer_name', label: 'Cliente' },
      { key: 'detalle', label: 'Detalle', sortable: false },
      { key: 'entrega', label: 'Entrega', sortable: false },
      { key: 'pago', label: 'Pago', sortable: false },
      { key: 'total', label: 'Total', sortable: false },
      { key: 'created_at', label: 'Fecha' },
      { key: 'status', label: 'Estado' },
      { key: 'acciones', label: '', sortable: false },
    ],
    fetch: (params) => AdminApi.orders(params),
    deleteOne: (id) => AdminApi.deleteOrder(id),
    renderRow: (order) => `
      <td>#${order.id}</td>
      <td>
        ${esc(order.customer_name)}<br />
        <span class="muted">${esc(order.customer_email)}</span>
        ${order.customer_phone ? `<br /><span class="muted">${esc(order.customer_phone)}</span>` : ''}
      </td>
      <td>
        ${order.items.map(itemLine).join('<br />')}
        ${order.notes ? `<br /><span class="muted">Nota: ${esc(order.notes)}</span>` : ''}
      </td>
      <td>
        ${order.delivery_method === 'envio' ? 'Envío a domicilio' : 'Retiro en sucursal'}
        ${order.pickup_point_name ? `<br /><span class="muted">${esc(order.pickup_point_name)}</span>` : ''}
        ${order.delivery_address ? `<br /><span class="muted">${esc(order.delivery_address)}</span>` : ''}
      </td>
      <td>
        ${esc(PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method)}<br />
        ${paymentBadge(order.payment_status)}
        ${
          order.payment_method === 'efectivo'
            ? `<br /><button class="btn btn--sm btn--ghost" data-action="toggle-payment" type="button" style="margin-top:4px">
                 ${order.payment_status === 'aprobado' ? 'Marcar pendiente' : 'Marcar pagado'}
               </button>`
            : ''
        }
      </td>
      <td><strong>${formatMoney(order.total)}</strong></td>
      <td>${formatDate(order.created_at)}</td>
      <td>${statusBadge(order.status)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="detail" type="button">Ver detalle</button>
          <select class="select" data-action="status" style="min-width:150px">
            ${Object.entries(STATUS_LABELS)
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`,
              )
              .join('')}
          </select>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (order, tr, reload) => {
      tr.classList.add('row--clickable');

      // Click en la fila abre el detalle, salvo sobre los controles.
      tr.addEventListener('click', (event) => {
        if (event.target.closest('button, select, a')) return;

        navigate(`/admin/pedidos/${order.id}`);
      });

      tr.querySelector('[data-action="detail"]').addEventListener('click', () =>
        navigate(`/admin/pedidos/${order.id}`),
      );

      tr.querySelector('[data-action="status"]').addEventListener('change', async (event) => {
        try {
          await AdminApi.updateOrderStatus(order.id, event.target.value);
          toastOk(`Pedido #${order.id} actualizado`);
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });

      tr.querySelector('[data-action="toggle-payment"]')?.addEventListener('click', async () => {
        const next = order.payment_status === 'aprobado' ? 'pendiente' : 'aprobado';

        try {
          await AdminApi.updateOrderPaymentStatus(order.id, next);
          toastOk(`Pedido #${order.id} actualizado`);
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const confirmed = await confirmAction(
          `¿Borrar el pedido #${order.id} de ${esc(order.customer_name)}? Esta acción no se puede deshacer.`,
        );

        if (!confirmed) return;

        try {
          await AdminApi.deleteOrder(order.id);
          toastOk('Pedido eliminado');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Pedidos', html: table.html, mount: table.mount };
}
