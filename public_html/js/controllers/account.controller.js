import { session } from '../models/session.js';
import { OrdersModel } from '../models/resources.js';
import { esc } from '../lib/dom.js';
import { formatDate, STATUS_LABELS } from '../lib/format.js';
import { toastErr, toastOk } from '../lib/toast.js';

export function accountPage() {
  const user = session.user ?? {};

  return {
    html: `
      <section class="page">
        <header class="page__head">
          <div>
            <h2>Mi cuenta</h2>
            <p>Actualizá tus datos de contacto y tu contraseña.</p>
          </div>
        </header>

        <div class="grid grid--split">
          <form class="card card--pad form" id="profile-form" novalidate>
            <h3 class="card__title">Mis datos</h3>

            <label class="field">
              <span class="field__label">Nombre y apellido</span>
              <input class="input" name="name" required minlength="2" maxlength="120" value="${esc(user.name ?? '')}" />
            </label>
            <label class="field">
              <span class="field__label">Email</span>
              <input class="input" name="email" type="email" required value="${esc(user.email ?? '')}" />
            </label>
            <label class="field">
              <span class="field__label">Teléfono</span>
              <input class="input" name="phone" maxlength="40" value="${esc(user.phone ?? '')}" />
            </label>

            <hr style="border:0;border-top:1px solid var(--line);margin:6px 0" />

            <label class="field">
              <span class="field__label">Nueva contraseña</span>
              <input class="input" name="password" type="password" minlength="8" autocomplete="new-password" />
              <span class="field__hint">Dejala vacía si no querés cambiarla.</span>
            </label>
            <label class="field">
              <span class="field__label">Contraseña actual</span>
              <input class="input" name="currentPassword" type="password" autocomplete="current-password" />
              <span class="field__hint">Solo hace falta para cambiar el email o la contraseña.</span>
            </label>

            <p class="field__error" id="profile-error" hidden></p>
            <button class="btn btn--primary btn--block" type="submit">Guardar cambios</button>
          </form>

          <div class="stack">
            <article class="card card--pad stack">
              <h3 class="card__title">Últimos pedidos</h3>
              <div id="recent-orders"><div class="skeleton" style="height:90px"></div></div>
              <a class="btn btn--ghost" href="/pedidos" data-link>Ver todos mis pedidos</a>
            </article>

            <article class="card card--pad stack">
              <h3 class="card__title">Atajos</h3>
              <div class="row">
                <a class="btn btn--sm" href="/subir" data-link>Subir un archivo</a>
                <a class="btn btn--sm" href="/catalogo" data-link>Ver catálogo</a>
                <a class="btn btn--sm" href="/pedido" data-link>Pedido en curso</a>
              </div>
            </article>
          </div>
        </div>
      </section>
    `,
    async mount(root) {
      const form = root.querySelector('#profile-form');
      const errorBox = root.querySelector('#profile-error');
      const recent = root.querySelector('#recent-orders');

      try {
        const { orders } = await OrdersModel.mine();

        recent.innerHTML = orders.length
          ? `<ul style="list-style:none;display:grid;gap:8px">
               ${orders
                 .slice(0, 4)
                 .map(
                   (order) => `
                     <li>
                       <a class="row" href="/pedidos/${order.id}" data-link style="justify-content:space-between">
                         <span>Pedido #${order.id} · <span class="muted">${formatDate(order.created_at)}</span></span>
                         <span class="badge badge--${esc(order.status)}">${esc(STATUS_LABELS[order.status])}</span>
                       </a>
                     </li>`,
                 )
                 .join('')}
             </ul>`
          : '<p class="muted">Todavía no hiciste pedidos.</p>';
      } catch (error) {
        recent.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const button = form.querySelector('button[type="submit"]');
        const data = Object.fromEntries(new FormData(form));

        if (!data.password) delete data.password;

        errorBox.hidden = true;
        button.disabled = true;

        try {
          const { user: updated } = await session.updateProfile(data);

          form.password.value = '';
          form.currentPassword.value = '';
          toastOk('Datos actualizados');

          session.set(updated);
        } catch (error) {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
          toastErr(error.message);
        } finally {
          button.disabled = false;
        }
      });
    },
  };
}
