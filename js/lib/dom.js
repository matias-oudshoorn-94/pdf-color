/** Helpers DOM mínimos: creación de elementos y escape de HTML. */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

/** Escapa texto antes de interpolarlo en plantillas HTML (previene XSS). */
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);

/** Convierte una plantilla en nodos DOM. */
export function html(strings, ...values) {
  const markup = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content;
}

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
