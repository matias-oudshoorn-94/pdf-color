const uploadIcon = `
  <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
`;

const catalogIcon = `
  <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
`;

export function homePage() {
  return {
    html: `
      <section class="page landing">
        <div class="landing__intro">
          <h1 class="landing__welcome">Bienvenido a PDF Color</h1>
          <p class="landing__subtitle">Subí tus archivos para imprimir o mirá los que ya subieron otros para pedirlos.</p>
        </div>
        <div class="landing__actions">
          <a class="landing__btn landing__btn--primary" href="/subir" data-link>
            <span class="landing__icon">${uploadIcon}</span>
            <span class="landing__label">Publicar PDF</span>
          </a>
          <a class="landing__btn" href="/catalogo" data-link>
            <span class="landing__icon">${catalogIcon}</span>
            <span class="landing__label">Ver catálogo</span>
          </a>
        </div>
        <a class="landing__link" href="/calculadora" data-link>¿Cuánto sale imprimir? Calculá el precio →</a>
      </section>
    `,
  };
}
