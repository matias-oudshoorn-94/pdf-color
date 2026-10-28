import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction, openModal } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { formatMoney } from '/js/lib/format.js';
import { emptyState } from '/js/views/components.view.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

export function pickupPointsPage() {
  const fields = (point = {}) => `
    <label class="field">
      <span class="field__label">Nombre</span>
      <input class="input" name="name" required minlength="2" maxlength="120"
             placeholder="Ej: Local Güemes" value="${esc(point.name ?? '')}" />
    </label>
    <label class="field">
      <span class="field__label">Dirección</span>
      <input class="input" name="address" required minlength="5" maxlength="300"
             placeholder="Calle, número, localidad" value="${esc(point.address ?? '')}" />
      <span class="field__hint">Se usa para mostrar el mapa en el checkout: poné la dirección completa.</span>
    </label>
    <label class="field">
      <span class="field__label">Notas (opcional)</span>
      <input class="input" name="notes" maxlength="300" placeholder="Ej: horarios de atención"
             value="${esc(point.notes ?? '')}" />
    </label>
    <label class="checkbox">
      <input type="checkbox" name="isActive" ${point.id === undefined || Number(point.is_active) ? 'checked' : ''} />
      Activo (visible para elegir en el checkout)
    </label>
  `;

  const table = dataTable({
    searchPlaceholder: 'Buscar punto de retiro',
    defaultSort: 'name',
    defaultDir: 'asc',
    emptyTitle: 'Sin puntos de retiro',
    emptyHint: 'Agregá el primero para que los clientes puedan elegir "retiro en sucursal".',
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'address', label: 'Dirección' },
      { key: 'is_active', label: 'Activo' },
      { key: 'orders_count', label: 'Pedidos' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Nuevo punto de retiro',
      onClick: async (reload) => {
        const created = await openModal({
          title: 'Nuevo punto de retiro',
          confirmLabel: 'Crear',
          body: fields(),
          onSubmit: (data, form) =>
            AdminApi.createPickupPoint({
              name: data.name,
              address: data.address,
              notes: data.notes,
              isActive: form.isActive.checked,
            }),
        });

        if (created) {
          toastOk('Punto de retiro creado');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.pickupPoints(params),
    deleteOne: (id) => AdminApi.deletePickupPoint(id),
    renderRow: (point) => `
      <td>${esc(point.name)}</td>
      <td>${esc(point.address)}</td>
      <td>${Number(point.is_active) ? '<span class="badge badge--sales">Activo</span>' : '<span class="muted">Inactivo</span>'}</td>
      <td>${point.orders_count}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (point, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar punto de retiro',
          body: fields(point),
          onSubmit: (data, form) =>
            AdminApi.updatePickupPoint(point.id, {
              name: data.name,
              address: data.address,
              notes: data.notes,
              isActive: form.isActive.checked,
            }),
        });

        if (saved) {
          toastOk('Punto de retiro actualizado');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const warning = Number(point.orders_count)
          ? ` Los ${point.orders_count} pedido(s) asociados quedan sin punto de retiro.`
          : '';

        if (!(await confirmAction(`¿Borrar “${esc(point.name)}”?${warning}`))) return;

        try {
          await AdminApi.deletePickupPoint(point.id);
          toastOk('Punto de retiro eliminado');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Puntos de retiro', html: table.html, mount: table.mount };
}

const SIDE_LABELS = { doble: 'Doble faz', simple: 'Simple faz' };

/**
 * Precios por cantidad: una tabla por faz con rangos "desde X páginas, $Y por página".
 * El "hasta" de cada rango es el "desde" del siguiente menos uno.
 */
export function priceTiersPage() {
  const fields = (side, tier = {}) => `
    <label class="field">
      <span class="field__label">Desde (páginas)</span>
      <input class="input" type="number" name="minPages" min="1" max="1000000" required
             value="${tier.min_pages ?? ''}" />
      <span class="field__hint">El rango llega hasta donde empieza el siguiente. Se cuenta por archivo: páginas × copias.</span>
    </label>
    <label class="field">
      <span class="field__label">Precio por página ($)</span>
      <input class="input" type="number" name="pricePerPage" min="0" step="0.01" required
             value="${tier.price_per_page ?? ''}" />
    </label>
    <input type="hidden" name="side" value="${side}" />
  `;

  const rangeLabel = (tiers, index) => {
    const from = tiers[index].min_pages;
    const next = tiers[index + 1];

    if (!next) return `${from} o más`;
    if (next.min_pages - 1 === from) return `${from}`;

    return `${from} a ${next.min_pages - 1}`;
  };

  const sideCard = (side, tiers) => `
    <article class="card card--pad stack" data-side="${side}">
      <div class="toolbar" style="margin:0">
        <h3 class="card__title">${SIDE_LABELS[side]}</h3>
        <span class="toolbar__spacer"></span>
        <button class="btn btn--sm btn--primary" data-action="new" type="button">Agregar rango</button>
      </div>
      ${
        tiers.length === 0
          ? emptyState('Sin precios cargados', `No se pueden hacer pedidos en ${SIDE_LABELS[side].toLowerCase()} hasta cargar al menos un rango.`)
          : `<div class="table-wrap">
               <table class="table">
                 <thead><tr><th>Páginas</th><th>Precio por página</th><th></th></tr></thead>
                 <tbody>
                   ${tiers
                     .map(
                       (tier, index) => `
                         <tr data-id="${tier.id}">
                           <td>${rangeLabel(tiers, index)}</td>
                           <td><strong>${formatMoney(tier.price_per_page)}</strong></td>
                           <td>
                             <div class="cell-actions">
                               <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
                               <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
                             </div>
                           </td>
                         </tr>`,
                     )
                     .join('')}
                 </tbody>
               </table>
             </div>`
      }
    </article>
  `;

  return {
    title: 'Precios por cantidad',
    html: '<div id="content"><div class="skeleton" style="height:200px"></div></div>',
    async mount(root) {
      const content = root.querySelector('#content');

      async function load() {
        let priceTiers;

        try {
          ({ priceTiers } = await AdminApi.priceTiers());
        } catch (error) {
          content.innerHTML = emptyState('No se pudieron cargar los precios', error.message);
          return;
        }

        content.innerHTML = `
          <p class="muted" style="max-width:760px;margin-bottom:16px">
            Cada archivo del pedido se cobra según su faz y su cantidad de páginas (páginas del archivo × copias):
            todas sus páginas van al precio del rango en que cae. Color o blanco y negro cuestan lo mismo.
            El anillado y el envío se suman aparte (ver "Precios").
          </p>
          <div class="grid grid--split">
            ${sideCard('doble', priceTiers.doble)}
            ${sideCard('simple', priceTiers.simple)}
          </div>
        `;

        for (const card of content.querySelectorAll('[data-side]')) {
          const side = card.dataset.side;
          const tiers = priceTiers[side];

          card.querySelector('[data-action="new"]').addEventListener('click', async () => {
            const created = await openModal({
              title: `Nuevo rango · ${SIDE_LABELS[side]}`,
              confirmLabel: 'Crear',
              body: fields(side),
              onSubmit: (data) => AdminApi.createPriceTier(data),
            });

            if (created) {
              toastOk('Rango creado');
              load();
            }
          });

          for (const tr of card.querySelectorAll('[data-id]')) {
            const tier = tiers.find((item) => String(item.id) === tr.dataset.id);

            tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
              const saved = await openModal({
                title: `Editar rango · ${SIDE_LABELS[side]}`,
                body: fields(side, tier),
                onSubmit: (data) => AdminApi.updatePriceTier(tier.id, data),
              });

              if (saved) {
                toastOk('Rango actualizado');
                load();
              }
            });

            tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
              const label = `desde ${tier.min_pages} página${tier.min_pages === 1 ? '' : 's'}`;
              if (!(await confirmAction(`¿Borrar el rango "${label}" de ${SIDE_LABELS[side].toLowerCase()}?`))) return;

              try {
                await AdminApi.deletePriceTier(tier.id);
                toastOk('Rango eliminado');
                load();
              } catch (error) {
                toastErr(error.message);
              }
            });
          }
        }
      }

      await load();
    },
  };
}
