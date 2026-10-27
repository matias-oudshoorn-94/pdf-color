import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction, openModal } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
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

export function discountTiersPage() {
  const fields = (tier = {}) => `
    <label class="field">
      <span class="field__label">A partir de (páginas)</span>
      <input class="input" type="number" name="minPages" min="1" max="100000" required
             value="${tier.min_pages ?? ''}" />
      <span class="field__hint">Se evalúa por archivo del pedido: páginas del archivo × copias.</span>
    </label>
    <label class="field">
      <span class="field__label">Descuento (%)</span>
      <input class="input" type="number" name="discountPercent" min="0" max="100" step="0.01" required
             value="${tier.discount_percent ?? ''}" />
    </label>
  `;

  const table = dataTable({
    searchPlaceholder: 'Buscar escalón',
    defaultSort: 'min_pages',
    defaultDir: 'asc',
    emptyTitle: 'Sin descuentos por cantidad',
    emptyHint: 'Agregá un escalón, ej: a partir de 100 páginas, 10% de descuento.',
    columns: [
      { key: 'min_pages', label: 'A partir de (páginas)' },
      { key: 'discount_percent', label: 'Descuento (%)' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Nuevo escalón',
      onClick: async (reload) => {
        const created = await openModal({
          title: 'Nuevo escalón de descuento',
          confirmLabel: 'Crear',
          body: fields(),
          onSubmit: (data) => AdminApi.createDiscountTier(data),
        });

        if (created) {
          toastOk('Escalón creado');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.discountTiers(params),
    deleteOne: (id) => AdminApi.deleteDiscountTier(id),
    renderRow: (tier) => `
      <td>${tier.min_pages}</td>
      <td>${tier.discount_percent}%</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (tier, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar escalón de descuento',
          body: fields(tier),
          onSubmit: (data) => AdminApi.updateDiscountTier(tier.id, data),
        });

        if (saved) {
          toastOk('Escalón actualizado');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!(await confirmAction(`¿Borrar el escalón "a partir de ${tier.min_pages} páginas"?`))) return;

        try {
          await AdminApi.deleteDiscountTier(tier.id);
          toastOk('Escalón eliminado');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Descuentos por cantidad', html: table.html, mount: table.mount };
}
