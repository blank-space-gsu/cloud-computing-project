import { getDefaultAuthenticatedHash, isLoggedIn, restoreSession } from './auth.js';
import { register, resolve, start } from './router.js';
import { applySidebarState, renderSidebar } from './components/sidebar.js';
import landingPage from './pages/landing.js';
import loginPage from './pages/login.js';
import dashboardPage from './pages/dashboard.js';
import tasksPage from './pages/tasks.js';
import calendarPage from './pages/calendar.js';
import teamsPage from './pages/teams.js';
import joinPage from './pages/join.js';
import workerTrackerPage from './pages/workerTracker.js';
import profilePage from './pages/profile.js';

register('/', landingPage);
register('/login', loginPage);
register('/dashboard', dashboardPage);
register('/tasks', tasksPage);
register('/calendar', calendarPage);
register('/teams', teamsPage);
register('/teams/:teamId', teamsPage);
register('/join', joinPage);
register('/worker-tracker', workerTrackerPage);
register('/profile', profilePage);

async function init() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div>';

  await restoreSession();

  if (isLoggedIn()) {
    renderSidebar();
    const defaultHash = getDefaultAuthenticatedHash();
    if (
      !window.location.hash
      || window.location.hash === '#/'
      || window.location.hash === '#/login'
      || window.location.hash === '#/dashboard'
    ) {
      window.location.hash = defaultHash;
    }
  } else {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('main-wrapper').classList.add('full-width');
    if (!window.location.hash || window.location.hash === '#/dashboard') {
      window.location.hash = '#/';
    }
  }

  start();
  await resolve();
}

window.addEventListener('hashchange', () => renderSidebar());
window.addEventListener('resize', () => applySidebarState());

init();
