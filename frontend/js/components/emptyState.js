import { el } from '../utils/dom.js';

export function emptyState(title, description) {
  return el('div', { className: 'empty-state' },
    el('div', { className: 'empty-state-icon' }, '📋'),
    el('h3', {}, title),
    el('p', {}, description || '')
  );
}
