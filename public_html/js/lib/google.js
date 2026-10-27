import { api } from '../models/api.js';

/**
 * Servicios de Google que dependen de claves de la config del backend
 * (google.client_id y google.maps_api_key): botón "Continuar con Google" y
 * autocompletado de direcciones. Sin la clave correspondiente, cada función no
 * hace nada y el sitio sigue andando igual que antes.
 */

// Centro de Mar del Plata: las sugerencias cercanas aparecen primero.
const ADDRESS_BIAS = { center: { lat: -38.0055, lng: -57.5426 }, radius: 30000 };

let configPromise = null;
const scripts = new Map();

function config() {
  configPromise ??= api
    .get('/settings')
    .then((data) => data.google ?? {})
    .catch(() => ({}));

  return configPromise;
}

function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject(new Error(`No se pudo cargar ${src}`)));
        document.head.append(script);
      }),
    );
  }

  return scripts.get(src);
}

/**
 * Pinta el botón oficial de Google dentro de `container` y llama a
 * `onCredential(idToken)` cuando la persona elige su cuenta. Devuelve false si
 * no está configurado o no se pudo cargar (el contenedor queda vacío).
 */
export async function renderGoogleButton(container, onCredential) {
  const { clientId } = await config();

  if (!clientId) return false;

  try {
    await loadScript('https://accounts.google.com/gsi/client');
  } catch {
    return false;
  }

  if (!container.isConnected) return false;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: ({ credential }) => onCredential(credential),
  });

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    locale: 'es',
    width: Math.max(200, Math.min(400, Math.floor(container.offsetWidth))),
  });

  return true;
}

let placesPromise = null;

function loadPlaces(apiKey) {
  placesPromise ??= new Promise((resolve, reject) => {
    window.__pdfcolorMapsReady = () => window.google.maps.importLibrary('places').then(resolve, reject);

    loadScript(
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&language=es&region=AR&callback=__pdfcolorMapsReady`,
    ).catch(reject);
  });

  return placesPromise;
}

/**
 * Sugerencias de direcciones de Google mientras se escribe en `input` (un
 * <input> o <textarea>), mostradas en `list`. Al elegir una, completa el campo
 * y llama a `onPick(direccion)`. Si falla o no hay clave, el campo queda como
 * un campo de texto común.
 */
export async function attachAddressAutocomplete(input, list, onPick) {
  const { mapsApiKey } = await config();

  if (!mapsApiKey || !input.isConnected) return;

  let places;

  try {
    places = await loadPlaces(mapsApiKey);
  } catch {
    return;
  }

  let sessionToken = new places.AutocompleteSessionToken();
  let timer = null;
  let requestId = 0;
  let options = [];
  let active = -1;

  const close = () => {
    requestId++;
    options = [];
    active = -1;
    list.hidden = true;
    list.replaceChildren();
  };

  const pick = (text) => {
    input.value = text;
    close();
    // Cada búsqueda terminada cierra su sesión de facturación de Google.
    sessionToken = new places.AutocompleteSessionToken();
    onPick(text);
    input.focus();
  };

  const paintActive = () => {
    [...list.querySelectorAll('[role="option"]')].forEach((node, index) => {
      node.classList.toggle('is-active', index === active);
    });
  };

  const show = (suggestions) => {
    options = suggestions
      .map((suggestion) => suggestion.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        main: prediction.mainText?.text ?? prediction.text.text,
        secondary: prediction.secondaryText?.text ?? '',
        // Todo el sitio opera en Argentina: el país al final es ruido.
        full: prediction.text.text.replace(/, Argentina$/, ''),
      }));
    active = -1;
    list.replaceChildren();

    if (options.length === 0) {
      list.hidden = true;
      return;
    }

    for (const option of options) {
      const node = document.createElement('div');
      node.className = 'searchable-select__option';
      node.setAttribute('role', 'option');

      const main = document.createElement('strong');
      main.textContent = option.main;
      node.append(main);

      if (option.secondary) {
        const secondary = document.createElement('span');
        secondary.className = 'muted';
        secondary.textContent = ` ${option.secondary.replace(/, Argentina$/, '')}`;
        node.append(secondary);
      }

      // mousedown y no click: el click llega después del blur, que ya cerró la lista.
      node.addEventListener('mousedown', (event) => {
        event.preventDefault();
        pick(option.full);
      });
      list.append(node);
    }

    // Atribución que Google exige al mostrar sus sugerencias fuera de un mapa.
    const attribution = document.createElement('div');
    attribution.className = 'address-suggest__attribution';
    attribution.textContent = 'Sugerencias de Google';
    list.append(attribution);

    list.hidden = false;
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);

    const text = input.value.trim();

    if (text.length < 4) {
      close();
      return;
    }

    timer = setTimeout(async () => {
      const mine = ++requestId;

      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken,
          language: 'es',
          region: 'ar',
          includedRegionCodes: ['ar'],
          includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'],
          locationBias: ADDRESS_BIAS,
        });

        if (mine === requestId && input.isConnected) show(suggestions);
      } catch (error) {
        console.warn('[direcciones]', error);
        if (mine === requestId) close();
      }
    }, 250);
  });

  input.addEventListener('keydown', (event) => {
    if (list.hidden || options.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + options.length) % options.length;
      paintActive();
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      pick(options[active].full);
    } else if (event.key === 'Escape') {
      close();
    }
  });

  input.addEventListener('blur', () => {
    clearTimeout(timer);
    close();
  });
}
