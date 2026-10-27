import { AdminApi } from '../models/admin.api.js';
import { esc } from '/js/lib/dom.js';
import { formatMoney, STATUS_LABELS } from '/js/lib/format.js';
import { emptyState } from '/js/views/components.view.js';
import { toastErr } from '/js/lib/toast.js';

const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';

let chartLoading = null;

function loadChartJs() {
  if (window.Chart) return Promise.resolve();
  if (chartLoading) return chartLoading;

  chartLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHART_JS_URL;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('No se pudo cargar la librería de gráficos')));
    document.head.append(script);
  });

  return chartLoading;
}

/** Lee los tokens de color del tema (mismos que usa el resto del sitio) para que los gráficos combinen. */
function theme() {
  const style = getComputedStyle(document.documentElement);
  const v = (name) => style.getPropertyValue(name).trim();

  return {
    text2: v('--text-2'),
    text3: v('--text-3'),
    line: v('--line'),
    accent: v('--accent'),
    ok: v('--ok'),
    warn: v('--warn'),
    info: v('--info'),
    err: v('--err'),
  };
}

const RANGES = {
  '7d': { label: 'Últimos 7 días', from: () => daysAgo(7), group: 'day' },
  '30d': { label: 'Últimos 30 días', from: () => daysAgo(30), group: 'day' },
  '90d': { label: 'Últimos 90 días', from: () => daysAgo(90), group: 'week' },
  '12m': { label: 'Últimos 12 meses', from: () => monthsAgo(12), group: 'month' },
  year: { label: 'Este año', from: () => `${new Date().getFullYear()}-01-01`, group: 'month' },
  all: { label: 'Todo', from: () => '2000-01-01', group: 'year' },
};

const GROUPS = { day: 'Día', week: 'Semana', month: 'Mes', year: 'Año' };

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const date = new Date();
  date.setDate(date.getDate() - n);

  return isoDate(date);
}

function monthsAgo(n) {
  const date = new Date();
  date.setMonth(date.getMonth() - n);

  return isoDate(date);
}

function formatBucket(bucket, group) {
  const date = new Date(`${bucket}T00:00:00`);

  if (group === 'year') return date.getFullYear().toString();
  if (group === 'month') return date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
  if (group === 'week') return `Sem. ${date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`;

  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

const metric = (value, label) => `
  <article class="metric">
    <div class="metric__value">${value}</div>
    <div class="metric__label">${label}</div>
  </article>
`;

const rankingTable = (rows, nameKey, emptyText) =>
  rows.length === 0
    ? `<p class="muted">${emptyText}</p>`
    : `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nombre</th><th style="text-align:right">Unidades</th><th style="text-align:right">Ingresos</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td>${esc(row[nameKey])}</td>
                    <td style="text-align:right">${row.units}</td>
                    <td style="text-align:right"><strong>${formatMoney(row.revenue)}</strong></td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

export function reportsPage() {
  return {
    title: 'Reportes',
    html: `
      <section class="stack">
        <div class="toolbar">
          <label class="toolbar__field">
            <span>Rango</span>
            <select class="select select--sm" data-range>
              ${Object.entries(RANGES).map(([key, r]) => `<option value="${key}" ${key === '30d' ? 'selected' : ''}>${r.label}</option>`).join('')}
            </select>
          </label>
          <label class="toolbar__field">
            <span>Agrupar por</span>
            <select class="select select--sm" data-group>
              ${Object.entries(GROUPS).map(([key, label]) => `<option value="${key}" ${key === 'day' ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="metrics" data-kpis>
          <div class="skeleton" style="height:90px"></div>
        </div>

        <div class="reports-charts">
          <div class="card card--pad">
            <h3 class="card__title">Ventas en el tiempo</h3>
            <div class="chart-box"><canvas data-chart-sales></canvas></div>
          </div>
          <div class="card card--pad">
            <h3 class="card__title">Pedidos por estado</h3>
            <div class="chart-box chart-box--donut"><canvas data-chart-status></canvas></div>
          </div>
        </div>

        <div class="reports-rankings" data-rankings>
          <div class="skeleton" style="height:220px"></div>
        </div>
      </section>
    `,
    async mount(root) {
      const rangeSelect = root.querySelector('[data-range]');
      const groupSelect = root.querySelector('[data-group]');
      const kpisBox = root.querySelector('[data-kpis]');
      const rankingsBox = root.querySelector('[data-rankings]');
      const salesCanvas = root.querySelector('[data-chart-sales]');
      const statusCanvas = root.querySelector('[data-chart-status]');

      let salesChart = null;
      let statusChart = null;

      try {
        await loadChartJs();
      } catch (error) {
        toastErr(error.message);
        return;
      }

      const th = theme();

      window.Chart.defaults.color = th.text3;
      window.Chart.defaults.borderColor = th.line;
      window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

      groupSelect.addEventListener('change', () => load());
      rangeSelect.addEventListener('change', () => {
        groupSelect.value = RANGES[rangeSelect.value].group;
        load();
      });

      async function load() {
        const range = RANGES[rangeSelect.value];
        const group = groupSelect.value;
        const from = range.from();

        try {
          const [{ series }, overview, rankings] = await Promise.all([
            AdminApi.reportsSales({ group, from }),
            AdminApi.reportsOverview({ from }),
            AdminApi.reportsRankings({ from }),
          ]);

          paintKpis(overview);
          paintSalesChart(series, group);
          paintStatusChart(overview.byStatus);
          paintRankings(rankings);
        } catch (error) {
          kpisBox.innerHTML = emptyState('No se pudieron cargar los reportes', error.message);
          rankingsBox.innerHTML = '';
        }
      }

      function paintKpis(overview) {
        kpisBox.innerHTML =
          metric(formatMoney(overview.revenue), 'Ventas') +
          metric(overview.orders, 'Pedidos') +
          metric(formatMoney(overview.avgOrder), 'Ticket promedio');
      }

      function paintSalesChart(series, group) {
        const labels = series.map((row) => formatBucket(row.bucket, group));
        const revenue = series.map((row) => Number(row.revenue));
        const orders = series.map((row) => Number(row.orders));

        salesChart?.destroy();
        salesChart = new window.Chart(salesCanvas, {
          data: {
            labels,
            datasets: [
              {
                type: 'bar',
                label: 'Ventas',
                data: revenue,
                backgroundColor: th.accent,
                borderRadius: 4,
                yAxisID: 'y',
              },
              {
                type: 'line',
                label: 'Pedidos',
                data: orders,
                borderColor: th.info,
                backgroundColor: th.info,
                tension: 0.3,
                yAxisID: 'y1',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
              y: {
                position: 'left',
                beginAtZero: true,
                ticks: { callback: (value) => formatMoney(value) },
                grid: { color: th.line },
              },
              y1: {
                position: 'right',
                beginAtZero: true,
                ticks: { precision: 0 },
                grid: { display: false },
              },
              x: { grid: { display: false } },
            },
          },
        });
      }

      function paintStatusChart(byStatus) {
        const colors = {
          pendiente: th.warn,
          en_proceso: th.info,
          listo: th.ok,
          entregado: th.text2,
          cancelado: th.err,
        };

        const entries = Object.entries(byStatus).filter(([, count]) => count > 0);

        statusChart?.destroy();
        statusChart = new window.Chart(statusCanvas, {
          type: 'doughnut',
          data: {
            labels: entries.map(([status]) => STATUS_LABELS[status] ?? status),
            datasets: [
              {
                data: entries.map(([, count]) => count),
                backgroundColor: entries.map(([status]) => colors[status]),
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface'),
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
          },
        });
      }

      function paintRankings({ files, subjects, institutions }) {
        rankingsBox.innerHTML = `
          <div class="card card--pad">
            <h3 class="card__title">Materias más vendidas</h3>
            ${rankingTable(subjects, 'name', 'Sin ventas en este rango.')}
          </div>
          <div class="card card--pad">
            <h3 class="card__title">Instituciones más vendidas</h3>
            ${rankingTable(institutions, 'name', 'Sin ventas en este rango.')}
          </div>
          <div class="card card--pad">
            <h3 class="card__title">Archivos más vendidos</h3>
            ${rankingTable(files, 'title', 'Sin ventas en este rango.')}
          </div>
        `;
      }

      await load();
    },
  };
}
