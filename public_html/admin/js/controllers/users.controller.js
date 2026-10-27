import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction, openModal } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { formatDate } from '/js/lib/format.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

const COPY = {
  client: {
    title: 'Clientes',
    newLabel: 'Nuevo cliente',
    empty: 'Todavía no hay clientes registrados',
    emptyHint: 'Las cuentas creadas desde el sitio aparecen acá.',
    searchPlaceholder: 'Buscar cliente por nombre o email',
  },
  admin: {
    title: 'Administradores',
    newLabel: 'Nuevo administrador',
    empty: 'No hay administradores',
    emptyHint: '',
    searchPlaceholder: 'Buscar administrador por nombre o email',
  },
};

const formFields = (user, role) => `
  <label class="field">
    <span class="field__label">Nombre</span>
    <input class="input" name="name" required minlength="2" maxlength="120" value="${esc(user.name ?? '')}" />
  </label>
  <label class="field">
    <span class="field__label">Email</span>
    <input class="input" name="email" type="email" required value="${esc(user.email ?? '')}" />
  </label>
  <label class="field">
    <span class="field__label">Teléfono</span>
    <input class="input" name="phone" maxlength="40" value="${esc(user.phone ?? '')}" />
  </label>
  <label class="field">
    <span class="field__label">Tipo de cuenta</span>
    <select class="select" name="role">
      <option value="client" ${(user.role ?? role) === 'client' ? 'selected' : ''}>Cliente</option>
      <option value="admin" ${(user.role ?? role) === 'admin' ? 'selected' : ''}>Administrador</option>
    </select>
    <span class="field__hint">Cambiarlo mueve la cuenta a la otra sección.</span>
  </label>
  <label class="field">
    <span class="field__label">Contraseña</span>
    <input class="input" name="password" type="password" minlength="8"
           ${user.id ? '' : 'required'} autocomplete="new-password" />
    <span class="field__hint">${user.id ? 'Dejala vacía para no cambiarla.' : 'Mínimo 8 caracteres.'}</span>
  </label>
`;

/** ABM de usuarios acotado a un rol: /admin/clientes y /admin/administradores. */
export function usersPage(role) {
  const copy = COPY[role];
  const isClient = role === 'client';

  const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Contacto' },
    ...(isClient
      ? [
          { key: 'files_count', label: 'Archivos' },
          { key: 'orders_count', label: 'Pedidos' },
        ]
      : []),
    { key: 'created_at', label: 'Alta' },
    { key: 'acciones', label: '', sortable: false },
  ];

  const table = dataTable({
    searchPlaceholder: copy.searchPlaceholder,
    defaultSort: 'created_at',
    emptyTitle: copy.empty,
    emptyHint: copy.emptyHint,
    columns,
    action: {
      label: copy.newLabel,
      onClick: async (reload) => {
        const created = await openModal({
          title: copy.newLabel,
          confirmLabel: 'Crear cuenta',
          body: formFields({}, role),
          onSubmit: (data) => AdminApi.createClient(data),
        });

        if (created) {
          toastOk('Cuenta creada');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.clients({ ...params, role }),
    deleteOne: (id) => AdminApi.deleteClient(id),
    renderRow: (user) => `
      <td>${esc(user.name)}</td>
      <td>
        ${esc(user.email)}
        ${user.phone ? `<br /><span class="muted">${esc(user.phone)}</span>` : ''}
      </td>
      ${isClient ? `<td>${user.files_count}</td><td>${user.orders_count}</td>` : ''}
      <td>${formatDate(user.created_at)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (user, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: `Editar a ${esc(user.name)}`,
          confirmLabel: 'Guardar cambios',
          body: formFields(user, role),
          onSubmit: (data) => {
            const payload = { ...data };
            if (!payload.password) delete payload.password;

            return AdminApi.updateClient(user.id, payload);
          },
        });

        if (saved) {
          toastOk('Cuenta actualizada');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const message = isClient
          ? `¿Borrar a ${esc(user.name)}? Se eliminan también sus archivos y pedidos.`
          : `¿Quitar el acceso de administrador de ${esc(user.name)}? La cuenta se elimina por completo.`;

        if (!(await confirmAction(message))) return;

        try {
          await AdminApi.deleteClient(user.id);
          toastOk('Cuenta eliminada');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: copy.title, html: table.html, mount: table.mount };
}

export const clientsPage = () => usersPage('client');
export const adminsPage = () => usersPage('admin');
