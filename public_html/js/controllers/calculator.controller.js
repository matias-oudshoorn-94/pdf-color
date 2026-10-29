import { SettingsModel, TaxonomyModel } from '../models/resources.js';
import { formatMoney } from '../lib/format.js';
import { itemTotal, pricePerPage, ringCharge } from '../lib/pricing.js';

/**
 * Calculador de precios: estima cuánto sale imprimir sin tener que subir un archivo.
 * Usa el mismo cálculo que el pedido (precios por cantidad + recargo por anillado).
 */

const OPTIONS = {
  paperSize: [
    ['A4', 'A4'],
    ['oficio', 'Oficio'],
  ],
  finish: [
    ['anillado', 'Anillado'],
    ['simple', 'Suelto'],
  ],
  side: [
    ['doble', 'Doble faz'],
    ['simple', 'Simple faz'],
  ],
};

const MAX_PAGES = 100000;

const toggleGroup = (name, value) => `
  <div class="delivery-toggle">
    ${OPTIONS[name]
      .map(
        ([v, label]) =>
          `<button type="button" class="delivery-toggle__btn ${v === value ? 'is-selected' : ''}" data-option="${name}" data-value="${v}" aria-pressed="${v === value}">${label}</button>`,
      )
      .join('')}
  </div>
`;

/** "1", "2 a 10" o "1501 o más", según dónde empieza el rango siguiente. */
function rangeLabel(tiers, index) {
  const from = tiers[index].min_pages;
  const next = tiers[index + 1];

  if (!next) return `${from} o más`;
  if (next.min_pages - 1 === from) return `${from}`;

  return `${from} a ${next.min_pages - 1}`;
}

export function calculatorPage() {
  return {
    html: `
      <section class="page">
        <header class="page__head">
          <div>
            <h2>Calculador de precios</h2>
            <p>Elegí cómo querés imprimir y te mostramos cuánto sale aproximadamente.</p>
          </div>
        </header>

        <div class="grid grid--split">
          <form class="card card--pad stack calculator" id="calculator" novalidate>
            <div class="field">
              <span class="field__label">Tamaño de hoja</span>
              <div data-group="paperSize"></div>
            </div>
            <div class="field">
              <span class="field__label">Terminación</span>
              <div data-group="finish"></div>
            </div>
            <div class="field">
              <span class="field__label">Impresión</span>
              <div data-group="side"></div>
            </div>
            <label class="field">
              <span class="field__label">Cantidad de páginas</span>
              <input class="input" id="pages" type="number" inputmode="numeric" min="1" max="${MAX_PAGES}" value="10" required />
              <span class="field__hint">Las páginas de tu archivo. En doble faz, cada hoja lleva 2 páginas.</span>
            </label>
          </form>

          <div class="stack" id="result">
            <div class="skeleton" style="height:220px"></div>
          </div>
        </div>
      </section>
    `,
    async mount(root) {
      const form = root.querySelector('#calculator');
      const pagesInput = root.querySelector('#pages');
      const result = root.querySelector('#result');

      const state = { paperSize: 'A4', finish: 'simple', side: 'doble' };
      let priceTiers = { doble: [], simple: [] };
      let priceRing = 0;

      const [tiersResponse, settingsResponse] = await Promise.allSettled([TaxonomyModel.priceTiers(), SettingsModel.get()]);

      if (tiersResponse.status === 'fulfilled') priceTiers = tiersResponse.value.priceTiers;
      if (settingsResponse.status === 'fulfilled') priceRing = Number(settingsResponse.value.settings.price_ring) || 0;

      const pages = () => Math.max(1, Math.min(MAX_PAGES, Math.floor(Number(pagesInput.value) || 1)));

      function renderToggles() {
        for (const group of form.querySelectorAll('[data-group]')) {
          group.innerHTML = toggleGroup(group.dataset.group, state[group.dataset.group]);
        }

        for (const button of form.querySelectorAll('[data-option]')) {
          button.addEventListener('click', () => {
            state[button.dataset.option] = button.dataset.value;
            renderToggles();
            renderResult();
          });
        }
      }

      function renderResult() {
        const tiers = priceTiers[state.side] ?? [];

        if (tiers.length === 0) {
          result.innerHTML = `
            <article class="card card--pad stack">
              <h3 class="card__title">Precio estimado</h3>
              <p class="muted">Todavía no tenemos los precios cargados. Escribinos y te pasamos un presupuesto.</p>
              <a class="btn" href="/contacto" data-link>Ir a contacto</a>
            </article>
          `;
          return;
        }

        const item = {
          pageCount: pages(),
          copies: 1,
          doubleSide: state.side === 'doble',
          finish: state.finish,
          paperSize: state.paperSize,
        };
        const perPage = pricePerPage(item, priceTiers);
        const ring = ringCharge(item, priceRing);
        const total = itemTotal(item, priceTiers, priceRing);
        const sideLabel = state.side === 'doble' ? 'doble faz' : 'simple faz';
        const activeIndex = tiers.reduce((found, tier, index) => (item.pageCount >= tier.min_pages ? index : found), 0);

        result.innerHTML = `
          <article class="card card--pad stack calculator-result">
            <span class="calculator-result__label">Precio estimado</span>
            <strong class="calculator-result__total">${formatMoney(total)}</strong>
            <dl class="calculator-result__lines">
              <div>
                <dt>${item.pageCount} página${item.pageCount === 1 ? '' : 's'} ${sideLabel} × ${formatMoney(perPage)}</dt>
                <dd>${formatMoney(item.pageCount * perPage)}</dd>
              </div>
              ${state.finish === 'anillado' ? `<div><dt>Anillado</dt><dd>${formatMoney(ring)}</dd></div>` : ''}
            </dl>
            <p class="muted calculator-result__note">
              Es un estimado para 1 copia, sin envío. El tamaño de hoja (${state.paperSize === 'A4' ? 'A4' : 'oficio'}) no cambia el precio.
            </p>
            <a class="btn btn--primary btn--block" href="/subir" data-link>Subir mi archivo</a>
          </article>

          <article class="card card--pad stack">
            <h3 class="card__title">Precios por página · ${sideLabel}</h3>
            <table class="table calculator-tiers">
              <thead><tr><th>Páginas</th><th>Precio por página</th></tr></thead>
              <tbody>
                ${tiers
                  .map(
                    (tier, index) => `
                      <tr class="${index === activeIndex ? 'is-active' : ''}">
                        <td>${rangeLabel(tiers, index)}</td>
                        <td>${formatMoney(tier.price_per_page)}</td>
                      </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
            <p class="muted calculator-result__note">Color o blanco y negro tienen el mismo precio.</p>
          </article>
        `;
      }

      pagesInput.addEventListener('input', renderResult);
      pagesInput.addEventListener('change', () => {
        pagesInput.value = pages();
        renderResult();
      });
      form.addEventListener('submit', (event) => event.preventDefault());

      renderToggles();
      renderResult();
    },
  };
}
