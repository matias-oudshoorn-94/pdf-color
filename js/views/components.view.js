import { esc } from '../lib/dom.js';
import { formatBytes, formatDate, formatMoney, splitMoney, fileKind, STATUS_LABELS, truncate } from '../lib/format.js';
import { isPreviewable as canPreview } from './viewer.view.js';
import { starsDisplay } from './stars.view.js';

export const skeletonGrid = (n = 6) =>
  `<div class="grid grid--cards">${'<div class="skeleton"></div>'.repeat(n)}</div>`;

export const emptyState = (title, hint = '') => `
  <div class="empty">
    <strong>${esc(title)}</strong>
    ${hint ? `<span>${esc(hint)}</span>` : ''}
  </div>
`;

export const statusBadge = (status) =>
  `<span class="badge badge--${esc(status)}">${esc(STATUS_LABELS[status] ?? status)}</span>`;

export function fileCard(file, { inCart = false, canRate = true } = {}) {
  const institution = file.institution_name ? `<p class="card__institution">${esc(file.institution_name)}</p>` : '';

  const tags = [
    file.career_name ? esc(file.career_name) : null,
    file.year_name ? esc(file.year_name) : null,
    file.subject_name ? esc(file.subject_name) : null,
  ].filter(Boolean);

  const course = tags.length ? `<div class="card__tags">${tags.map((tag) => `<span class="badge">${tag}</span>`).join('')}</div>` : '';

  const price =
    file.estimated_price != null
      ? (() => {
          const { main, decimals } = splitMoney(file.estimated_price);

          return `
            <div class="card__price">
              <span class="card__price-amount">${main}${decimals ? `<sup class="card__price-decimals">,${decimals}</sup>` : ''}</span>
              <span class="card__price-label">/precio base</span>
            </div>
          `;
        })()
      : '';

  return `
    <article class="card card--interactive card--file" data-file-id="${file.id}">
      <div class="card__thumb" data-thumb data-state="loading">
        <img alt="" loading="lazy" />
        <span class="card__thumb-kind">${esc(fileKind(file.mime_type))}</span>
      </div>
      <div class="card__head">
        <h3 class="card__title" title="${esc(file.title)}">${esc(truncate(file.title))}</h3>
      </div>
      ${institution}
      ${course}
      ${file.description ? `<p>${esc(file.description)}</p>` : ''}
      ${price}
      <div class="card__rating-row">
        <span data-rating-display>${starsDisplay(file.avg_rating, file.ratings_count)}</span>
        ${canRate ? '<button class="btn btn--sm btn--ghost" type="button" data-action="rate">Valorar</button>' : ''}
      </div>
      <div class="rating-widget" data-rating-widget hidden></div>
      <div class="card__meta">
        <span>${esc(file.owner_name)}</span>
        <span>${formatBytes(file.size_bytes)}</span>
        <span>${file.page_count} página${Number(file.page_count) === 1 ? '' : 's'}</span>
        <span>${formatDate(file.created_at)}</span>
        ${file.location_name ? `<span>${esc(file.location_name)}</span>` : ''}
        ${Number(file.sales_count) > 0 ? `<span class="badge badge--sales">${file.sales_count} vendido${Number(file.sales_count) === 1 ? '' : 's'}</span>` : ''}
      </div>
      <div class="card__actions">
        <button class="btn btn--sm btn--primary" data-action="add" ${inCart ? 'disabled' : ''}>
          ${inCart ? 'En el pedido' : 'Agregar al pedido'}
        </button>
        ${canPreview(file.mime_type) ? '<button class="btn btn--sm" data-action="preview">Ver</button>' : ''}
      </div>
    </article>
  `;
}

export function orderCard(order) {
  return `
    <a class="card card--interactive" href="/pedidos/${order.id}" data-link>
      <div class="card__head">
        <h3 class="card__title">Pedido #${order.id}</h3>
        ${statusBadge(order.status)}
      </div>
      ${order.notes ? `<p>${esc(order.notes)}</p>` : ''}
      <div class="card__meta">
        <span>${formatDate(order.created_at)}</span>
        ${order.items ? `<span>${order.items.length} archivo(s)</span>` : ''}
        <span>${order.delivery_method === 'envio' ? 'Envío a domicilio' : 'Retiro en sucursal'}</span>
        <span><strong>${formatMoney(order.total)}</strong></span>
        <span>Ver detalle →</span>
      </div>
    </a>
  `;
}
