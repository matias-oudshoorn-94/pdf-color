import { TaxonomyModel } from '../models/resources.js';
import { esc } from '../lib/dom.js';

/**
 * Puntos de retiro: lista + mapa de Google (sin clave). Al tocar un punto, el mapa
 * se mueve a esa dirección. Lo usan "Quiénes somos" y "Contacto".
 */

// Las direcciones de los puntos de retiro suelen cargarse sin la ciudad ("Rejón 5450"):
// se la agrega para que Google Maps no la busque en otra ciudad.
const mapQuery = (address) => (/mar del plata/i.test(address) ? address : `${address}, Mar del Plata`);
const mapEmbedUrl = (address) => `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(address))}&z=15&output=embed`;
const mapLinkUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(address))}`;

/** Pinta la sección dentro de `box`. Si no hay puntos activos, la deja vacía. */
export async function mountPickupMap(box) {
  let points = [];

  try {
    ({ pickupPoints: points } = await TaxonomyModel.pickupPoints());
  } catch {
    points = [];
  }

  // Sin puntos de retiro cargados no se muestra la sección.
  if (points.length === 0) return;

  let selected = points[0];

  box.innerHTML = `
    <section class="pickup-map stack">
      <div>
        <h2>Puntos de retiro</h2>
        <p class="muted">Elegí un punto para verlo en el mapa.</p>
      </div>
      <div class="pickup-map__layout">
        <div class="pickup-grid pickup-map__list">
          ${points
            .map(
              (point) => `
                <button type="button" class="pickup-card" data-point="${point.id}">
                  <span class="pickup-card__name">${esc(point.name)}</span>
                  <span class="pickup-card__address">${esc(point.address)}</span>
                  ${point.notes ? `<span class="pickup-card__notes">${esc(point.notes)}</span>` : ''}
                </button>`,
            )
            .join('')}
        </div>
        <div class="stack pickup-map__map">
          <div class="map-embed">
            <iframe title="Mapa del punto de retiro" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
          <a class="pickup-map__directions" target="_blank" rel="noopener noreferrer">Abrir en Google Maps →</a>
        </div>
      </div>
    </section>
  `;

  const iframe = box.querySelector('iframe');
  const directions = box.querySelector('.pickup-map__directions');

  function show(point) {
    selected = point;
    iframe.src = mapEmbedUrl(point.address);
    iframe.title = `Mapa de ${point.name}`;
    directions.href = mapLinkUrl(point.address);

    for (const card of box.querySelectorAll('[data-point]')) {
      const isSelected = card.dataset.point === String(point.id);
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    }
  }

  for (const card of box.querySelectorAll('[data-point]')) {
    card.addEventListener('click', () => {
      const point = points.find((item) => String(item.id) === card.dataset.point);
      if (point && point !== selected) show(point);
    });
  }

  show(selected);
}
