import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { formatDate } from '/js/lib/format.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

export const MESSAGE_STATUS_LABELS = {
  no_leido: 'No leído',
  leido: 'Leído',
  respondido: 'Respondido',
};

// Abre la ventana de redactar de Gmail (en vez del programa de correo de la compu),
// con el destinatario, el asunto y el mensaje original citado.
function gmailReplyUrl(message) {
  const quoted = message.body.split('\n').map((line) => `> ${line}`).join('\n');
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: message.email,
    su: 'Re: Tu consulta en PDF Color',
    body: `Hola ${message.name},\n\n\n\n${quoted}`,
  });

  return `https://mail.google.com/mail/?${params}`;
}

// Pasa el teléfono que escribió la persona al formato que pide WhatsApp para
// Argentina: 549 + característica + número, sin el 0 ni el 15.
// Ej.: "0223 15 565-5434" → "5492235655434".
function whatsappNumber(phone) {
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

// Abre WhatsApp (app o web) con el chat de la persona y un saludo precargado.
function whatsappReplyUrl(message) {
  const number = whatsappNumber(message.phone);
  if (!number) return '';

  const text = `Hola ${message.name}, te escribimos de PDF Color por tu consulta.`;

  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

const GMAIL_ICON = `
  <svg viewBox="52 42 88 66" width="18" height="14" aria-hidden="true">
    <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
    <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
    <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
    <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
    <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
  </svg>
`;

const WHATSAPP_ICON = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="#25d366" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 0 1 7 12.4l-.3.5.6 2.1-2.2-.6-.5.3A8.2 8.2 0 1 1 12 3.8Zm4.4 10.7c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1s-.5.7-.7.8c-.1.1-.3.2-.5.1a6.6 6.6 0 0 1-2-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4a.5.5 0 0 0 0-.5c-.1-.1-.5-1.2-.7-1.7-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c.6.2 1 .4 1.4.5.6.2 1.1.1 1.5.1a2.5 2.5 0 0 0 1.6-1.1 1.9 1.9 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3Z" />
  </svg>
`;

function phoneCell(message) {
  if (!message.phone) return '';

  const url = whatsappReplyUrl(message);
  const phone = esc(message.phone);

  return url
    ? `<br /><a class="muted" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir en WhatsApp" style="text-decoration:underline" data-reply>${phone}</a>`
    : `<br /><span class="muted">${phone}</span>`;
}

function replyButtons(message) {
  const whatsappUrl = whatsappReplyUrl(message);

  return `
    <a class="btn btn--sm" href="${esc(gmailReplyUrl(message))}" target="_blank" rel="noopener noreferrer" data-reply>
      ${GMAIL_ICON} Contestar por correo
    </a>
    ${whatsappUrl ? `
      <a class="btn btn--sm" href="${esc(whatsappUrl)}" target="_blank" rel="noopener noreferrer" data-reply>
        ${WHATSAPP_ICON} Contestar por WhatsApp
      </a>` : ''}
  `;
}

function statusSelect(message) {
  return `
    <select class="select select--sm message-status message-status--${esc(message.status)}" data-status aria-label="Estado del mensaje">
      ${Object.entries(MESSAGE_STATUS_LABELS)
        .map(([value, label]) => `<option value="${value}" ${value === message.status ? 'selected' : ''}>${label}</option>`)
        .join('')}
    </select>
  `;
}

export function messagesPage() {
  // Desde el resumen se llega con ?estado=no_leido para ver solo esos.
  const initialStatus = new URLSearchParams(location.search).get('estado') ?? '';

  const table = dataTable({
    searchPlaceholder: 'Buscar mensaje',
    defaultSort: 'created_at',
    emptyTitle: 'Sin mensajes',
    emptyHint: 'Las consultas del formulario de contacto llegan acá.',
    filters: [
      {
        id: 'message-status-filter',
        name: 'status',
        html: `<select class="select" id="message-status-filter">
                 <option value="">Todos los estados</option>
                 ${Object.entries(MESSAGE_STATUS_LABELS)
                   .map(([v, l]) => `<option value="${v}" ${v === initialStatus ? 'selected' : ''}>${l}</option>`)
                   .join('')}
               </select>`,
      },
    ],
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'email', label: 'Contacto' },
      { key: 'mensaje', label: 'Mensaje', sortable: false },
      { key: 'status', label: 'Estado' },
      { key: 'created_at', label: 'Fecha' },
      { key: 'acciones', label: '', sortable: false },
    ],
    fetch: (params) => AdminApi.messages(params),
    deleteOne: (id) => AdminApi.deleteMessage(id),
    renderRow: (message) => `
      <td>${esc(message.name)}</td>
      <td>
        <a href="mailto:${esc(message.email)}" style="text-decoration:underline">${esc(message.email)}</a>
        ${phoneCell(message)}
      </td>
      <td style="max-width:420px;white-space:pre-wrap">${esc(message.body)}</td>
      <td>${statusSelect(message)}</td>
      <td>${formatDate(message.created_at)}</td>
      <td>
        <div class="cell-actions">
          ${replyButtons(message)}
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (message, tr, reload) => {
      tr.classList.toggle('row--unread', message.status === 'no_leido');

      const setStatus = async (status, { quiet = false } = {}) => {
        try {
          await AdminApi.updateMessageStatus(message.id, status);
          if (!quiet) toastOk(`Mensaje marcado como ${MESSAGE_STATUS_LABELS[status].toLowerCase()}`);
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      };

      tr.querySelector('[data-status]').addEventListener('change', (event) => setStatus(event.target.value));

      // Contestar por correo o WhatsApp lo marca como respondido. El link se abre igual.
      for (const link of tr.querySelectorAll('[data-reply]')) {
        link.addEventListener('click', () => {
          if (message.status !== 'respondido') setStatus('respondido', { quiet: true });
        });
      }

      tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!(await confirmAction('¿Borrar este mensaje?'))) return;

        try {
          await AdminApi.deleteMessage(message.id);
          toastOk('Mensaje eliminado');
          reload();
        } catch (error) {
          toastErr(error.message);
        }
      });
    },
  });

  return { title: 'Mensajes', html: table.html, mount: table.mount };
}
