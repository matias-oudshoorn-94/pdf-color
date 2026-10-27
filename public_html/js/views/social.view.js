/** Iconos de redes sociales, en SVG inline. */

export const SOCIALS = [
  { name: 'Instagram', href: 'https://www.instagram.com/pdfcolorimprenta/' },
  { name: 'Facebook', href: 'https://www.facebook.com/PDFCOLORIMPRESOS/' },
];

const ICONS = {
  Instagram: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  `,
  Facebook: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H6v3.5h2V21h3.5v-7.5h3l.5-3.5h-3.5V7.5c0-.83.67-1.5 1.5-1.5H15V3Z" />
    </svg>
  `,
  WhatsApp: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 0 1 7 12.4l-.3.5.6 2.1-2.2-.6-.5.3A8.2 8.2 0 1 1 12 3.8Zm4.4 10.7c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1s-.5.7-.7.8c-.1.1-.3.2-.5.1a6.6 6.6 0 0 1-2-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4a.5.5 0 0 0 0-.5c-.1-.1-.5-1.2-.7-1.7-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c.6.2 1 .4 1.4.5.6.2 1.1.1 1.5.1a2.5 2.5 0 0 0 1.6-1.1 1.9 1.9 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  `,
};

export function socialLinks({ className = 'social' } = {}) {
  return SOCIALS.map(
    (s) => `
      <a class="${className}" href="${s.href}" target="_blank" rel="noopener noreferrer" aria-label="${s.name}" title="${s.name}">
        ${ICONS[s.name]}
      </a>`,
  ).join('');
}

/** Link a WhatsApp con mensaje precargado. Devuelve '' si no hay número configurado. */
export function whatsappLink(number, { className = 'social social--whatsapp' } = {}) {
  if (!number) return '';

  const href = `https://wa.me/${number}?text=${encodeURIComponent('Hola! Quería consultar por una impresión.')}`;

  return `
    <a class="${className}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="Escribinos por WhatsApp">
      ${ICONS.WhatsApp}
    </a>`;
}
