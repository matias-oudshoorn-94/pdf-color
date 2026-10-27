import { esc } from '/js/lib/dom.js';
import { toastErr, toastOk } from '/js/lib/toast.js';
import { emptyState } from '/js/views/components.view.js';
import { confirmAction } from './modal.view.js';

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

/**
 * Tabla del panel con búsqueda, filtros, orden, cantidad por página y paginador.
 *
 * @param {object} options
 * @param {Array<{key:string,label:string,sortable?:boolean,align?:string}>} options.columns
 * @param {(params:object) => Promise<object>} options.fetch  recibe {search, page, perPage, sort, dir, ...filtros}
 * @param {(row:object) => string} options.renderRow          celdas del <tr>
 * @param {(row:object, tr:HTMLElement, reload:Function) => void} [options.bindRow]
 * @param {string} [options.defaultSort]
 * @param {Array<{id:string,html:string}>} [options.filters]  controles extra de la barra
 * @param {{label:string, onClick:Function}} [options.action] botón principal
 * @param {(id:number|string) => Promise<void>} [options.deleteOne] habilita selección múltiple y borrado masivo
 */
export function dataTable(options) {
  const {
    columns,
    fetch: fetchPage,
    renderRow,
    bindRow,
    defaultSort = 'created_at',
    defaultDir = 'desc',
    searchPlaceholder = 'Buscar…',
    filters = [],
    action,
    emptyTitle = 'Sin registros',
    emptyHint = '',
    deleteOne,
  } = options;

  const state = { search: '', page: 1, perPage: 25, sort: defaultSort, dir: defaultDir };
  const selected = new Set();

  const html = `
    <div class="toolbar">
      <input class="input" data-search type="search" placeholder="${esc(searchPlaceholder)}" />
      ${filters.map((filter) => filter.html).join('')}
      <span class="toolbar__spacer"></span>
      <label class="toolbar__field">
        <span>Ordenar por</span>
        <select class="select select--sm" data-sort>
          ${columns
            .filter((column) => column.sortable !== false)
            .map((column) => `<option value="${column.key}">${esc(column.label)}</option>`)
            .join('')}
        </select>
      </label>
      <button class="btn btn--sm" data-dir type="button" title="Invertir orden">↓</button>
      <label class="toolbar__field">
        <span>Mostrar</span>
        <select class="select select--sm" data-per-page>
          ${PER_PAGE_OPTIONS.map((n) => `<option value="${n}" ${n === 25 ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </label>
      ${action ? `<button class="btn btn--sm btn--primary" data-action-new type="button">${esc(action.label)}</button>` : ''}
    </div>

    ${
      deleteOne
        ? `<div class="bulk-bar" data-bulk-bar hidden>
             <span data-bulk-count></span>
             <span class="bulk-bar__spacer"></span>
             <button class="btn btn--sm btn--danger" data-bulk-delete type="button">Eliminar seleccionados</button>
             <button class="btn btn--sm btn--ghost" data-bulk-clear type="button">Cancelar selección</button>
           </div>`
        : ''
    }

    <div data-content><div class="skeleton" style="height:160px"></div></div>

    <nav class="pager" data-pager hidden>
      <span class="pager__info" data-info></span>
      <div class="pager__pages" data-pages></div>
    </nav>
  `;

  function mount(root) {
    const content = root.querySelector('[data-content]');
    const pager = root.querySelector('[data-pager]');
    const info = root.querySelector('[data-info]');
    const pages = root.querySelector('[data-pages]');
    const searchInput = root.querySelector('[data-search]');
    const sortSelect = root.querySelector('[data-sort]');
    const dirButton = root.querySelector('[data-dir]');
    const perPageSelect = root.querySelector('[data-per-page]');
    const bulkBar = root.querySelector('[data-bulk-bar]');
    const bulkCount = root.querySelector('[data-bulk-count]');

    sortSelect.value = state.sort;
    dirButton.textContent = state.dir === 'asc' ? '↑' : '↓';

    const extra = () =>
      Object.fromEntries(
        filters.map((filter) => [filter.name, root.querySelector(`#${filter.id}`)?.value ?? '']),
      );

    function updateBulkBar() {
      if (!deleteOne) return;

      bulkBar.hidden = selected.size === 0;
      bulkCount.textContent = `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`;
    }

    async function load() {
      content.innerHTML = '<div class="skeleton" style="height:160px"></div>';
      selected.clear();
      updateBulkBar();

      try {
        const data = await fetchPage({ ...state, ...extra() });

        if (data.items.length === 0) {
          content.innerHTML = emptyState(emptyTitle, emptyHint);
          pager.hidden = true;
          return;
        }

        content.innerHTML = `
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  ${deleteOne ? '<th class="th--check"><input type="checkbox" data-select-all /></th>' : ''}
                  ${columns
                    .map(
                      (column) => `
                        <th ${column.sortable === false ? '' : `data-column="${column.key}" class="th--sortable"`}
                            ${column.align ? `style="text-align:${column.align}"` : ''}>
                          ${esc(column.label)}
                          ${column.key === state.sort ? `<span class="th__arrow">${state.dir === 'asc' ? '↑' : '↓'}</span>` : ''}
                        </th>`,
                    )
                    .join('')}
                </tr>
              </thead>
              <tbody>
                ${data.items
                  .map(
                    (row) => `
                      <tr data-id="${row.id}">
                        ${deleteOne ? `<td class="th--check"><input type="checkbox" data-select="${row.id}" /></td>` : ''}
                        ${renderRow(row)}
                      </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;

        if (deleteOne) {
          const selectAll = content.querySelector('[data-select-all]');
          const rowChecks = () => [...content.querySelectorAll('[data-select]')];

          selectAll.addEventListener('change', () => {
            for (const check of rowChecks()) {
              check.checked = selectAll.checked;

              if (selectAll.checked) selected.add(check.dataset.select);
              else selected.delete(check.dataset.select);
            }

            updateBulkBar();
          });

          for (const check of rowChecks()) {
            check.addEventListener('change', () => {
              if (check.checked) selected.add(check.dataset.select);
              else selected.delete(check.dataset.select);

              selectAll.checked = selected.size === rowChecks().length;
              updateBulkBar();
            });
          }
        }

        for (const th of content.querySelectorAll('[data-column]')) {
          th.addEventListener('click', () => {
            const key = th.dataset.column;

            state.dir = state.sort === key && state.dir === 'desc' ? 'asc' : 'desc';
            state.sort = key;
            state.page = 1;
            sortSelect.value = key;
            dirButton.textContent = state.dir === 'asc' ? '↑' : '↓';
            load();
          });
        }

        if (bindRow) {
          for (const tr of content.querySelectorAll('[data-id]')) {
            const row = data.items.find((item) => String(item.id) === tr.dataset.id);
            bindRow(row, tr, load);
          }
        }

        renderPager(data);
      } catch (error) {
        content.innerHTML = emptyState('No se pudo cargar el listado', error.message);
        pager.hidden = true;
      }
    }

    function renderPager({ total, page, perPage, pages: totalPages }) {
      pager.hidden = false;

      const from = (page - 1) * perPage + 1;
      const to = Math.min(total, page * perPage);

      info.textContent = `${from}–${to} de ${total} registro${total === 1 ? '' : 's'}`;

      const numbers = pageNumbers(page, totalPages);

      pages.innerHTML = `
        <button class="pager__btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Anterior</button>
        ${numbers
          .map((n) =>
            n === '…'
              ? '<span class="pager__gap">…</span>'
              : `<button class="pager__btn ${n === page ? 'is-current' : ''}" data-page="${n}">${n}</button>`,
          )
          .join('')}
        <button class="pager__btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Siguiente</button>
      `;

      for (const button of pages.querySelectorAll('[data-page]')) {
        button.addEventListener('click', () => {
          state.page = Number(button.dataset.page);
          load();
          root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }

    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.search = searchInput.value.trim();
        state.page = 1;
        load();
      }, 300);
    });

    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      state.page = 1;
      load();
    });

    dirButton.addEventListener('click', () => {
      state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      dirButton.textContent = state.dir === 'asc' ? '↑' : '↓';
      state.page = 1;
      load();
    });

    perPageSelect.addEventListener('change', () => {
      state.perPage = Number(perPageSelect.value);
      state.page = 1;
      load();
    });

    for (const filter of filters) {
      root.querySelector(`#${filter.id}`)?.addEventListener('change', () => {
        state.page = 1;
        load();
      });
    }

    root.querySelector('[data-action-new]')?.addEventListener('click', () => action.onClick(load));

    if (deleteOne) {
      root.querySelector('[data-bulk-clear]').addEventListener('click', () => {
        selected.clear();

        for (const check of content.querySelectorAll('[data-select]')) check.checked = false;
        const selectAll = content.querySelector('[data-select-all]');
        if (selectAll) selectAll.checked = false;

        updateBulkBar();
      });

      root.querySelector('[data-bulk-delete]').addEventListener('click', async () => {
        const ids = [...selected];
        const confirmed = await confirmAction(
          `¿Borrar ${ids.length} elemento${ids.length === 1 ? '' : 's'} seleccionado${ids.length === 1 ? '' : 's'}? Esta acción no se puede deshacer.`,
          'Eliminar',
        );

        if (!confirmed) return;

        const results = await Promise.allSettled(ids.map((id) => deleteOne(id)));
        const failures = results.filter((r) => r.status === 'rejected');
        const okCount = results.length - failures.length;

        if (okCount > 0) toastOk(`${okCount} elemento${okCount === 1 ? '' : 's'} eliminado${okCount === 1 ? '' : 's'}`);

        if (failures.length > 0) {
          toastErr(
            failures.length === 1
              ? failures[0].reason?.message ?? 'No se pudo borrar un elemento'
              : `${failures.length} elementos no se pudieron borrar`,
          );
        }

        load();
      });
    }

    load();

    return load;
  }

  return { html, mount };
}

/** Ventana de números alrededor de la página actual: 1 … 4 5 6 … 20 */
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const numbers = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...numbers].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result = [];

  for (const [index, number] of sorted.entries()) {
    if (index > 0 && number - sorted[index - 1] > 1) result.push('…');
    result.push(number);
  }

  return result;
}
