import { AdminApi } from '../models/admin.api.js';
import { dataTable } from '../views/datatable.view.js';
import { confirmAction } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { formatDate } from '/js/lib/format.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

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

export function messagesPage() {
  const table = dataTable({
    searchPlaceholder: 'Buscar mensaje',
    defaultSort: 'created_at',
    emptyTitle: 'Sin mensajes',
    emptyHint: 'Las consultas del formulario de contacto llegan acá.',
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'email', label: 'Contacto' },
      { key: 'mensaje', label: 'Mensaje', sortable: false },
      { key: 'created_at', label: 'Fecha' },
      { key: 'acciones', label: '', sortable: false },
    ],
    fetch: (params) => AdminApi.messages(params),
    deleteOne: (id) => AdminApi.deleteMessage(id),
    renderRow: (message) => `
      <td>${esc(message.name)}</td>
      <td>
        <a href="mailto:${esc(message.email)}" style="text-decoration:underline">${esc(message.email)}</a>
        ${message.phone ? `<br /><a class="muted" href="tel:${esc(message.phone.replace(/\s/g, ''))}">${esc(message.phone)}</a>` : ''}
      </td>
      <td style="max-width:420px;white-space:pre-wrap">${esc(message.body)}</td>
      <td>${formatDate(message.created_at)}</td>
      <td>
        <div class="cell-actions">
          <a class="btn btn--sm" href="${esc(gmailReplyUrl(message))}" target="_blank" rel="noopener noreferrer">Responder</a>
          <button class="btn btn--sm btn--danger" data-action="delete" type="button">Borrar</button>
        </div>
      </td>
    `,
    bindRow: (message, tr, reload) => {
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
