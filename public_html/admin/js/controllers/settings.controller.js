import { AdminApi } from '../models/admin.api.js';
import { emptyState } from '/js/views/components.view.js';
import { toastErr, toastOk } from '/js/lib/toast.js';

export function settingsPage() {
  return {
    title: 'Precios',
    html: '<div id="content"><div class="skeleton" style="height:200px"></div></div>',
    async mount(root) {
      const content = root.querySelector('#content');

      let settings;

      try {
        ({ settings } = await AdminApi.settings());
      } catch (error) {
        content.innerHTML = emptyState('No se pudo cargar la configuración', error.message);
        return;
      }

      content.innerHTML = `
        <form class="card card--pad stack" id="settings-form" style="max-width:420px">
          <h3 class="card__title">Recargos</h3>
          <p class="muted">
            El total de cada archivo se calcula así: páginas × copias × precio por página según la
            cantidad y la faz (ver "Precios por cantidad"), más el recargo por anillado si se eligió
            esa terminación. Si la entrega es por envío, se suma el costo de envío fijo de acá.
            El tamaño de hoja todavía no afecta el precio.
          </p>
          <label class="field">
            <span class="field__label">Recargo por anillado ($ por copia)</span>
            <input class="input" type="number" name="priceRing" min="0" step="0.01"
                   value="${settings.price_ring}" required />
          </label>
          <label class="field">
            <span class="field__label">Costo de envío a domicilio ($, fijo para todos los envíos)</span>
            <input class="input" type="number" name="shippingPrice" min="0" step="0.01"
                   value="${settings.shipping_price}" required />
          </label>
          <button class="btn btn--primary" type="submit">Guardar</button>
        </form>
      `;

      root.querySelector('#settings-form').addEventListener('submit', async (event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const priceRing = Number(form.priceRing.value);
        const shippingPrice = Number(form.shippingPrice.value);

        button.disabled = true;

        try {
          ({ settings } = await AdminApi.updateSettings({ priceRing, shippingPrice }));
          form.priceRing.value = settings.price_ring;
          form.shippingPrice.value = settings.shipping_price;
          toastOk('Recargos actualizados');
        } catch (error) {
          toastErr(error.message);
        } finally {
          button.disabled = false;
        }
      });
    },
  };
}
