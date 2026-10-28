/** WhatsApp en el panel: número en formato internacional, link al chat y logo. */

// Pasa el teléfono que escribió la persona al formato que pide WhatsApp para
// Argentina: 549 + característica + número, sin el 0 ni el 15.
// Ej.: "0223 15 565-5434" → "5492235655434".
export function whatsappNumber(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('54')) {
    digits = digits.slice(2);
    if (digits.startsWith('9')) digits = digits.slice(1);
  }

  if (digits.startsWith('0')) digits = digits.slice(1);

  // Con el 15 quedan 12 dígitos: se saca el "15" que sigue a la característica (2 a 4 dígitos).
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === '15') {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }

  return digits.length === 10 ? `549${digits}` : '';
}

/**
 * Link que abre WhatsApp (app o web) con el chat de ese teléfono y, si se pasa,
 * un mensaje precargado. Devuelve '' si el número no se puede interpretar.
 */
export function whatsappUrl(phone, text = '') {
  const number = whatsappNumber(phone);
  if (!number) return '';

  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const WHATSAPP_ICON = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="#25d366" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 0 1 7 12.4l-.3.5.6 2.1-2.2-.6-.5.3A8.2 8.2 0 1 1 12 3.8Zm4.4 10.7c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1s-.5.7-.7.8c-.1.1-.3.2-.5.1a6.6 6.6 0 0 1-2-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4a.5.5 0 0 0 0-.5c-.1-.1-.5-1.2-.7-1.7-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c.6.2 1 .4 1.4.5.6.2 1.1.1 1.5.1a2.5 2.5 0 0 0 1.6-1.1 1.9 1.9 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3Z" />
  </svg>
`;
