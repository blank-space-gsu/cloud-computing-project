import { el, clearElement } from '../utils/dom.js';
import { getUser, isManager, logout } from '../auth.js';

const SIDEBAR_STORAGE_KEY = 'taskflow-sidebar-collapsed';

function navItems() {
  return [
    { path: '#/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '#/tasks', label: 'Tasks', icon: '✅' },
    { path: '#/teams', label: isManager() ? 'Teams & People' : 'Teams', icon: '👥' },
    { path: '#/goals', label: 'Goals', icon: '🎯' },
    { path: '#/profile', label: 'Profile', icon: '🙍' }
  ];
}

export function isSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

export function applySidebarState() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    document.body.classList.remove('sidebar-collapsed');
    return;
  }

  document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed());
  sidebar.classList.remove('open');
}

export function toggleSidebarVisibility() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return false;

  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
    return sidebar.classList.contains('open');
  }

  const next = !isSidebarCollapsed();
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  applySidebarState();
  return next;
}

export function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  clearElement(sidebar);

  const user = getUser();
  if (!user) { sidebar.classList.add('hidden'); return; }
  sidebar.classList.remove('hidden');

  const currentHash = window.location.hash || '#/dashboard';

  const brand = el('div', { className: 'sidebar-brand' },
    el('span', { className: 'brand-icon' }, '⚡'),
    el('span', { className: 'brand-text' }, 'TaskFlow')
  );

  const nav = el('nav', { className: 'sidebar-nav' });
  for (const item of navItems()) {
    const isActive = currentHash.startsWith(item.path);
    const link = el('a', {
      href: item.path,
      className: `nav-link${isActive ? ' active' : ''}`
    },
      el('span', { className: 'nav-icon' }, item.icon),
      el('span', { className: 'nav-label' }, item.label)
    );
    nav.appendChild(link);
  }

  const roleBadge = isManager() ? 'Manager' : 'Employee';
  const userSection = el('div', { className: 'sidebar-user' },
    el('div', { className: 'user-avatar' }, user.firstName?.charAt(0) || '?'),
    el('div', { className: 'user-info' },
      el('div', { className: 'user-name' }, user.fullName || user.email),
      el('span', { className: `badge badge-${isManager() ? 'primary' : 'info'}` }, roleBadge)
    ),
    el('button', { className: 'btn-logout', onClick: logout, title: 'Logout' }, '⏻')
  );

  const hamburger = el('button', {
    className: 'sidebar-hamburger',
    onClick: toggleSidebarVisibility
  }, '☰');

  sidebar.append(hamburger, brand, nav, userSection);
  applySidebarState();
}
