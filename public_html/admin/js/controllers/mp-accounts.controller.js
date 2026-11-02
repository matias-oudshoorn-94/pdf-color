import { AdminApi } from '../models/admin.api.js';
import { confirmAction, openModal } from '../views/modal.view.js';
import { esc } from '/js/lib/dom.js';
import { emptyState } from '/js/views/components.view.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

/**
 * Cuentas de Mercado Pago: cada punto de retiro puede cobrar en la suya (se asigna
 * desde "Puntos de retiro"). La principal cobra los envíos y los puntos sin cuenta.
 */

const tokenField = (required) => `
  <label class="field">
    <span class="field__label">Access token de producción</span>
    <input class="input" name="accessToken" type="password" autocomplete="off" spellcheck="false"
           ${required ? 'required minlength="20"' : ''} maxlength="300"
           placeholder="${required ? 'APP_USR-…' : 'Dejalo vacío para mantener el actual'}" />
    <span class="field__hint">
      Se saca de Mercado Pago → Tus integraciones → tu aplicación → Credenciales de producción.
      Lo verificamos con Mercado Pago antes de guardarlo, y se guarda cifrado.
    </span>
  </label>
`;

const nameField = (account = {}) => `
  <label class="field">
    <span class="field__label">Nombre</span>
    <input class="input" name="name" required minlength="2" maxlength="120"
           placeholder="Ej: Sucursal Ayacucho" value="${esc(account.name ?? '')}" />
    <span class="field__hint">Para reconocerla acá y en los pedidos. No lo ven los clientes.</span>
  </label>
`;

function accountCard(account) {
  const active = Number(account.is_active) === 1;
  const isDefault = Number(account.is_default) === 1;
  const mpLabel = [account.mp_nickname, account.mp_email].filter(Boolean).map(esc).join(' · ');
  const points = account.pickup_points.map((point) => esc(point.name)).join(', ');

  return `
    <article class="card card--pad stack mp-account ${active ? '' : 'mp-account--archived'}" data-account="${account.id}">
      <div class="mp-account__head">
        <h3 class="card__title">${esc(account.name)}</h3>
        <div class="mp-account__badges">
          ${isDefault ? '<span class="badge badge--sales">Principal</span>' : ''}
          ${Number(account.is_test) ? '<span class="badge badge--pendiente">Prueba</span>' : ''}
          ${active ? '' : '<span class="badge">Archivada</span>'}
        </div>
      </div>
      <dl class="mp-account__data">
        <div><dt>Cuenta de Mercado Pago</dt><dd>${mpLabel || '<span class="muted">—</span>'}</dd></div>
        <div><dt>Token</dt><dd><code>••••${esc(account.token_hint)}</code></dd></div>
        <div>
          <dt>Cobra</dt>
          <dd>${
            !active
              ? '<span class="muted">Nada (archivada)</span>'
              : [isDefault ? 'Envíos a domicilio y puntos sin cuenta asignada' : '', points ? `Retiro en: ${points}` : '']
                  .filter(Boolean)
                  .join('<br />') || '<span class="muted">Ningún punto de retiro todavía</span>'
          }</dd>
        </div>
      </dl>
      <div class="cell-actions" style="justify-content:flex-start">
        ${active ? '<button class="btn btn--sm" data-action="edit" type="button">Editar</button>' : ''}
        ${active && !isDefault ? '<button class="btn btn--sm" data-action="default" type="button">Hacer principal</button>' : ''}
        ${
          active
            ? '<button class="btn btn--sm btn--ghost" data-action="archive" type="button">Archivar</button>'
            : '<button class="btn btn--sm" data-action="restore" type="button">Restaurar</button>'
        }
      </div>
    </article>
  `;
}

export function mpAccountsPage() {
  return {
    title: 'Cuentas de Mercado Pago',
    html: '<div id="content"><div class="skeleton" style="height:200px"></div></div>',
    async mount(root) {
      const content = root.querySelector('#content');

      async function load() {
        let accounts;
        let configFallback;

        try {
          ({ accounts, configFallback } = await AdminApi.mpAccounts());
        } catch (error) {
          content.innerHTML = emptyState('No se pudieron cargar las cuentas', error.message);
          return;
        }

        const hasActive = accounts.some((account) => Number(account.is_active) === 1);

        content.innerHTML = `
          <div class="toolbar">
            <p class="muted" style="max-width:720px;margin:0">
              Cada punto de retiro cobra en la cuenta que le asignes en "Puntos de retiro".
              La cuenta <strong>principal</strong> cobra los envíos a domicilio y los puntos sin cuenta asignada.
            </p>
            <span class="toolbar__spacer"></span>
            <button class="btn btn--sm btn--primary" data-action="new" type="button">Agregar cuenta</button>
          </div>
          ${
            hasActive
              ? ''
              : `<p class="card card--pad muted" style="margin-bottom:16px">
                   ${
                     configFallback
                       ? 'Todavía no cargaste cuentas: por ahora se cobra todo en la cuenta configurada en el servidor (config.php).'
                       : 'No hay ninguna cuenta: los pagos con Mercado Pago no van a funcionar hasta que cargues una.'
                   }
                 </p>`
          }
          <div class="grid grid--split">${accounts.map(accountCard).join('')}</div>
        `;

        content.querySelector('[data-action="new"]').addEventListener('click', async () => {
          const created = await openModal({
            title: 'Nueva cuenta de Mercado Pago',
            confirmLabel: 'Verificar y guardar',
            body: `
              ${nameField()}
              ${tokenField(true)}
              <label class="checkbox">
                <input type="checkbox" name="isDefault" ${hasActive ? '' : 'checked disabled'} />
                Cuenta principal (cobra envíos y puntos sin cuenta asignada)
              </label>
            `,
            onSubmit: (data, form) =>
              AdminApi.createMpAccount({
                name: data.name,
                accessToken: data.accessToken.trim(),
                isDefault: form.isDefault.checked,
              }),
          });

          if (created) {
            toastOk('Cuenta verificada y guardada');
            load();
          }
        });

        for (const card of content.querySelectorAll('[data-account]')) {
          const account = accounts.find((item) => String(item.id) === card.dataset.account);

          card.querySelector('[data-action="edit"]')?.addEventListener('click', async () => {
            const saved = await openModal({
              title: `Editar ${esc(account.name)}`,
              body: `${nameField(account)}${tokenField(false)}`,
              onSubmit: (data) =>
                AdminApi.updateMpAccount(account.id, { name: data.name, accessToken: data.accessToken.trim() }),
            });

            if (saved) {
              toastOk('Cuenta actualizada');
              load();
            }
          });

          card.querySelector('[data-action="default"]')?.addEventListener('click', async () => {
            const confirmed = await confirmAction(
              `¿Hacer principal a “${esc(account.name)}”? Desde ahora cobra los envíos a domicilio y los puntos de retiro sin cuenta asignada.`,
              'Hacer principal',
            );
            if (!confirmed) return;

            try {
              await AdminApi.makeDefaultMpAccount(account.id);
              toastOk('Cuenta principal actualizada');
              load();
            } catch (error) {
              toastErr(error.message);
            }
          });

          card.querySelector('[data-action="archive"]')?.addEventListener('click', async () => {
            const points = account.pickup_points.length
              ? ` Los puntos de retiro que la usan (${account.pickup_points.map((p) => esc(p.name)).join(', ')}) pasan a cobrar en la principal.`
              : '';
            const confirmed = await confirmAction(
              `¿Archivar “${esc(account.name)}”? Deja de cobrar pedidos nuevos.${points} Los pagos que ya se hicieron en esta cuenta se siguen registrando.`,
              'Archivar',
            );
            if (!confirmed) return;

            try {
              await AdminApi.archiveMpAccount(account.id);
              toastOk('Cuenta archivada');
              load();
            } catch (error) {
              toastErr(error.message);
            }
          });

          card.querySelector('[data-action="restore"]')?.addEventListener('click', async () => {
            try {
              await AdminApi.restoreMpAccount(account.id);
              toastOk('Cuenta restaurada');
              load();
            } catch (error) {
              toastErr(error.message);
            }
          });
        }
      }

      await load();
    },
  };
}
