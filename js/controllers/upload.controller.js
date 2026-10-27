import { FilesModel, SettingsModel, TaxonomyModel } from '../models/resources.js';
import { cart } from '../models/cart.js';
import { formatBytes, formatDate, formatMoney } from '../lib/format.js';
import { esc } from '../lib/dom.js';
import { toastErr, toastOk } from '../lib/toast.js';
import { navigate } from '../router.js';
import { searchableSelect } from '../lib/searchable-select.js';
import { quickCreate } from '../lib/quick-create.js';
import { inspectLocalFile, paintThumbnail } from '../lib/thumbnail.js';
import { openProgressOverlay } from '../views/progress-overlay.view.js';
import { getRecaptchaToken, recaptchaDisclaimer } from '../lib/recaptcha.js';

const ACCEPT = '.pdf';
const STEP_LABELS = ['Archivo', 'Nivel educativo', 'Institución', 'Año y materia'];
const LEVEL_LABELS = { primaria: 'Primaria', secundaria: 'Secundaria', universitario: 'Universitario' };

export function uploadPage() {
  return {
    html: `
      <section class="page wizard">
        <ol class="wizard-steps" id="wizard-steps">
          ${STEP_LABELS.map(
            (label, i) => `
              <li class="wizard-steps__item" data-step-indicator="${i + 1}">
                <span class="wizard-steps__circle">${i + 1}</span>
                <span class="wizard-steps__label">${label}</span>
              </li>`,
          ).join('')}
        </ol>
        <div class="wizard-steps__mobile" id="wizard-mobile">
          <span class="wizard-steps__mobile-text" id="wizard-mobile-text"></span>
          <div class="wizard-steps__bar"><div class="wizard-steps__bar-fill" id="wizard-mobile-fill"></div></div>
        </div>

        <form id="upload-form" novalidate>
          <input id="file-input" type="file" accept="${ACCEPT}" hidden />

          <div class="wizard-panel" data-panel="1">
            <div>
              <h2>Subí tu archivo</h2>
            </div>

            <label class="dropzone" id="dropzone" for="file-input">
              <span class="dropzone__title" id="dz-title">Arrastrá tu archivo acá</span>
              <span class="dropzone__hint">o hacé clic para elegirlo</span>
            </label>
            <p class="field__error" id="file-error" hidden></p>

            <div class="file-preview" id="file-preview" hidden>
              <img class="file-preview__thumb" id="file-preview-thumb" alt="" />
              <div class="file-preview__body">
                <span class="file-preview__name" id="file-preview-name"></span>
                <span class="muted" id="file-preview-meta"></span>
                <button class="btn btn--sm btn--ghost" type="button" id="file-preview-remove" style="width:fit-content">
                  Elegir otro archivo
                </button>
              </div>
            </div>

            <label class="field">
              <span class="field__label">Título</span>
              <input class="input" id="title" maxlength="180" />
              <span class="field__hint">Nombre del libro - editorial</span>
            </label>

            <div class="duplicate-check" id="duplicate-check" hidden></div>

            <div class="wizard-nav">
              <span class="wizard-nav__spacer"></span>
              <button class="btn btn--primary" type="button" data-next id="step1-next">Continuar</button>
            </div>
          </div>

          <div class="wizard-panel" data-panel="2" hidden>
            <div>
              <h2>¿Qué nivel educativo es?</h2>
              <p class="muted">Elegí una opción para seguir.</p>
            </div>

            <div class="wizard-levels" id="wizard-levels">
              ${Object.entries(LEVEL_LABELS)
                .map(([value, label]) => `<button class="wizard-level" type="button" data-level="${value}">${label}</button>`)
                .join('')}
            </div>
            <p class="field__error" id="level-error" hidden></p>

            <div class="wizard-nav">
              <button class="btn btn--ghost" type="button" data-back>Atrás</button>
              <button class="btn btn--primary" type="button" data-next>Continuar</button>
            </div>
          </div>

          <div class="wizard-panel" data-panel="3" hidden>
            <div>
              <h2>Buscá tu institución</h2>
              <p class="muted">Escribí el nombre, o la localidad si no te acordás el nombre exacto.</p>
            </div>

            <div id="institution"></div>
            <p class="field__error" id="institution-error" hidden></p>
            <div id="institution-create"></div>

            <div class="wizard-nav">
              <button class="btn btn--ghost" type="button" data-back>Atrás</button>
              <button class="btn btn--primary" type="button" data-next>Continuar</button>
            </div>
          </div>

          <div class="wizard-panel" data-panel="4" hidden>
            <div>
              <h2>Último paso</h2>
              <p class="muted">Elegí el año y la materia del archivo.</p>
            </div>

            <div class="field" id="career-wrap" hidden>
              <span class="field__label">Carrera *</span>
              <div id="career"></div>
              <span class="field__error" id="career-error" hidden></span>
              <div id="career-create"></div>
            </div>
            <label class="field">
              <span class="field__label">Año *</span>
              <select class="select" id="year" disabled><option value="">Elegí un año</option></select>
              <span class="field__error" id="year-error" hidden></span>
            </label>
            <div class="field">
              <span class="field__label">Materia *</span>
              <div id="subject"></div>
              <span class="field__error" id="subject-error" hidden></span>
              <div id="subject-create"></div>
            </div>
            ${recaptchaDisclaimer}

            <div class="wizard-nav">
              <button class="btn btn--ghost" type="button" data-back>Atrás</button>
              <button class="btn btn--primary" type="submit">Finalizar y subir</button>
            </div>
          </div>
        </form>
      </section>
    `,
    async mount(root) {
      const form = root.querySelector('#upload-form');
      const panels = [...root.querySelectorAll('[data-panel]')];
      const stepItems = [...root.querySelectorAll('[data-step-indicator]')];
      const mobileText = root.querySelector('#wizard-mobile-text');
      const mobileFill = root.querySelector('#wizard-mobile-fill');

      const input = root.querySelector('#file-input');
      const dropzone = root.querySelector('#dropzone');
      const fileError = root.querySelector('#file-error');
      const filePreview = root.querySelector('#file-preview');
      const filePreviewThumb = root.querySelector('#file-preview-thumb');
      const filePreviewName = root.querySelector('#file-preview-name');
      const filePreviewMeta = root.querySelector('#file-preview-meta');
      const title = root.querySelector('#title');

      const levelButtons = [...root.querySelectorAll('[data-level]')];
      const wizardLevels = root.querySelector('#wizard-levels');
      const levelError = root.querySelector('#level-error');

      const institutionHost = root.querySelector('#institution');
      const institutionError = root.querySelector('#institution-error');
      const institution = searchableSelect(institutionHost, {
        placeholder: 'Escribí el nombre de la institución o la localidad…',
        createLabel: '¿No encontrás tu institución? Cargala',
        onCreate: (text) => institutionCreate?.open(text),
      });

      const careerWrap = root.querySelector('#career-wrap');
      const careerHost = root.querySelector('#career');
      const careerError = root.querySelector('#career-error');
      const career = searchableSelect(careerHost, {
        placeholder: 'Escribí el nombre de la carrera…',
        createLabel: '¿No encontrás tu carrera? Cargala',
        onCreate: (text) => careerCreate.open(text),
      });
      const year = root.querySelector('#year');
      const yearError = root.querySelector('#year-error');
      const subjectHost = root.querySelector('#subject');
      const subjectError = root.querySelector('#subject-error');
      const subject = searchableSelect(subjectHost, {
        placeholder: 'Escribí el nombre de la materia…',
        createLabel: '¿No encontrás tu materia? Cargala',
        onCreate: (text) => subjectCreate.open(text),
      });

      // Listas cargadas, para sumarles lo que el usuario cree sin volver a pedirlas.
      let institutions = [];
      let careers = [];
      let subjects = [];
      let institutionCreate = null;

      const byName = (a, b) => a.name.localeCompare(b.name, 'es');
      const institutionLabel = (i) => `${i.name} · ${i.location_name}`;

      /** Suma la opción a la lista (si es nueva) y la deja elegida. */
      function addAndSelect(list, item, select, label) {
        if (!list.some((i) => String(i.id) === String(item.id))) list.push(item);
        list.sort(byName);
        select.setOptions(list, label);
        select.select(item.id);
      }

      const careerCreate = quickCreate(root.querySelector('#career-create'), {
        type: 'career',
        noun: 'tu carrera',
        placeholder: 'Ej: Licenciatura en Psicología',
        maxLength: 160,
        label: (c) => c.name,
        onSelect: (item) => {
          addAndSelect(careers, item, career, (c) => c.name);
          continueAfterQuickCreate();
        },
      });

      const subjectCreate = quickCreate(root.querySelector('#subject-create'), {
        type: 'subject',
        noun: 'tu materia',
        placeholder: 'Ej: Matemática',
        maxLength: 120,
        label: (s) => s.name,
        onSelect: (item) => {
          addAndSelect(subjects, item, subject, (s) => s.name);
          continueAfterQuickCreate();
        },
      });

      const duplicateBox = root.querySelector('#duplicate-check');
      const step1Next = root.querySelector('#step1-next');

      // fileHash: promesa con la huella SHA-256 del archivo elegido (o null si el navegador no puede).
      // duplicatesOkFor: archivo+título ya revisados (sin parecidos o "subir igual"), para no volver a preguntar.
      const state = { step: 1, file: null, level: '', fileHash: null, duplicatesOkFor: null };
      let pricePerSheet = null;

      // ---------- Navegación entre pasos ----------

      function render() {
        for (const panel of panels) panel.hidden = Number(panel.dataset.panel) !== state.step;

        for (const item of stepItems) {
          const n = Number(item.dataset.stepIndicator);
          item.classList.toggle('is-active', n === state.step);
          item.classList.toggle('is-done', n < state.step);
        }

        mobileText.textContent = `Paso ${state.step} de 4 · ${STEP_LABELS[state.step - 1]}`;
        mobileFill.style.width = `${(state.step / STEP_LABELS.length) * 100}%`;
      }

      function goTo(step) {
        state.step = step;
        render();
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function setInvalid(el, errorEl, invalid, message) {
        el?.classList.toggle('is-invalid', invalid);
        if (errorEl) {
          errorEl.textContent = invalid ? message : '';
          errorEl.hidden = !invalid;
        }
      }

      function validateStep(step) {
        if (step === 1) {
          const invalid = !state.file;
          setInvalid(dropzone, fileError, invalid, 'Elegí un archivo primero');
          if (invalid) toastErr('Elegí un archivo primero');
          return !invalid;
        }

        if (step === 2) {
          const invalid = !state.level;
          setInvalid(wizardLevels, levelError, invalid, 'Elegí el nivel educativo');
          if (invalid) toastErr('Elegí el nivel educativo');
          return !invalid;
        }

        if (step === 3) {
          const invalid = !institution.value;
          setInvalid(institutionHost, institutionError, invalid, 'Elegí la institución');
          if (invalid) toastErr('Elegí la institución');
          return !invalid;
        }

        if (step === 4) {
          const careerInvalid = state.level === 'universitario' && !career.value;
          const yearInvalid = !year.value;
          const subjectInvalid = !subject.value;

          setInvalid(careerHost, careerError, careerInvalid, 'Elegí la carrera');
          setInvalid(year, yearError, yearInvalid, 'Elegí el año');
          setInvalid(subjectHost, subjectError, subjectInvalid, 'Elegí la materia');

          if (careerInvalid) toastErr('Elegí la carrera');
          else if (yearInvalid) toastErr('Elegí el año');
          else if (subjectInvalid) toastErr('Elegí la materia');

          return !careerInvalid && !yearInvalid && !subjectInvalid;
        }

        return true;
      }

      async function next() {
        if (!validateStep(state.step)) return;
        if (state.step === 1 && !(await checkDuplicates())) return;
        if (state.step === 3) loadYearOptions();
        goTo(state.step + 1);
      }

      // ---------- Paso 1: ¿el archivo ya está en el catálogo? ----------

      const duplicateKey = () =>
        state.file ? `${state.file.name}|${state.file.size}|${state.file.lastModified}|${title.value.trim()}` : '';

      function hideDuplicates() {
        duplicateBox.hidden = true;
        duplicateBox.innerHTML = '';
      }

      /** true = seguir al paso 2; false = se le mostraron posibles duplicados y elige él. */
      async function checkDuplicates() {
        const key = duplicateKey();
        if (state.duplicatesOkFor === key) return true;

        step1Next.disabled = true;
        step1Next.textContent = 'Revisando…';

        try {
          const { duplicates } = await FilesModel.duplicates({
            hash: await state.fileHash,
            fileName: state.file.name,
            title: title.value.trim(),
          });

          if (duplicates.length === 0) {
            state.duplicatesOkFor = key;
            return true;
          }

          renderDuplicates(duplicates, key);
          return false;
        } catch {
          // El aviso es una ayuda: si falla la consulta, no se frena la subida.
          return true;
        } finally {
          step1Next.disabled = false;
          step1Next.textContent = 'Continuar';
        }
      }

      function renderDuplicates(duplicates, key) {
        const sameFile = duplicates.some((d) => d.match === 'same_file');

        duplicateBox.innerHTML = `
          <div class="duplicate-check__head">
            <strong>${sameFile ? 'Este archivo ya está en el catálogo' : 'Encontramos archivos con un nombre parecido'}</strong>
            <p class="muted">
              ${sameFile ? 'Podés pedir el que ya está cargado y ahorrarte la subida.' : '¿Es alguno de estos? Si es, pedilo directamente y te ahorrás la subida.'}
            </p>
          </div>
          <div class="duplicate-check__list">
            ${duplicates
              .map((d, i) => {
                const meta = [d.institution_name, d.career_name, d.year_name, d.subject_name].filter(Boolean).map(esc);
                meta.push(`${d.page_count} página${Number(d.page_count) === 1 ? '' : 's'}`, `subido el ${formatDate(d.created_at)}`);

                return `
                  <div class="duplicate-item">
                    <div class="duplicate-item__thumb" data-thumb="${i}"><img alt="" /></div>
                    <div class="duplicate-item__body">
                      ${d.match === 'same_file' ? '<span class="duplicate-item__tag">Mismo archivo</span>' : ''}
                      <span class="duplicate-item__title">${esc(d.title)}</span>
                      <span class="duplicate-item__meta">${meta.join(' · ')}</span>
                    </div>
                    <div class="duplicate-item__actions">
                      <button class="btn btn--primary btn--sm" type="button" data-use="${i}">Pedir este</button>
                      <a class="btn btn--ghost btn--sm" href="/api/files/${d.id}/preview" target="_blank" rel="noopener">Ver</a>
                    </div>
                  </div>`;
              })
              .join('')}
          </div>
          <div class="duplicate-check__actions">
            <button class="btn btn--ghost" type="button" data-upload-anyway>
              ${sameFile ? 'Subirlo igual' : 'No es ninguno, subir el mío'}
            </button>
          </div>
        `;
        duplicateBox.hidden = false;

        for (const thumb of duplicateBox.querySelectorAll('[data-thumb]')) {
          paintThumbnail(thumb, duplicates[Number(thumb.dataset.thumb)]);
        }

        for (const button of duplicateBox.querySelectorAll('[data-use]')) {
          button.addEventListener('click', () => {
            // Mismo resultado que terminar la subida: el archivo al pedido y directo a pagar.
            cart.add(duplicates[Number(button.dataset.use)]);
            toastOk('Lo agregamos a tu pedido');
            navigate('/pedido');
          });
        }

        duplicateBox.querySelector('[data-upload-anyway]').addEventListener('click', () => {
          state.duplicatesOkFor = key;
          hideDuplicates();
          next();
        });

        duplicateBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      async function hashFile(file) {
        if (!window.crypto?.subtle) return null; // solo existe en HTTPS / localhost

        try {
          const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
          return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch {
          return null;
        }
      }

      title.addEventListener('input', hideDuplicates);

      for (const button of root.querySelectorAll('[data-next]')) {
        button.addEventListener('click', next);
      }

      /**
       * Después de elegir o cargar una opción desde "¿No encontrás…? Cargala" se sigue
       * solo, sin apretar "Continuar": en el paso 3 pasa al 4, y en el paso 4 va al
       * próximo campo vacío o, si ya está todo, sube el archivo.
       */
      function continueAfterQuickCreate() {
        if (state.step !== 4) {
          next();
          return;
        }

        const pending = [
          state.level === 'universitario' && !career.value ? careerHost.querySelector('input') : null,
          !year.value ? year : null,
          !subject.value ? subjectHost.querySelector('input') : null,
        ].find(Boolean);

        if (pending) pending.focus();
        else form.requestSubmit();
      }

      for (const button of root.querySelectorAll('[data-back]')) {
        button.addEventListener('click', () => goTo(state.step - 1));
      }

      render();

      // ---------- Paso 1: archivo ----------

      async function handleFile(file) {
        state.file = file;
        state.fileHash = hashFile(file);
        hideDuplicates();
        dropzone.hidden = true;
        setInvalid(dropzone, fileError, false);
        filePreview.hidden = false;
        filePreviewThumb.removeAttribute('src');
        filePreviewName.textContent = file.name;
        filePreviewMeta.textContent = `${formatBytes(file.size)} · Leyendo el PDF…`;

        try {
          const { pageCount, thumbnail } = await inspectLocalFile(file);

          filePreviewThumb.src = thumbnail;

          const priceText = pricePerSheet != null ? ` · Precio estimado: ${formatMoney(pageCount * pricePerSheet)}` : '';
          filePreviewMeta.textContent = `${pageCount} página${pageCount === 1 ? '' : 's'} · ${formatBytes(file.size)}${priceText}`;
        } catch (error) {
          // No bloquea el paso: el servidor cuenta las páginas al subir de verdad.
          console.error('No se pudo leer el PDF en el navegador', error);
          filePreviewMeta.textContent = formatBytes(file.size);
        }
      }

      root.querySelector('#file-preview-remove').addEventListener('click', () => {
        input.value = '';
        input.click();
      });

      input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));

      for (const type of ['dragenter', 'dragover']) {
        dropzone.addEventListener(type, (e) => {
          e.preventDefault();
          dropzone.dataset.active = 'true';
        });
      }
      for (const type of ['dragleave', 'drop']) {
        dropzone.addEventListener(type, (e) => {
          e.preventDefault();
          dropzone.dataset.active = 'false';
        });
      }
      dropzone.addEventListener('drop', (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        input.files = event.dataTransfer.files;
        handleFile(file);
      });

      try {
        const { settings } = await SettingsModel.get();
        pricePerSheet = Number(settings.price_per_sheet) || 0;
      } catch {
        pricePerSheet = null;
      }

      // ---------- Paso 2: nivel ----------

      for (const button of levelButtons) {
        button.addEventListener('click', () => {
          state.level = button.dataset.level;
          for (const b of levelButtons) b.classList.toggle('is-selected', b === button);
          setInvalid(wizardLevels, levelError, false);
        });
      }

      // ---------- Paso 3: institución ----------

      try {
        ({ institutions } = await TaxonomyModel.institutions());
        institution.setOptions(institutions, institutionLabel);
      } catch {
        institution.disabled = true;
      }

      try {
        const { locations } = await TaxonomyModel.locations();
        institutionCreate = quickCreate(root.querySelector('#institution-create'), {
          type: 'institution',
          noun: 'tu institución',
          placeholder: 'Ej: Escuela de Educación Secundaria N° 5',
          maxLength: 160,
          locations,
          label: institutionLabel,
          onSelect: (item) => {
            addAndSelect(institutions, item, institution, institutionLabel);
            continueAfterQuickCreate();
          },
        });
      } catch {
        /* sin localidades no se puede cargar una institución nueva: queda solo la búsqueda */
      }

      institution.addEventListener('change', () => setInvalid(institutionHost, institutionError, false));

      // ---------- Paso 4: carrera / año / materia ----------

      const fill = (select, items, label) => {
        select.innerHTML =
          '<option value="">Sin indicar</option>' +
          items.map((item) => `<option value="${item.id}">${label(item)}</option>`).join('');
        select.disabled = items.length === 0;
      };

      try {
        ({ subjects } = await TaxonomyModel.subjects());
        subject.setOptions(subjects, (s) => s.name);
      } catch {
        subject.disabled = true;
      }

      try {
        ({ careers } = await TaxonomyModel.careers());
        career.setOptions(careers, (c) => c.name);
      } catch {
        career.disabled = true;
      }

      career.addEventListener('change', () => setInvalid(careerHost, careerError, false));
      year.addEventListener('change', () => setInvalid(year, yearError, false));
      subject.addEventListener('change', () => setInvalid(subjectHost, subjectError, false));

      async function loadYearOptions() {
        careerWrap.hidden = state.level !== 'universitario';

        year.innerHTML = '<option value="">Elegí un año</option>';
        year.disabled = true;

        if (!state.level) return;

        const { years } = await TaxonomyModel.years(state.level);
        fill(year, years, (y) => y.name);
      }

      // ---------- Envío final ----------

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Enter en un campo de un paso anterior no debe disparar el submit final.
        if (state.step !== 4) return;

        if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) return;

        const submitButton = form.querySelector('[type="submit"]');
        const data = new FormData();

        data.set('file', state.file);
        data.set('title', title.value.trim());
        data.set('institutionId', institution.value);
        data.set('level', state.level);
        if (state.level === 'universitario' && career.value) data.set('careerId', career.value);
        data.set('yearId', year.value);
        data.set('subjectId', subject.value);

        submitButton.disabled = true;

        let overlay = null;

        try {
          data.set('recaptchaToken', await getRecaptchaToken('upload'));

          overlay = openProgressOverlay({ title: 'Subiendo tu archivo…' });

          const { file } = await FilesModel.upload(data, (progress) => {
            if (progress.ratio >= 1) {
              overlay.setIndeterminate('Procesando…');
            } else {
              overlay.setProgress(progress);
            }
          });
          // El archivo recién subido va directo al pedido para pagarlo sin buscarlo en el catálogo.
          cart.add(file);
          toastOk('Archivo subido y agregado a tu pedido');
          navigate('/pedido');
        } catch (error) {
          toastErr(error.message);
        } finally {
          overlay?.close();
          submitButton.disabled = false;
        }
      });
    },
  };
}
