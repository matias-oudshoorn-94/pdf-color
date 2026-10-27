import { esc } from '../lib/dom.js';

const STAR = '★';

/** Estrellas de solo lectura: relleno amarillo proporcional al promedio, sobre fondo gris. */
export function starsDisplay(average, count = 0) {
  const avg = Number(average) || 0;
  const pct = Math.max(0, Math.min(5, avg)) * 20;
  const text = count > 0 ? `${avg.toFixed(1)} (${count})` : '';
  const label =
    count > 0
      ? `${avg.toFixed(1)} de 5 estrellas · ${count} valoración${count === 1 ? '' : 'es'}`
      : 'Todavía sin valoraciones';

  return `
    <span class="card__rating">
      <span class="stars" role="img" aria-label="${esc(label)}">
        <span class="stars__track">${STAR.repeat(5)}</span>
        <span class="stars__fill" style="width:${pct}%">${STAR.repeat(5)}</span>
      </span>
      ${text ? `<span class="stars__count">${esc(text)}</span>` : ''}
    </span>
  `;
}

/**
 * Selector interactivo de 1 a 5 estrellas. Llama a onRate(valor) al hacer clic
 * y guarda automáticamente; si falla, vuelve al valor anterior.
 */
export function mountStarInput(container, { value = 0, onRate } = {}) {
  container.classList.add('star-input');
  container.innerHTML = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button type="button" class="star-input__star" data-value="${n}"
                 aria-label="Puntuar con ${n} estrella${n === 1 ? '' : 's'}">${STAR}</button>`,
    )
    .join('');

  const stars = [...container.querySelectorAll('.star-input__star')];
  let current = value;

  const paint = (upTo) => stars.forEach((star, i) => star.classList.toggle('is-active', i < upTo));

  paint(current);

  container.addEventListener('mouseover', (event) => {
    const star = event.target.closest('[data-value]');
    if (star) paint(Number(star.dataset.value));
  });

  container.addEventListener('mouseleave', () => paint(current));

  container.addEventListener('click', async (event) => {
    const star = event.target.closest('[data-value]');
    if (!star || star.disabled) return;

    const picked = Number(star.dataset.value);

    for (const s of stars) s.disabled = true;

    try {
      await onRate?.(picked);
      current = picked;
    } finally {
      for (const s of stars) s.disabled = false;
      paint(current);
    }
  });

  return {
    setValue(v) {
      current = v;
      paint(current);
    },
  };
}
