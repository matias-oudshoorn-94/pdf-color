const dateFmt = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
const moneyFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

export const formatDate = (value) => (value ? dateFmt.format(new Date(value)) : '—');

export const formatMoney = (value) => moneyFmt.format(Number(value) || 0);

/** Separa el monto formateado en parte entera (con símbolo) y decimales, para estilizarlos distinto. */
export function splitMoney(value) {
  const formatted = formatMoney(value);
  const match = formatted.match(/^(.*),(\d{2})$/);

  return match ? { main: match[1], decimals: match[2] } : { main: formatted, decimals: '' };
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  listo: 'Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export function fileKind(mime = '') {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Imagen';
  if (mime.includes('word')) return 'Word';
  return 'Archivo';
}

/** Corta un texto largo (ej: nombres de archivo) y agrega "…" si se pasó del máximo. */
export function truncate(text, max = 60) {
  const str = String(text ?? '');
  return str.length > max ? `${str.slice(0, max).trimEnd()}…` : str;
}
