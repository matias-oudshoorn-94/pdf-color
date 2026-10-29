import { FilesModel, TaxonomyModel } from '../models/resources.js';
import { cart } from '../models/cart.js';
import { session } from '../models/session.js';
import { emptyState, fileCard, skeletonGrid } from '../views/components.view.js';
import { openViewer } from '../views/viewer.view.js';
import { openCartDrawer } from '../views/cart-drawer.view.js';
import { esc } from '../lib/dom.js';
import { paintThumbnail } from '../lib/thumbnail.js';
import { toastErr, toastOk } from '../lib/toast.js';
import { searchableSelect } from '../lib/searchable-select.js';
import { mountStarInput, starsDisplay } from '../views/stars.view.js';

const PAGE_SIZE = 8;

const fillSelect = (select, items, label, placeholder) => {
  select.innerHTML =
    `<option value="">${placeholder}</option>` +
    items.map((item) => `<option value="${item.id}">${label(item)}</option>`).join('');
  select.disabled = items.length === 0;
};

export function catalogPage() {
  return {
    html: `
      <section class="page">
        <header class="page__head">
          <div>
            <h2>Catálogo de archivos</h2>
            <p>Buscá por institución, año o materia.</p>
          </div>
        </header>

        <!-- En la compu los filtros se ven siempre; en el celular se abren en un panel lateral. -->
        <div class="filters-drawer" id="filters-drawer">
          <div class="filters-drawer__backdrop" data-close-filters></div>
          <div class="filters-drawer__panel" aria-label="Filtros">
            <header class="filters-drawer__head">
              <h3>Filtros</h3>
              <button class="btn btn--sm btn--ghost" type="button" data-close-filters>Cerrar</button>
            </header>
        <form class="card card--pad filters" id="filters" role="search">
          <label class="field">
            <span class="field__label">Localidad</span>
            <select class="select" id="location"><option value="">Todas</option></select>
          </label>
          <label class="field">
            <span class="field__label">Institución</span>
            <div id="institution"></div>
          </label>
          <label class="field">
            <span class="field__label">Nivel</span>
            <select class="select" id="level">
              <option value="">Todos</option>
              <option value="primaria">Primaria</option>
              <option value="secundaria">Secundaria</option>
              <option value="universitario">Universitario</option>
            </select>
          </label>
          <label class="field" id="career-wrap" hidden>
            <span class="field__label">Carrera</span>
            <select class="select" id="career"><option value="">Todas</option></select>
          </label>
          <label class="field">
            <span class="field__label">Año</span>
            <select class="select" id="year" disabled><option value="">Todos</option></select>
          </label>
          <label class="field">
            <span class="field__label">Materia</span>
            <select class="select" id="subject"><option value="">Todas</option></select>
          </label>
          <label class="field">
            <span class="field__label">Buscar</span>
            <input class="input" id="search" type="search" placeholder="Título o materia…" />
          </label>
        </form>
            <footer class="filters-drawer__foot">
              <button class="btn btn--primary btn--block" type="button" data-close-filters id="filters-apply">Ver archivos</button>
            </footer>
          </div>
        </div>

        <div class="catalog-sort">
          <button class="btn filters-toggle" type="button" id="filters-open" aria-controls="filters-drawer" aria-expanded="false">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filtros
            <span class="filters-toggle__count" id="filters-count" hidden></span>
          </button>
          <span class="catalog-sort__spacer"></span>
          <label class="catalog-sort__label" for="sort">Ordenar por</label>
          <select class="select" id="sort">
            <option value="created_at-desc">Más recientes</option>
            <option value="sales_count-desc">Más vendidos</option>
            <option value="sales_count-asc">Menos vendidos</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
          </select>
        </div>

        <div class="chips" id="active-filters" hidden></div>

        <div id="results">${skeletonGrid(PAGE_SIZE)}</div>

        <div class="load-more" id="load-more" hidden>
          <span class="muted" id="counter"></span>
          <button class="btn" id="more" type="button">Cargar más</button>
        </div>
      </section>
    `,
    async mount(root) {
      const results = root.querySelector('#results');
      const form = root.querySelector('#filters');

      // Mantiene sincronizado el botón "Agregar al pedido" si el archivo se
      // quita del carrito desde otro lado (ej: el sidebar del pedido).
      cart.subscribe(() => {
        for (const card of results.querySelectorAll('[data-file-id]')) {
          const button = card.querySelector('[data-action="add"]');
          if (!button) continue;

          const inCart = cart.has(Number(card.dataset.fileId));
          button.disabled = inCart;
          button.textContent = inCart ? 'En el pedido' : 'Agregar al pedido';
        }
      });
      const location = root.querySelector('#location');
      const institution = searchableSelect(root.querySelector('#institution'), {
        placeholder: 'Buscar institución…',
        emptyLabel: 'Todas',
      });
      const level = root.querySelector('#level');
      const careerWrap = root.querySelector('#career-wrap');
      const career = root.querySelector('#career');
      const year = root.querySelector('#year');
      const subject = root.querySelector('#subject');
      const search = root.querySelector('#search');
      const sort = root.querySelector('#sort');
      const chips = root.querySelector('#active-filters');
      const loadMoreBox = root.querySelector('#load-more');
      const moreButton = root.querySelector('#more');
      const counter = root.querySelector('#counter');
      const filtersDrawer = root.querySelector('#filters-drawer');
      const filtersOpen = root.querySelector('#filters-open');
      const filtersCount = root.querySelector('#filters-count');
      const filtersApply = root.querySelector('#filters-apply');

      // ---------- Panel de filtros (solo celular) ----------

      function onFiltersKey(event) {
        if (event.key === 'Escape') closeFilters();
      }

      // Mientras está abierto, el panel se pasa al <body>: la animación de entrada de
      // .page deja un transform que, si no, lo encierra dentro de la página en vez de
      // cubrir toda la pantalla. Al cerrar vuelve a su lugar.
      const filtersAnchor = document.createComment('filtros');
      filtersDrawer.before(filtersAnchor);
      const mobileQuery = window.matchMedia('(max-width: 720px)');

      function openFilters() {
        document.body.append(filtersDrawer);
        filtersDrawer.classList.add('is-open');
        filtersOpen.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onFiltersKey);
      }

      function closeFilters() {
        if (!filtersDrawer.classList.contains('is-open')) return;

        filtersDrawer.classList.remove('is-open');
        filtersAnchor.after(filtersDrawer);
        filtersOpen.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onFiltersKey);
      }

      filtersOpen.addEventListener('click', openFilters);
      for (const button of root.querySelectorAll('[data-close-filters]')) {
        button.addEventListener('click', closeFilters);
      }

      // Si se agranda la ventana a tamaño compu, o se navega con el panel abierto, se cierra.
      mobileQuery.addEventListener('change', closeFilters);
      window.addEventListener('popstate', closeFilters, { once: true });

      // Estado de la paginación incremental.
      let page = 1;
      let total = 0;
      let loaded = [];

      try {
        const { locations } = await TaxonomyModel.locations();
        fillSelect(location, locations, (l) => l.name, 'Todas');

        const marDelPlata = locations.find((l) => l.name === 'Mar del Plata');
        if (marDelPlata) {
          location.value = String(marDelPlata.id);
        }
        await loadInstitutions();
      } catch {
        location.disabled = true;
      }

      try {
        const { subjects } = await TaxonomyModel.subjects();
        fillSelect(subject, subjects, (s) => s.name, 'Todas');
      } catch {
        subject.disabled = true;
      }

      try {
        const { careers } = await TaxonomyModel.careers();
        fillSelect(career, careers, (c) => c.name, 'Todas');
      } catch {
        career.disabled = true;
      }

      async function loadInstitutions() {
        institution.setOptions([], () => '');

        if (!location.value) return;

        const { institutions } = await TaxonomyModel.institutions(location.value);
        institution.setOptions(institutions, (i) => i.name);
      }

      function resetCareer() {
        careerWrap.hidden = true;
        career.value = '';
      }

      async function loadYears() {
        year.innerHTML = '<option value="">Todos</option>';

        if (!level.value) {
          year.disabled = true;
          return;
        }

        const { years } = await TaxonomyModel.years(level.value);
        fillSelect(year, years, (y) => y.name, 'Todos');
      }

      const currentFilters = () => {
        const [sortField, sortDir] = sort.value.split('-');

        return {
          search: search.value.trim(),
          locationId: location.value,
          institutionId: institution.value,
          level: level.value,
          careerId: level.value === 'universitario' ? career.value : '',
          yearId: year.value,
          subjectId: subject.value,
          sort: sortField,
          dir: sortDir,
          limit: PAGE_SIZE,
        };
      };

      const selectedLabel = (select) => select.selectedOptions[0]?.textContent.trim() ?? '';

      /** Quita un filtro y arrastra los que dependen de él. */
      async function clearFilter(name) {
        if (name === 'location') {
          location.value = '';
          await loadInstitutions();
        } else if (name === 'institution') {
          institution.value = '';
        } else if (name === 'level') {
          level.value = '';
          resetCareer();
          await loadYears();
        } else if (name === 'career') {
          career.value = '';
        } else if (name === 'year') {
          year.value = '';
        } else if (name === 'subject') {
          subject.value = '';
        } else if (name === 'search') {
          search.value = '';
        } else {
          location.value = '';
          institution.value = '';
          level.value = '';
          resetCareer();
          subject.value = '';
          search.value = '';
          await loadInstitutions();
          await loadYears();
        }
      }

      function renderChips() {
        const active = [
          location.value && { name: 'location', label: 'Localidad', value: selectedLabel(location) },
          institution.value && { name: 'institution', label: 'Institución', value: selectedLabel(institution) },
          level.value && { name: 'level', label: 'Nivel', value: selectedLabel(level) },
          level.value === 'universitario' && career.value && { name: 'career', label: 'Carrera', value: selectedLabel(career) },
          year.value && { name: 'year', label: 'Año', value: selectedLabel(year) },
          subject.value && { name: 'subject', label: 'Materia', value: selectedLabel(subject) },
          search.value.trim() && { name: 'search', label: 'Búsqueda', value: search.value.trim() },
        ].filter(Boolean);

        chips.hidden = active.length === 0;
        filtersCount.hidden = active.length === 0;
        filtersCount.textContent = String(active.length);

        chips.innerHTML =
          active
            .map(
              (filter) => `
                <span class="chip" data-filter="${filter.name}">
                  <span class="chip__label">${esc(filter.label)}:</span>
                  <span class="chip__value">${esc(filter.value)}</span>
                  <button class="chip__close" type="button" aria-label="Quitar filtro ${esc(filter.label)}">×</button>
                </span>`,
            )
            .join('') +
          (active.length > 1
            ? '<button class="chip chip--clear" type="button" data-filter="all">Limpiar todo</button>'
            : '');

        for (const chip of chips.querySelectorAll('[data-filter]')) {
          const name = chip.dataset.filter;
          const trigger = chip.querySelector('.chip__close') ?? chip;

          trigger.addEventListener('click', async () => {
            await clearFilter(name);
            renderChips();
            load();
          });
        }
      }

      function renderCards(files, { append }) {
        const markup = files
          .map((file) => fileCard(file, { inCart: cart.has(file.id), canRate: session.isAuth }))
          .join('');

        if (append) {
          results.querySelector('.grid').insertAdjacentHTML('beforeend', markup);
        } else {
          results.innerHTML = `<div class="grid grid--cards">${markup}</div>`;
        }

        bindCards();
      }

      function updateFooter() {
        const hasMore = loaded.length < total;

        loadMoreBox.hidden = total === 0;
        moreButton.hidden = !hasMore;
        counter.textContent = hasMore
          ? `Mostrando ${loaded.length} de ${total} archivos`
          : `${total} archivo${total === 1 ? '' : 's'}`;
        filtersApply.textContent = total === 0 ? 'Ver resultados' : `Ver ${total} archivo${total === 1 ? '' : 's'}`;
      }

      async function load({ append = false } = {}) {
        if (append) {
          moreButton.disabled = true;
          moreButton.textContent = 'Cargando…';
        } else {
          page = 1;
          loaded = [];
          loadMoreBox.hidden = true;
          results.innerHTML = skeletonGrid(PAGE_SIZE);
        }

        try {
          const response = await FilesModel.list({ ...currentFilters(), page });

          total = response.total;
          loaded = append ? [...loaded, ...response.files] : response.files;

          if (loaded.length === 0) {
            results.innerHTML = emptyState('No hay archivos con esos filtros', 'Probá quitando alguno o subí uno nuevo.');
            loadMoreBox.hidden = true;
            return;
          }

          renderCards(response.files, { append });
          updateFooter();
        } catch (error) {
          if (append) {
            toastErr(error.message);
          } else {
            results.innerHTML = emptyState('No se pudo cargar el catálogo', error.message);
          }
        } finally {
          moreButton.disabled = false;
          moreButton.textContent = 'Cargar más';
        }
      }

      function bindCards() {
        for (const card of results.querySelectorAll('[data-file-id]')) {
          if (card.dataset.bound) continue;
          card.dataset.bound = 'true';

          const file = loaded.find((f) => f.id === Number(card.dataset.fileId));

          const thumb = card.querySelector('[data-thumb]');
          if (thumb) paintThumbnail(thumb, file);

          card.querySelector('[data-action="add"]')?.addEventListener('click', (event) => {
            if (cart.add(file)) {
              event.currentTarget.textContent = 'En el pedido';
              event.currentTarget.disabled = true;
              openCartDrawer();
            }
          });

          card.querySelector('[data-action="preview"]')?.addEventListener('click', () => openViewer(file));

          card.querySelector('[data-action="rate"]')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const widget = card.querySelector('[data-rating-widget]');

            button.hidden = true;
            widget.hidden = false;
            widget.textContent = 'Cargando…';

            try {
              const { rating } = await FilesModel.rating(file.id);

              widget.textContent = '';
              mountStarInput(widget, {
                value: rating.mine ?? 0,
                onRate: async (value) => {
                  try {
                    const { rating: updated } = await FilesModel.rate(file.id, value);
                    card.querySelector('[data-rating-display]').innerHTML = starsDisplay(updated.average, updated.count);
                    toastOk('¡Gracias por tu valoración!');
                  } catch (error) {
                    toastErr(error.message);
                    throw error;
                  }
                },
              });
            } catch (error) {
              toastErr(error.message);
              button.hidden = false;
              widget.hidden = true;
            }
          });
        }
      }

      moreButton.addEventListener('click', () => {
        page += 1;
        load({ append: true });
      });

      location.addEventListener('change', async () => {
        await loadInstitutions();
        renderChips();
        load();
      });

      institution.addEventListener('change', () => {
        renderChips();
        load();
      });

      level.addEventListener('change', async () => {
        careerWrap.hidden = level.value !== 'universitario';
        career.value = '';
        await loadYears();
        renderChips();
        load();
      });

      career.addEventListener('change', () => {
        renderChips();
        load();
      });

      year.addEventListener('change', () => {
        renderChips();
        load();
      });

      subject.addEventListener('change', () => {
        renderChips();
        load();
      });

      sort.addEventListener('change', () => load());

      let timer;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          renderChips();
          load();
        }, 300);
      });

      form.addEventListener('submit', (event) => event.preventDefault());

      renderChips();
      load();
    },
  };
}
