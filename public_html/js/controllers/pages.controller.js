import { logoMark } from '../views/logo.view.js';
import { ContactModel } from '../models/resources.js';
import { mountPickupMap } from '../views/pickup-map.view.js';
import { esc } from '../lib/dom.js';
import { toastErr, toastOk } from '../lib/toast.js';

export function aboutPage() {
  return {
    html: `
      <section class="page">
        <div class="hero">
          <span class="eyebrow">Quiénes somos</span>
          <h1>Una imprenta con oficio, ahora online.</h1>
          <p class="hero__lead">
            Somos la imprenta de Mar del Plata que combina equipos profesionales de gran formato
            con un flujo 100% digital: subís tu archivo, elegís cómo lo querés, los pasás a buscar o te lo enviamos a tu hogar.
          </p>
        </div>

        <div class="grid grid--cards">
          <article class="card card--pad">
            <h3 class="card__title">Equipos profesionales</h3>
            <p>Impresión láser y de gran formato, con control de color y papeles de gramaje alto.</p>
          </article>
          <article class="card card--pad">
            <h3 class="card__title">Entregas rápidas</h3>
            <p>La mayoría de los pedidos quedan listos el mismo día. Te avisamos cuando podés retirarlo.</p>
          </article>
          <article class="card card--pad">
            <h3 class="card__title">Tus archivos, siempre a mano</h3>
            <p>Todo lo que subís queda guardado en tu cuenta para volver a pedirlo en dos clics.</p>
          </article>
        </div>

        <div id="pickup-map"></div>
      </section>
    `,
    mount(root) {
      mountPickupMap(root.querySelector('#pickup-map'));
    },
  };
}

export function contactPage() {
  return {
    html: `
      <section class="page">
        <header class="page__head">
          <div>
            <h2>Contacto</h2>
            <p>Escribinos y te respondemos a la brevedad.</p>
          </div>
        </header>

        <div class="grid grid--split">
          <form class="card card--pad form" id="contact-form" novalidate>
            <label class="field">
              <span class="field__label">Nombre</span>
              <input class="input" name="name" required minlength="2" maxlength="120" autocomplete="name" />
            </label>
            <label class="field">
              <span class="field__label">Email</span>
              <input class="input" name="email" type="email" required autocomplete="email" />
            </label>
            <label class="field">
              <span class="field__label">Teléfono</span>
              <input class="input" name="phone" type="tel" required minlength="6" maxlength="40" autocomplete="tel" />
            </label>
            <label class="field">
              <span class="field__label">Mensaje</span>
              <textarea class="textarea" name="message" required minlength="10" maxlength="2000"
                        placeholder="Contanos qué necesitás…"></textarea>
            </label>
            <p class="field__error" id="contact-error" hidden></p>
            <button class="btn btn--primary btn--block" type="submit">Enviar mensaje</button>
          </form>

          <div class="stack" id="contact-info">
            <div class="skeleton" style="height:180px"></div>
          </div>
        </div>

        <div id="pickup-map"></div>
      </section>
    `,
    async mount(root) {
      const form = root.querySelector('#contact-form');
      const errorBox = root.querySelector('#contact-error');
      const info = root.querySelector('#contact-info');

      mountPickupMap(root.querySelector('#pickup-map'));

      try {
        const { contact } = await ContactModel.info();
        info.innerHTML = `
          <article class="card card--pad stack">
            <h3 class="card__title">Datos de contacto</h3>
            <div class="stack" style="gap:8px">
              <a href="mailto:${esc(contact.email)}" style="text-decoration:underline">${esc(contact.email)}</a>
              <a href="tel:${esc(contact.phone.replace(/\s/g, ''))}" style="text-decoration:underline">${esc(contact.phone)}</a>
              <span class="muted">${esc(contact.address)}</span>
              <span class="muted">H. Yrigoyen 2447m Mar del Plata</span>
            </div>
            <a class="btn" href="https://wa.me/${esc(contact.whatsapp)}" target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp
            </a>
          </article>
          <article class="card card--pad stack">
            <h3 class="card__title">Horarios</h3>
            <p>${esc(contact.hours)}</p>
          </article>
        `;
      } catch {
        info.innerHTML = '';
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const button = form.querySelector('button[type="submit"]');
        errorBox.hidden = true;
        button.disabled = true;

        try {
          await ContactModel.send(Object.fromEntries(new FormData(form)));
          form.reset();
          toastOk('¡Mensaje enviado! Te respondemos a la brevedad.');
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
