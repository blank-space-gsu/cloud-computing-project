import { el } from '../utils/dom.js';

const container = () => document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 4000) {
  const toast = el('div', { className: `toast toast-${type}` },
    el('span', { className: 'toast-icon' }, type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'),
    el('span', { className: 'toast-msg' }, message),
    el('button', { className: 'toast-close', onClick: () => dismiss(toast) }, '×')
  );
  container().appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => dismiss(toast), duration);
}

function dismiss(toast) {
  toast.classList.remove('show');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  setTimeout(() => toast.remove(), 400);
}

export function showError(err) {
  const msg = typeof err === 'string' ? err : err?.message || 'Something went wrong.';
  showToast(msg, 'error');
}

export function showSuccess(msg) {
  showToast(msg, 'success');
}
