import { el, clearElement } from '../utils/dom.js';

export function showLoading(container) {
  const existing = container.querySelector('.loading-spinner');
  if (existing) return;
  const spinner = el('div', { className: 'loading-spinner' },
    el('div', { className: 'spinner' }),
    el('p', {}, 'Loading...')
  );
  container.appendChild(spinner);
}

export function hideLoading(container) {
  const spinner = container.querySelector('.loading-spinner');
  if (spinner) spinner.remove();
}

export function renderInto(container, ...children) {
  clearElement(container);
  for (const child of children) {
    if (child) container.appendChild(child);
  }
}
