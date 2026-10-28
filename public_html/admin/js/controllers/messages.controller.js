import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction } from '../views/modal.view.js';
import { WHATSAPP_ICON, whatsappUrl } from '../views/whatsapp.view.js';
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

// Abre WhatsApp (app o web) con el chat de la persona y un saludo precargado.
function whatsappReplyUrl(message) {
  return whatsappUrl(message.phone, `Hola ${message.name}, te escribimos de PDF Color por tu consulta.`);
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

function phoneCell(message) {
  if (!message.phone) return '';

  const url = whatsappReplyUrl(message);
  const phone = esc(message.phone);

  return url
    ? `<br /><a class="muted" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir en WhatsApp" style="text-decoration:underline" data-reply>${phone}</a>`
    : `<br /><span class="muted">${phone}</span>`;
}

function replyButtons(message) {
  const replyUrl = whatsappReplyUrl(message);

  return `
    <a class="btn btn--sm" href="${esc(gmailReplyUrl(message))}" target="_blank" rel="noopener noreferrer" data-reply>
      ${GMAIL_ICON} Contestar por correo
    </a>
    ${replyUrl ? `
      <a class="btn btn--sm" href="${esc(replyUrl)}" target="_blank" rel="noopener noreferrer" data-reply>
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
