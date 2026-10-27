const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const readCookie = (name) =>
  document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1] ?? '';

async function request(method, path, { body, headers = {}, query } = {}) {
  const url = new URL(BASE + path, window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }

  const isForm = body instanceof FormData;
  const finalHeaders = { ...headers };

  if (!isForm && body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  // Token CSRF de doble envío: el backend lo compara con el de la sesión.
  if (method !== 'GET') finalHeaders['X-CSRF-Token'] = decodeURIComponent(readCookie('XSRF-TOKEN'));

  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: finalHeaders,
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new ApiError(res.status, data.error ?? 'No se pudo completar la operación', data.details);

  return data;
}

/** POST con seguimiento de progreso de subida (fetch no lo expone; hace falta XHR). */
function uploadRequest(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', new URL(BASE + path, window.location.origin));
    xhr.setRequestHeader('X-CSRF-Token', decodeURIComponent(readCookie('XSRF-TOKEN')));

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total, ratio: event.loaded / event.total });
    });

    xhr.addEventListener('load', () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* respuesta vacía o no-JSON */
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new ApiError(xhr.status, data.error ?? 'No se pudo completar la operación', data.details));
      }
    });

    xhr.addEventListener('error', () => reject(new ApiError(0, 'No se pudo conectar con el servidor')));

    xhr.send(formData);
  });
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
  upload: (path, formData, onProgress) => uploadRequest(path, formData, onProgress),
};
