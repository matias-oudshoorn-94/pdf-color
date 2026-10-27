import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction, openModal } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { formatDate } from '/js/lib/format.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

const option = (value, label, selected) =>
  `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`;

// Las instituciones, carreras y materias que cargan los usuarios al subir un archivo
// se marcan para revisarlas (nombre prolijo, que no dupliquen otra).
const userTag = (item) =>
  Number(item.created_by_user) ? ' <span class="user-tag" title="Cargada por un usuario al subir un archivo">Usuario</span>' : '';

const LEVEL_LABELS = { primaria: 'Primaria', secundaria: 'Secundaria', universitario: 'Universitario' };

export function locationsPage() {
  const fields = (location = {}) => `
    <label class="field">
      <span class="field__label">Nombre</span>
      <input class="input" name="name" required minlength="2" maxlength="120"
             placeholder="Ej: Mar del Plata" value="${esc(location.name ?? '')}" />
    </label>
  `;

  const table = dataTable({
    searchPlaceholder: 'Buscar localidad',
    defaultSort: 'name',
    defaultDir: 'asc',
    emptyTitle: 'Sin localidades',
    emptyHint: 'Cargá la primera para poder agregar instituciones.',
    columns: [
      { key: 'name', label: 'Localidad' },
      { key: 'institutions_count', label: 'Instituciones' },
      { key: 'created_at', label: 'Alta' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Nueva localidad',
      onClick: async (reload) => {
        const created = await openModal({
          title: 'Nueva localidad',
          confirmLabel: 'Crear',
          body: fields(),
          onSubmit: (data) => AdminApi.createLocation(data),
        });

        if (created) {
          toastOk('Localidad creada');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.locations(params),
    deleteOne: (id) => AdminApi.deleteLocation(id),
    renderRow: (location) => `
      <td>${esc(location.name)}</td>
      <td>${location.institutions_count}</td>
      <td>${formatDate(location.created_at)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (location, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar localidad',
          body: fields(location),
          onSubmit: (data) => AdminApi.updateLocation(location.id, data),
        });

        if (saved) {
          toastOk('Localidad actualizada');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!(await confirmAction(`¿Borrar la localidad “${esc(location.name)}”?`))) return;

        try {
          await AdminApi.deleteLocation(location.id);
          toastOk('Localidad eliminada');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Localidades', html: table.html, mount: table.mount };
}

export function institutionsPage() {
  let locations = [];

  const fields = (institution = {}) => `
    <label class="field">
      <span class="field__label">Localidad</span>
      <select class="select" name="locationId" required>
        <option value="">Elegí una localidad</option>
        ${locations.map((l) => option(l.id, l.name, institution.location_id)).join('')}
      </select>
    </label>
    <label class="field">
      <span class="field__label">Nombre de la institución</span>
      <input class="input" name="name" required minlength="2" maxlength="160"
             placeholder="Ej: Escuela N° 2" value="${esc(institution.name ?? '')}" />
    </label>
  `;

  const table = dataTable({
    searchPlaceholder: 'Buscar institución o localidad',
    defaultSort: 'name',
    defaultDir: 'asc',
    emptyTitle: 'Sin instituciones',
    emptyHint: 'Agregá la primera institución.',
    filters: [
      {
        id: 'location-filter',
        name: 'locationId',
        html: '<select class="select" id="location-filter"><option value="">Todas las localidades</option></select>',
      },
    ],
    columns: [
      { key: 'name', label: 'Institución' },
      { key: 'location_name', label: 'Localidad' },
      { key: 'files_count', label: 'Archivos' },
      { key: 'created_at', label: 'Alta' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Nueva institución',
      onClick: async (reload) => {
        if (locations.length === 0) {
          toastErr('Primero cargá al menos una localidad');
          return;
        }

        const created = await openModal({
          title: 'Nueva institución',
          confirmLabel: 'Crear',
          body: fields(),
          onSubmit: (data) => AdminApi.createInstitution(data),
        });

        if (created) {
          toastOk('Institución creada');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.institutions(params),
    deleteOne: (id) => AdminApi.deleteInstitution(id),
    renderRow: (institution) => `
      <td>${esc(institution.name)}${userTag(institution)}</td>
      <td>${esc(institution.location_name)}</td>
      <td>${institution.files_count}</td>
      <td>${formatDate(institution.created_at)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (institution, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar institución',
          body: fields(institution),
          onSubmit: (data) => AdminApi.updateInstitution(institution.id, data),
        });

        if (saved) {
          toastOk('Institución actualizada');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const warning = Number(institution.files_count)
          ? ` Los ${institution.files_count} archivo(s) asociados quedan sin institución.`
          : '';

        if (!(await confirmAction(`¿Borrar “${esc(institution.name)}”?${warning}`))) return;

        try {
          await AdminApi.deleteInstitution(institution.id);
          toastOk('Institución eliminada');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return {
    title: 'Instituciones',
    html: table.html,
    async mount(root) {
      locations = (await AdminApi.locations({ perPage: 100, page: 1 })).items ?? [];

      root
        .querySelector('#location-filter')
        .insertAdjacentHTML('beforeend', locations.map((l) => option(l.id, l.name)).join(''));

      return table.mount(root);
    },
  };
}

export function yearsPage() {
  const fields = (year = {}) => `
    <label class="field">
      <span class="field__label">Nivel educativo</span>
      <select class="select" name="level" required>
        <option value="">Elegí un nivel</option>
        ${Object.entries(LEVEL_LABELS).map(([value, label]) => option(value, label, year.level)).join('')}
      </select>
    </label>
    <label class="field">
      <span class="field__label">Año</span>
      <input class="input" name="name" required maxlength="40" placeholder="Ej: 7mo" value="${esc(year.name ?? '')}" />
      <span class="field__hint">Es una lista libre, igual que materias y carreras: no depende de ninguna institución.</span>
    </label>
  `;

  const table = dataTable({
    searchPlaceholder: 'Buscar año',
    defaultSort: 'name',
    defaultDir: 'asc',
    emptyTitle: 'Sin años',
    emptyHint: 'Agregá el primer año para cada nivel.',
    filters: [
      {
        id: 'level-filter',
        name: 'level',
        html: `<select class="select" id="level-filter">
                 <option value="">Todos los niveles</option>
                 ${Object.entries(LEVEL_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
               </select>`,
      },
    ],
    columns: [
      { key: 'level', label: 'Nivel' },
      { key: 'name', label: 'Año' },
      { key: 'files_count', label: 'Archivos' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Nuevo año',
      onClick: async (reload) => {
        const created = await openModal({
          title: 'Nuevo año',
          confirmLabel: 'Crear',
          body: fields(),
          onSubmit: (data) => AdminApi.createYear(data),
        });

        if (created) {
          toastOk('Año creado');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.years(params),
    deleteOne: (id) => AdminApi.deleteYear(id),
    renderRow: (year) => `
      <td>${esc(LEVEL_LABELS[year.level] ?? year.level)}</td>
      <td>${esc(year.name)}</td>
      <td>${year.files_count}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (year, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar año',
          body: fields(year),
          onSubmit: (data) => AdminApi.updateYear(year.id, data),
        });

        if (saved) {
          toastOk('Año actualizado');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const warning = Number(year.files_count)
          ? ` Los ${year.files_count} archivo(s) asociados quedan sin año.`
          : '';

        if (!(await confirmAction(`¿Borrar este año?${warning}`))) return;

        try {
          await AdminApi.deleteYear(year.id);
          toastOk('Año eliminado');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Años', html: table.html, mount: table.mount };
}

export function careersPage() {
  const fields = (career = {}) => `
    <label class="field">
      <span class="field__label">Nombre de la carrera</span>
      <input class="input" name="name" required minlength="2" maxlength="160"
             placeholder="Ej: Medicina" value="${esc(career.name ?? '')}" />
      <span class="field__hint">Es una lista libre, igual que las materias y los años: no depende de ninguna institución.</span>
    </label>
  `;

  const table = dataTable({
    searchPlaceholder: 'Buscar carrera',
    defaultSort: 'name',
    defaultDir: 'asc',
    emptyTitle: 'Sin carreras',
    emptyHint: 'Cargá la primera carrera para poder asignarla a cursos universitarios.',
    columns: [
      { key: 'name', label: 'Carrera' },
      { key: 'files_count', label: 'Archivos' },
      { key: 'created_at', label: 'Alta' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Nueva carrera',
      onClick: async (reload) => {
        const created = await openModal({
          title: 'Nueva carrera',
          confirmLabel: 'Crear',
          body: fields(),
          onSubmit: (data) => AdminApi.createCareer(data),
        });

        if (created) {
          toastOk('Carrera creada');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.careers(params),
    deleteOne: (id) => AdminApi.deleteCareer(id),
    renderRow: (career) => `
      <td>${esc(career.name)}${userTag(career)}</td>
      <td>${career.files_count}</td>
      <td>${formatDate(career.created_at)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (career, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar carrera',
          body: fields(career),
          onSubmit: (data) => AdminApi.updateCareer(career.id, data),
        });

        if (saved) {
          toastOk('Carrera actualizada');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const warning = Number(career.files_count)
          ? ` Los ${career.files_count} archivo(s) asociados quedan sin carrera.`
          : '';

        if (!(await confirmAction(`¿Borrar la carrera “${esc(career.name)}”?${warning}`))) return;

        try {
          await AdminApi.deleteCareer(career.id);
          toastOk('Carrera eliminada');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Carreras', html: table.html, mount: table.mount };
}

export function subjectsPage() {
  const fields = (subject = {}) => `
    <label class="field">
      <span class="field__label">Nombre</span>
      <input class="input" name="name" required minlength="2" maxlength="120"
             placeholder="Ej: Física" value="${esc(subject.name ?? '')}" />
    </label>
  `;

  const table = dataTable({
    searchPlaceholder: 'Buscar materia',
    defaultSort: 'name',
    defaultDir: 'asc',
    emptyTitle: 'Sin materias',
    emptyHint: 'Cargá la primera materia para poder asignarla a los archivos.',
    columns: [
      { key: 'name', label: 'Materia' },
      { key: 'files_count', label: 'Archivos' },
      { key: 'created_at', label: 'Alta' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Nueva materia',
      onClick: async (reload) => {
        const created = await openModal({
          title: 'Nueva materia',
          confirmLabel: 'Crear',
          body: fields(),
          onSubmit: (data) => AdminApi.createSubject(data),
        });

        if (created) {
          toastOk('Materia creada');
          reload();
        }
      },
    },
    fetch: (params) => AdminApi.subjects(params),
    deleteOne: (id) => AdminApi.deleteSubject(id),
    renderRow: (subject) => `
      <td>${esc(subject.name)}${userTag(subject)}</td>
      <td>${subject.files_count}</td>
      <td>${formatDate(subject.created_at)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (subject, tr, reload) => {
      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar materia',
          body: fields(subject),
          onSubmit: (data) => AdminApi.updateSubject(subject.id, data),
        });

        if (saved) {
          toastOk('Materia actualizada');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const warning = Number(subject.files_count)
          ? ` Los ${subject.files_count} archivo(s) asociados quedan sin materia.`
          : '';

        if (!(await confirmAction(`¿Borrar la materia “${esc(subject.name)}”?${warning}`))) return;

        try {
          await AdminApi.deleteSubject(subject.id);
          toastOk('Materia eliminada');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Materias', html: table.html, mount: table.mount };
}
