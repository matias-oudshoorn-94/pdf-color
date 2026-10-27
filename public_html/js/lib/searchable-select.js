import { esc } from './dom.js';

/** Sin tildes/diacríticos y en minúsculas, para que buscar "tecnica" encuentre "Técnica". */
const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Combobox con búsqueda para listas largas (ej: instituciones) donde un
 * <select> nativo obliga a scrollear a ciegas. Expone una interfaz mínima
 * compatible (value, disabled, setOptions, addEventListener('change', fn))
 * para poder usarse igual que un <select> desde el código que lo llama.
 */
export function searchableSelect(host, { placeholder = 'Buscar…', emptyLabel = 'Sin indicar', createLabel = null, onCreate = null } = {}) {
  host.classList.add('searchable-select');
  host.innerHTML = `
    <input class="input searchable-select__input" type="text" autocomplete="off"
           placeholder="${esc(placeholder)}" disabled />
    <div class="searchable-select__list" role="listbox" hidden></div>
  `;

  const input = host.querySelector('.searchable-select__input');
  const list = host.querySelector('.searchable-select__list');

  let options = [{ value: '', label: emptyLabel }];
  let value = '';
  let filtered = options;
  let activeIndex = -1;
  const listeners = new Set();

  const selectedLabel = () => options.find((o) => o.value === value)?.label ?? '';
  // Vacío cuando no hay selección: así el placeholder queda visible y no hay
  // texto previo que se mezcle con lo que el usuario empieza a tipear.
  const displayText = () => (value === '' ? '' : selectedLabel());

  function highlight() {
    for (const el of list.children) el.classList.remove('is-active');
    const el = list.children[activeIndex];
    if (el) {
      el.classList.add('is-active');
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function open(filterText) {
    if (input.disabled) return;

    // Cada palabra escrita tiene que estar en la etiqueta, en cualquier orden:
    // "secundaria martin" y "martin secundaria" encuentran lo mismo.
    const words = normalize(filterText.trim()).split(/\s+/).filter(Boolean);
    filtered = options.filter((o) => {
      if (o.value === '') return true;
      const haystack = normalize(o.label);
      return words.every((word) => haystack.includes(word));
    });
    activeIndex = -1;

    list.innerHTML = filtered
      .map(
        (o) =>
          `<div class="searchable-select__option" data-value="${esc(o.value)}" role="option"
                ${o.value === value ? 'aria-selected="true"' : ''}>${esc(o.label)}</div>`,
      )
      .join('');

    // Última fila fija: "¿No está? Cargala" con lo que ya escribió el usuario.
    if (onCreate) {
      const typed = filterText.trim();
      list.insertAdjacentHTML(
        'beforeend',
        `<button type="button" class="searchable-select__create" data-create>
           ${typed ? `+ No está en la lista: cargar “${esc(typed)}”` : `+ ${esc(createLabel ?? 'No está en la lista: cargala')}`}
         </button>`,
      );
    }

    list.hidden = list.children.length === 0;
  }

  function close() {
    list.hidden = true;
    activeIndex = -1;
  }

  function commit(newValue) {
    value = newValue;
    input.value = displayText();
    close();
    for (const fn of listeners) fn();
  }

  input.addEventListener('focus', () => {
    open('');
    input.select();
  });
  input.addEventListener('input', () => open(input.value));

  input.addEventListener('keydown', (event) => {
    if (list.hidden && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      open('');
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      highlight();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlight();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex] ?? filtered[0];
      if (option) commit(option.value);
    } else if (event.key === 'Escape') {
      input.value = displayText();
      close();
    }
  });

  list.addEventListener('mousedown', (event) => {
    if (event.target.closest('[data-create]')) {
      event.preventDefault();
      const typed = input.value.trim() === displayText() ? '' : input.value.trim();
      input.value = displayText();
      close();
      input.blur();
      onCreate(typed);
      return;
    }

    const option = event.target.closest('[data-value]');
    if (!option) return;
    event.preventDefault();
    commit(option.dataset.value);
  });

  input.addEventListener('blur', () => {
    // Espera a que el mousedown del listado se procese antes de cerrar.
    setTimeout(() => {
      input.value = displayText();
      close();
    }, 120);
  });

  return {
    get value() {
      return value;
    },
    set value(v) {
      const str = String(v ?? '');
      value = options.some((o) => o.value === str) ? str : '';
      input.value = displayText();
    },
    get disabled() {
      return input.disabled;
    },
    /** Compatibilidad con el <select> nativo: select.selectedOptions[0].textContent. */
    get selectedOptions() {
      return value === '' ? [] : [{ textContent: selectedLabel() }];
    },
    set disabled(v) {
      input.disabled = v;
      if (v) {
        value = '';
        input.value = '';
        close();
      }
    },
    /** Reemplaza las opciones disponibles, igual que rearmar un <select>. */
    setOptions(items, toLabel, toValue = (item) => String(item.id)) {
      options = [{ value: '', label: emptyLabel }, ...items.map((item) => ({ value: toValue(item), label: toLabel(item) }))];
      value = options.some((o) => o.value === value) ? value : '';
      input.value = displayText();
      // Con alta habilitada, una lista vacía igual se puede usar para cargar la primera opción.
      input.disabled = items.length === 0 && !onCreate;
      close();
    },
    /** Selecciona una opción por código, avisando a los listeners igual que si la eligiera el usuario. */
    select(newValue) {
      commit(options.some((o) => o.value === String(newValue)) ? String(newValue) : '');
    },
    addEventListener(type, fn) {
      if (type === 'change') listeners.add(fn);
    },
  };
}
