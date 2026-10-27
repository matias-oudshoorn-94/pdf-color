import { esc } from './dom.js';
import { searchableSelect } from './searchable-select.js';
import { getRecaptchaToken } from './recaptcha.js';
import { toastErr, toastOk } from './toast.js';
import { TaxonomyModel } from '../models/resources.js';

/**
 * "¿No encontrás tu materia? Cargala": enlace + panel en línea para que el usuario
 * agregue una institución, carrera o materia que no está en la lista, sin salir
 * del paso en el que está.
 *
 * Para no duplicar, mientras escribe le muestra las opciones parecidas ya cargadas
 * ("¿Es alguna de estas?") y el servidor vuelve a controlarlo al guardar: si ya
 * existe con otra escritura la reutiliza, y si hay parecidas pide confirmar que es
 * distinta antes de crearla.
 *
 * - type: 'institution' | 'career' | 'subject'
 * - noun: "la materia", "la carrera"…  (se usa en los textos)
 * - locations: solo para instituciones, para elegir la localidad
 * - label(item): cómo mostrar una opción existente
 * - onSelect(item, { created }): la opción elegida o recién creada
 */
export function quickCreate(host, { type, noun, placeholder = '', maxLength = 120, locations = null, label, onSelect }) {
  const withLocation = Array.isArray(locations);

  host.classList.add('quick-create');
  host.innerHTML = `
    <p class="quick-create__prompt">
      ¿No encontrás ${esc(noun)}?
      <button type="button" class="quick-create__link" data-open>Cargala</button>
    </p>
    <div class="quick-create__panel" hidden>
      <p class="quick-create__title">Cargar ${esc(noun)}</p>
      ${withLocation ? '<div class="field"><span class="field__label">Localidad</span><div data-location></div></div>' : ''}
      <label class="field">
        <span class="field__label">Nombre</span>
        <input class="input" data-name maxlength="${maxLength}" autocomplete="off" placeholder="${esc(placeholder)}" />
        <span class="field__hint">Escribilo completo y sin abreviar, así otros lo encuentran.</span>
      </label>
      <div class="quick-create__similar" hidden>
        <p class="quick-create__similar-title"></p>
        <div class="quick-create__chips"></div>
      </div>
      <p class="field__error" data-error hidden></p>
      <div class="quick-create__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-cancel>Cancelar</button>
        <button type="button" class="btn btn--primary btn--sm" data-save>Cargar y seleccionar</button>
      </div>
    </div>
  `;

  const prompt = host.querySelector('.quick-create__prompt');
  const panel = host.querySelector('.quick-create__panel');
  const nameInput = host.querySelector('[data-name]');
  const similarBox = host.querySelector('.quick-create__similar');
  const similarTitle = host.querySelector('.quick-create__similar-title');
  const chips = host.querySelector('.quick-create__chips');
  const errorEl = host.querySelector('[data-error]');
  const saveButton = host.querySelector('[data-save]');

  const location = withLocation
    ? searchableSelect(host.querySelector('[data-location]'), { placeholder: 'Escribí la localidad…' })
    : null;
  location?.setOptions(locations, (l) => l.name);

  // Parecidos que ya vio el usuario para el nombre actual: si igual guarda, confirmó que es distinta.
  let shownSimilar = [];
  let shownFor = '';
  let lookupTimer = null;
  let lookupSeq = 0;

  const currentKey = () => `${location?.value ?? ''}|${nameInput.value.trim().toLowerCase()}`;

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function renderSimilar(items, title) {
    shownSimilar = items;
    shownFor = items.length ? currentKey() : '';
    similarBox.hidden = items.length === 0;
    similarTitle.textContent = title;
    chips.innerHTML = items
      .map(
        (item, i) => `
          <button type="button" class="quick-create__chip" data-pick="${i}">
            ${esc(label(item))}${item.exact ? ' <span class="quick-create__tag">Ya existe</span>' : ''}
          </button>`,
      )
      .join('');
    updateSaveLabel();
  }

  function updateSaveLabel() {
    const confirming = shownSimilar.length > 0 && shownFor === currentKey() && !shownSimilar.some((s) => s.exact);
    saveButton.textContent = confirming ? 'No es ninguna, cargarla igual' : 'Cargar y seleccionar';
  }

  async function lookup() {
    const name = nameInput.value.trim();
    const seq = ++lookupSeq;

    if (name.length < 2 || (withLocation && !location.value)) {
      renderSimilar([], '');
      return;
    }

    try {
      const { similar } = await TaxonomyModel.similar(type, name, location?.value ?? '');
      if (seq !== lookupSeq) return; // llegó tarde: el usuario siguió escribiendo
      renderSimilar(similar, similar.some((s) => s.exact) ? 'Ya está cargada, tocala para elegirla:' : '¿Es alguna de estas? Tocala para elegirla:');
    } catch {
      /* la sugerencia es una ayuda: si falla, el servidor igual controla al guardar */
    }
  }

  function scheduleLookup() {
    showError('');
    updateSaveLabel();
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(lookup, 300);
  }

  function open(text = '') {
    prompt.hidden = true;
    panel.hidden = false;
    nameInput.value = text;
    showError('');
    renderSimilar([], '');
    (withLocation && !location.value ? host.querySelector('[data-location] input') : nameInput).focus();
    if (text) lookup();
  }

  function close() {
    clearTimeout(lookupTimer);
    lookupSeq++;
    panel.hidden = true;
    prompt.hidden = false;
  }

  function finish(item, created) {
    close();
    onSelect(item, { created });
  }

  async function save() {
    const name = nameInput.value.trim();

    if (withLocation && !location.value) {
      showError('Elegí la localidad');
      return;
    }

    if (name.length < 2) {
      showError('Escribí el nombre');
      nameInput.focus();
      return;
    }

    const force = shownSimilar.length > 0 && shownFor === currentKey();

    saveButton.disabled = true;
    showError('');

    try {
      const response = await TaxonomyModel.create(type, {
        name,
        locationId: location?.value || undefined,
        force,
        recaptchaToken: await getRecaptchaToken('taxonomy_create'),
      });
      const item = response[type];

      toastOk(response.created ? `Listo, la cargamos y quedó seleccionada` : `Ya estaba cargada: la seleccionamos`);
      finish(item, response.created);
    } catch (error) {
      if (error.status === 409 && error.details?.similar?.length) {
        renderSimilar(error.details.similar, 'Encontramos parecidas. ¿Es alguna de estas?');
      } else {
        showError(error.message);
        toastErr(error.message);
      }
    } finally {
      saveButton.disabled = false;
    }
  }

  host.querySelector('[data-open]').addEventListener('click', () => open());
  host.querySelector('[data-cancel]').addEventListener('click', close);
  saveButton.addEventListener('click', save);
  nameInput.addEventListener('input', scheduleLookup);
  location?.addEventListener('change', scheduleLookup);

  // Enter guarda el alta en vez de mandar el formulario de subida que lo contiene.
  nameInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    save();
  });

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-pick]');
    if (!chip) return;
    toastOk('Seleccionada');
    finish(shownSimilar[Number(chip.dataset.pick)], false);
  });

  return { open, close };
}
