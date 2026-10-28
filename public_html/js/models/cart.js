import { session } from './session.js';

/** Carrito de impresión en memoria + localStorage. */
const KEY = 'pdfcolor.cart';

// Desde esta cantidad de hojas el archivo se agrega anillado; con menos, suelto.
// El cliente lo puede cambiar después en el pedido.
const RING_FROM_PAGES = 40;
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

let items = read();

function persist() {
  localStorage.setItem(KEY, JSON.stringify(items));
  for (const fn of listeners) fn(items);
}

export const cart = {
  get items() {
    return items;
  },

  get count() {
    return items.length;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  has(fileId) {
    return items.some((i) => i.fileId === fileId);
  },

  add(file) {
    if (this.has(file.id)) return false;
    const pageCount = file.page_count ?? 1;

    items = [
      ...items,
      {
        fileId: file.id,
        title: file.title,
        mimeType: file.mime_type,
        pageCount,
        copies: 1,
        paperSize: 'A4',
        doubleSide: true,
        finish: pageCount >= RING_FROM_PAGES ? 'anillado' : 'simple',
      },
    ];
    persist();
    return true;
  },

  update(fileId, patch) {
    items = items.map((i) => (i.fileId === fileId ? { ...i, ...patch } : i));
    persist();
  },

  remove(fileId) {
    items = items.filter((i) => i.fileId !== fileId);
    persist();
  },

  clear() {
    items = [];
    persist();
  },
};

// El carrito se arma sin cuenta: solo se vacía al cerrar sesión, no cuando un
// visitante abre el sitio sin haber ingresado.
let previousUser = null;

session.subscribe((user) => {
  if (previousUser && !user) cart.clear();
  previousUser = user;
});
