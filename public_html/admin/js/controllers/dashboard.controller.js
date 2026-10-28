import { AdminApi } from '../models/admin.api.js';
import { navigate } from '../router.js';
import { esc } from '/js/lib/dom.js';
import { formatBytes, formatDate, STATUS_LABELS } from '/js/lib/format.js';
import { emptyState, statusBadge } from '/js/views/components.view.js';

const metric = (value, label) => `
  <article class="metric">
    <div class="metric__value">${value}</div>
    <div class="metric__label">${label}</div>
  </article>
`;

const plural = (count, singular, pluralForm) => (count === 1 ? singular : pluralForm);

/** Tarjeta grande de lo que requiere atención. Si hay pendientes se resalta y lleva al listado filtrado. */
const attentionCard = ({ count, href, kind, title, action, idle }) =>
  count > 0
    ? `
      <a class="attention attention--${kind}" href="${href}" data-nav>
        <span class="attention__count">${count}</span>
        <span class="attention__body">
          <span class="attention__title">${title}</span>
          <span class="attention__action">${action} →</span>
        </span>
        <span class="attention__pulse" aria-hidden="true"></span>
      </a>`
    : `
      <div class="attention attention--idle">
        <span class="attention__count">0</span>
        <span class="attention__body">
          <span class="attention__title">${idle}</span>
          <span class="attention__action">Todo al día</span>
        </span>
      </div>`;

export function dashboardPage() {
  return {
    title: 'Resumen',
    html: '<div id="content"><div class="skeleton" style="height:120px"></div></div>',
    async mount(root) {
      const content = root.querySelector('#content');

      try {
        const [{ stats }, alerts] = await Promise.all([AdminApi.stats(), AdminApi.alerts()]);
        const { unreadMessages, pendingOrders } = alerts;

        content.innerHTML = `
          <div class="attention-grid">
            ${attentionCard({
              count: unreadMessages,
              href: '/admin/mensajes?estado=no_leido',
              kind: 'messages',
              title: plural(unreadMessages, 'Mensaje sin leer', 'Mensajes sin leer'),
              action: plural(unreadMessages, 'Leerlo y responder', 'Leerlos y responder'),
              idle: 'No hay mensajes sin leer',
            })}
            ${attentionCard({
              count: pendingOrders,
              href: '/admin/pedidos?estado=pendiente',
              kind: 'orders',
              title: plural(pendingOrders, 'Pedido nuevo', 'Pedidos nuevos'),
              action: plural(pendingOrders, 'Ver el pedido', 'Ver los pedidos'),
              idle: 'No hay pedidos nuevos',
            })}
          </div>

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
        for (const link of content.querySelectorAll('[data-nav]')) {
          link.addEventListener('click', (event) => {
            event.preventDefault();
            navigate(link.getAttribute('href'));
          });
        }
      } catch (error) {
        content.innerHTML = emptyState('No se pudieron cargar las métricas', error.message);
      }
    },
  };
}

export { STATUS_LABELS };
