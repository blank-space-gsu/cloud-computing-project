import { el, clearElement } from '../utils/dom.js';

export function renderHeader(title, subtitle) {
  const header = document.getElementById('header');
  if (!header) return;
  clearElement(header);
  header.appendChild(
    el('div', { className: 'header-content' },
      el('div', {},
        el('h1', { className: 'header-title' }, title),
        subtitle ? el('p', { className: 'header-subtitle' }, subtitle) : null
      )
    )
  );
}
