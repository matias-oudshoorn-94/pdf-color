const SITE_KEY = '6Lc-Rr8tAAAAAPCh7CMl-Du2TyGegegCTP8SmiBC';

// El backend tampoco lo exige en local (ver Recaptcha.php): reCAPTCHA depende de
// cookies de terceros que muchos navegadores bloquean, y no tiene sentido pelear
// contra eso solo para desarrollar.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

let loading = null;

function loadScript() {
  if (window.grecaptcha) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('No se pudo cargar reCAPTCHA')));
    document.head.append(script);
  });

  return loading;
}

/** Token de reCAPTCHA v3 (invisible) para la acción indicada: 'login', 'register', 'upload', 'checkout'. */
export async function getRecaptchaToken(action) {
  if (IS_LOCAL) return '';

  await loadScript();

  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha.execute(SITE_KEY, { action }).then(resolve, reject);
    });
  });
}

/** Cartel legal que reemplaza la insignia de reCAPTCHA (oculta por CSS, ver base.css). */
export const recaptchaDisclaimer = `
  <p class="recaptcha-disclaimer">
    Este sitio está protegido por reCAPTCHA y se aplican la
    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Política de Privacidad</a>
    y los
    <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Términos de Servicio</a>
    de Google.
  </p>
`;
