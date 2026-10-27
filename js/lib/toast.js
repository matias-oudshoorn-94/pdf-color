import { el } from './dom.js';

const container = () => document.getElementById('toasts');

export function toast(message, variant = 'info', ms = 3800) {
  const node = el('div', { class: `toast toast--${variant}`, role: 'status' }, message);
  container().append(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity 200ms';
    setTimeout(() => node.remove(), 220);
  }, ms);
}

export const toastOk = (msg) => toast(msg, 'success');
export const toastErr = (msg) => toast(msg, 'error');
