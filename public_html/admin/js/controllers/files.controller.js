import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction, openModal } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { fileKind, formatBytes, formatDate, truncate } from '/js/lib/format.js';
import { openViewer, isPreviewable } from '/js/views/viewer.view.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

const LEVEL_LABELS = { primaria: 'Primaria', secundaria: 'Secundaria', universitario: 'Universitario' };

export function filesPage() {
  let institutions = [];
  let years = [];
  let careers = [];
  let subjects = [];

  const option = (value, label, selected) =>
    `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`;

  const institutionOptions = (selected) =>
    '<option value="">Sin asignar</option>' +
    institutions.map((i) => option(i.id, `${i.name} · ${i.location_name}`, selected)).join('');

  const careerOptions = (selected) =>
    '<option value="">Sin asignar</option>' + careers.map((c) => option(c.id, c.name, selected)).join('');

  const subjectOptions = (selected) =>
    '<option value="">Sin asignar</option>' + subjects.map((s) => option(s.id, s.name, selected)).join('');

  const fields = (file) => `
    <label class="field">
      <span class="field__label">Título</span>
      <input class="input" name="title" required maxlength="180" value="${esc(file.title)}" />
    </label>
    <label class="field">
      <span class="field__label">Institución</span>
      <select class="select" name="institutionId">${institutionOptions(file.institution_id)}</select>
    </label>
    <label class="field">
      <span class="field__label">Nivel educativo</span>
      <select class="select" name="level" data-field="level">
        <option value="">Sin asignar</option>
        ${Object.entries(LEVEL_LABELS).map(([value, label]) => option(value, label, file.level)).join('')}
      </select>
    </label>
    <label class="field" data-career-wrap hidden>
      <span class="field__label">Carrera</span>
      <select class="select" name="careerId" data-field="career">${careerOptions(file.career_id)}</select>
    </label>
    <label class="field">
      <span class="field__label">Año</span>
      <select class="select" name="yearId" data-field="year"></select>
    </label>
    <label class="field">
      <span class="field__label">Materia</span>
      <select class="select" name="subjectId">${subjectOptions(file.subject_id)}</select>
    </label>
    <label class="field">
      <span class="field__label">Descripción</span>
      <textarea class="textarea" name="description" maxlength="500">${esc(file.description ?? '')}</textarea>
    </label>
    <label class="field">
      <span class="field__label">Páginas (para calcular el precio)</span>
      <input class="input" type="number" name="pageCount" min="1" max="5000" value="${file.page_count}" required />
      <span class="field__hint">Se detecta automáticamente al subir el archivo. Corregilo si hace falta.</span>
    </label>
    <label class="checkbox">
      <input type="checkbox" name="isPublic" ${Number(file.is_public) ? 'checked' : ''} />
      Visible en el catálogo público
    </label>
  `;

  /** Año depende solo del nivel (lista libre, ya cargada); Carrera se muestra solo si es universitario. */
  function bindFileForm(form, file) {
    const levelSelect = form.querySelector('[data-field="level"]');
    const careerWrap = form.querySelector('[data-career-wrap]');
    const yearSelect = form.querySelector('[data-field="year"]');

    function renderYearOptions(selected) {
      const relevant = years.filter((y) => y.level === levelSelect.value);
      yearSelect.innerHTML = '<option value="">Sin asignar</option>' + relevant.map((y) => option(y.id, y.name, selected)).join('');
    }

    careerWrap.hidden = levelSelect.value !== 'universitario';
    renderYearOptions(file.year_id);

    levelSelect.addEventListener('change', () => {
      careerWrap.hidden = levelSelect.value !== 'universitario';
      renderYearOptions(''); // el año anterior ya no es válido para el nuevo nivel
    });
  }

  const table = dataTable({
    searchPlaceholder: 'Buscar por título, archivo, cliente o materia',
    defaultSort: 'created_at',
    emptyTitle: 'Sin archivos',
    emptyHint: 'Cuando los clientes suban archivos aparecen acá.',
    columns: [
      { key: 'title', label: 'Título' },
      { key: 'owner_name', label: 'Cliente' },
      { key: 'institution_name', label: 'Clasificación' },
      { key: 'size_bytes', label: 'Tamaño' },
      { key: 'page_count', label: 'Páginas', sortable: false },
      { key: 'is_public', label: 'Visibilidad' },
      { key: 'sales_count', label: 'Ventas' },
      { key: 'created_at', label: 'Fecha' },
      { key: 'acciones', label: '', sortable: false },
    ],
    action: {
      label: 'Recalcular páginas',
      onClick: async (reload) => {
        const confirmed = await confirmAction(
          'Vuelve a contar las páginas de todos los archivos leyendo el PDF guardado en el servidor. ' +
            'Pisa cualquier corrección manual que hayas hecho. ¿Continuar?',
          'Recalcular',
        );

        if (!confirmed) return;

        try {
          const { updated } = await AdminApi.recountPages();
          toastOk(`Páginas recalculadas en ${updated} archivo(s)`);
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      },
    },
    fetch: (params) => AdminApi.files(params),
    deleteOne: (id) => AdminApi.deleteFile(id),
    renderRow: (file) => {
      const classification = [LEVEL_LABELS[file.level] ?? file.level, file.career_name, file.year_name].filter(Boolean);

      return `
      <td>
        <span title="${esc(file.title)}">${esc(truncate(file.title, 40))}</span><br />
        <span class="muted" title="${esc(file.original_name)}">${esc(truncate(file.original_name, 40))} · ${esc(fileKind(file.mime_type))}</span>
      </td>
      <td>${esc(file.owner_name)}</td>
      <td>
        ${
          file.institution_name || classification.length
            ? `${file.institution_name ? esc(file.institution_name) : '<span class="muted">Sin institución</span>'}<br />
               <span class="muted">${esc(classification.join(' · '))}</span>`
            : '<span class="muted">Sin asignar</span>'
        }
        ${file.subject_name ? `<br /><span class="muted">${esc(file.subject_name)}</span>` : ''}
      </td>
      <td>${formatBytes(file.size_bytes)}</td>
      <td>${file.page_count}</td>
      <td>${Number(file.is_public) ? '<span class="badge">Público</span>' : '<span class="badge">Privado</span>'}</td>
      <td>${file.sales_count}</td>
      <td>${formatDate(file.created_at)}</td>
      <td>
        <div class="cell-actions">
          ${isPreviewable(file.mime_type) ? '<button class="btn btn--sm" data-action="preview" type="button">Ver</button>' : ''}
          <a class="btn btn--sm btn--ghost" href="${AdminApi.downloadUrl(file.id)}">Descargar</a>
          <button class="btn btn--sm" data-action="edit" type="button">Editar</button>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `;
    },
    bindRow: (file, tr, reload) => {
      tr.querySelector('[data-action="preview"]')?.addEventListener('click', () => openViewer(file));

      tr.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const saved = await openModal({
          title: 'Editar archivo',
          confirmLabel: 'Guardar cambios',
          body: fields(file),
          onMount: (form) => bindFileForm(form, file),
          onSubmit: (data, form) =>
            AdminApi.updateFile(file.id, {
              title: data.title,
              description: data.description,
              institutionId: data.institutionId,
              level: data.level,
              careerId: data.careerId,
              yearId: data.yearId,
              subjectId: data.subjectId,
              pageCount: data.pageCount,
              isPublic: form.isPublic.checked,
            }),
        });

        if (saved) {
          toastOk('Archivo actualizado');
          reload();
        }
      });

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!(await confirmAction(`¿Borrar “${esc(file.title)}”? También se elimina del servidor.`))) return;

        try {
          await AdminApi.deleteFile(file.id);
          toastOk('Archivo eliminado');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return {
    title: 'Archivos',
    html: table.html,
    async mount(root) {
      // Se usan en los selectores del modal de edición.
      institutions = (await AdminApi.institutions({ perPage: 200, page: 1 })).items ?? [];
      years = (await AdminApi.years({ perPage: 500, page: 1 })).items ?? [];
      careers = (await AdminApi.careers({ perPage: 200, page: 1 })).items ?? [];
      subjects = (await AdminApi.subjects({ perPage: 200, page: 1 })).items ?? [];

      return table.mount(root);
    },
  };
}
