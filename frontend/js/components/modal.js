import { el, clearElement } from '../utils/dom.js';

const backdrop = () => document.getElementById('modal-backdrop');

export function openModal(title, bodyContent, footerContent) {
  const bd = backdrop();
  clearElement(bd);
  const modal = el('div', { className: 'modal' },
    el('div', { className: 'modal-header' },
      el('h2', { className: 'modal-title' }, title),
      el('button', { className: 'modal-close', onClick: closeModal }, '×')
    ),
    el('div', { className: 'modal-body' }, bodyContent),
    footerContent ? el('div', { className: 'modal-footer' }, footerContent) : null
  );
  bd.appendChild(modal);
  bd.classList.remove('hidden');
  bd.addEventListener('click', onBackdropClick);
}

export function closeModal() {
  const bd = backdrop();
  bd.classList.add('hidden');
  clearElement(bd);
  bd.removeEventListener('click', onBackdropClick);
}

function onBackdropClick(e) {
  if (e.target === backdrop()) closeModal();
}
