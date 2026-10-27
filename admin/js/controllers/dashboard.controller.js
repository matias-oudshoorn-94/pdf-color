import { AdminApi } from '../models/admin.api.js';
import { esc } from '/js/lib/dom.js';
import { formatBytes, formatDate, STATUS_LABELS } from '/js/lib/format.js';
import { emptyState, statusBadge } from '/js/views/components.view.js';

const metric = (value, label) => `
  <article class="metric">
    <div class="metric__value">${value}</div>
    <div class="metric__label">${label}</div>
  </article>
`;

export function dashboardPage() {
  return {
    title: 'Resumen',
    html: '<div id="content"><div class="skeleton" style="height:120px"></div></div>',
    async mount(root) {
      const content = root.querySelector('#content');

      try {
        const { stats } = await AdminApi.stats();

        content.innerHTML = `
          <div class="metrics">
            ${metric(stats.orders, 'Pedidos totales')}
            ${metric(stats.byStatus.pendiente, 'Pendientes')}
            ${metric(stats.byStatus.en_proceso, 'En proceso')}
            ${metric(stats.byStatus.listo, 'Listos para retirar')}
            ${metric(stats.clients, 'Clientes')}
            ${metric(stats.admins, 'Administradores')}
            ${metric(stats.files, 'Archivos')}
            ${metric(formatBytes(stats.storageBytes), 'Almacenamiento')}
            ${metric(stats.messages, 'Mensajes')}
          </div>

          <h2 style="margin-top:26px">Últimos pedidos</h2>
          ${
            stats.lastOrders.length === 0
              ? emptyState('Todavía no hay pedidos')
              : `<div class="table-wrap">
                   <table class="table">
                     <thead><tr><th>#</th><th>Cliente</th><th>Archivos</th><th>Fecha</th><th>Estado</th></tr></thead>
                     <tbody>
                       ${stats.lastOrders
                         .map(
                           (order) => `
                             <tr>
                               <td>#${order.id}</td>
                               <td>${esc(order.customer_name)}</td>
                               <td>${order.items.length}</td>
                               <td>${formatDate(order.created_at)}</td>
                               <td>${statusBadge(order.status)}</td>
                             </tr>`,
                         )
                         .join('')}
                     </tbody>
                   </table>
                 </div>`
          }
        `;
      } catch (error) {
        content.innerHTML = emptyState('No se pudieron cargar las métricas', error.message);
      }
    },
  };
}

export { STATUS_LABELS };
