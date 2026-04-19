import { el, clearElement } from '../utils/dom.js';
import { isSidebarCollapsed, toggleSidebarVisibility } from './sidebar.js';

export function renderHeader(title, subtitle) {
  const header = document.getElementById('header');
  if (!header) return;
  clearElement(header);
  const collapsed = window.innerWidth > 768 && isSidebarCollapsed();
  const useMenuIcon = window.innerWidth <= 768 || collapsed;
  header.appendChild(
    el('div', { className: 'header-content' },
      el('div', { className: 'header-main' },
        el('button', {
          className: `header-menu-toggle${collapsed ? ' is-collapsed' : ''}`,
          type: 'button',
          title: useMenuIcon ? 'Show menu' : 'Hide menu',
          'aria-label': useMenuIcon ? 'Show menu' : 'Hide menu',
          onClick: () => {
            toggleSidebarVisibility();
            renderHeader(title, subtitle);
          }
        }, useMenuIcon ? '☰' : '←'),
        el('div', {},
        el('h1', { className: 'header-title' }, title),
        subtitle ? el('p', { className: 'header-subtitle' }, subtitle) : null
        )
      )
    )
  );
}
