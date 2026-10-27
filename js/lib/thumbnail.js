/**
 * Miniatura de la primera página de un PDF.
 * Se intenta primero contra el servidor (/thumb); si no hay, la genera el navegador
 * con PDF.js y la guarda en caché local para no volver a procesar el archivo.
 */

const CACHE_KEY = 'pdfcolor.thumbs';
const CACHE_LIMIT = 60;
const WIDTH = 260;

let pdfjs = null;

async function library() {
  if (pdfjs) return pdfjs;

  pdfjs = await import('/js/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/js/vendor/pdfjs/pdf.worker.min.mjs';

  return pdfjs;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(cache) {
  const entries = Object.entries(cache);

  // Caché acotada: se descartan las miniaturas más viejas.
  if (entries.length > CACHE_LIMIT) {
    entries.sort((a, b) => b[1].at - a[1].at);
    cache = Object.fromEntries(entries.slice(0, CACHE_LIMIT));
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

async function renderPageThumbnail(pdf) {
  const page = await pdf.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: WIDTH / base.width });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  return canvas.toDataURL('image/jpeg', 0.72);
}

async function renderFirstPage(fileId) {
  const { getDocument } = await library();
  const task = getDocument({ url: `/api/files/${fileId}/preview`, withCredentials: true });
  const pdf = await task.promise;
  const dataUrl = await renderPageThumbnail(pdf);

  pdf.destroy();

  return dataUrl;
}

/**
 * Lee un PDF recién elegido en el navegador, todavía sin subir: cantidad de
 * páginas + miniatura. Se usa en el paso 1 de "Subir archivo" para mostrar
 * una previsualización antes de mandar nada al servidor.
 */
export async function inspectLocalFile(file) {
  const { getDocument } = await library();
  const url = URL.createObjectURL(file);

  try {
    const pdf = await getDocument({ url }).promise;
    const pageCount = pdf.numPages;
    const thumbnail = await renderPageThumbnail(pdf);

    pdf.destroy();

    return { pageCount, thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pinta la miniatura dentro del contenedor indicado. */
export async function paintThumbnail(container, file) {
  const image = container.querySelector('img');

  if (!image) return;

  // Limpia el reintento de una pasada anterior antes de repintar.
  container.onclick = null;
  container.dataset.state = 'loading';

  if (file.mime_type?.startsWith('image/')) {
    image.src = `/api/files/${file.id}/preview`;
    container.dataset.state = 'ready';
    return;
  }

  if (file.mime_type !== 'application/pdf') {
    container.dataset.state = 'empty';
    return;
  }

  const cache = readCache();
  const cached = cache[file.id];

  if (cached) {
    image.src = cached.data;
    container.dataset.state = 'ready';
    return;
  }

  // El servidor puede tener la miniatura ya generada (Imagick disponible).
  try {
    const response = await fetch(`/api/files/${file.id}/thumb`, { credentials: 'same-origin' });

    if (response.ok) {
      image.src = `/api/files/${file.id}/thumb`;
      container.dataset.state = 'ready';
      return;
    }
  } catch {
    /* se genera en el navegador */
  }

  // Sin Imagick en el servidor, el render corre en el navegador con PDF.js.
  // La primera vez puede fallar por un hipo de red o porque el visor recién
  // está cargando, así que se reintenta una vez antes de rendirse.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const dataUrl = await renderFirstPage(file.id);

      image.src = dataUrl;
      container.dataset.state = 'ready';

      cache[file.id] = { data: dataUrl, at: Date.now() };
      writeCache(cache);
      return;
    } catch (error) {
      if (error?.name === 'PasswordException') {
        container.dataset.state = 'locked';
        return;
      }

      if (attempt === 0) await sleep(600);
    }
  }

  container.dataset.state = 'failed';
  container.onclick = () => paintThumbnail(container, file);
}

export function forgetThumbnail(fileId) {
  const cache = readCache();

  delete cache[fileId];
  writeCache(cache);
}
