import { restoreSession, isLoggedIn } from './auth.js';
import { register, resolve, start } from './router.js';
import { renderSidebar } from './components/sidebar.js';
import landingPage from './pages/landing.js';
import loginPage from './pages/login.js';
import dashboardPage from './pages/dashboard.js';
import tasksPage from './pages/tasks.js';
import teamsPage from './pages/teams.js';
import hoursPage from './pages/hours.js';
import productivityPage from './pages/productivity.js';
import goalsPage from './pages/goals.js';
import profilePage from './pages/profile.js';

register('/', landingPage);
register('/login', loginPage);
register('/dashboard', dashboardPage);
register('/tasks', tasksPage);
register('/teams', teamsPage);
register('/teams/:teamId', teamsPage);
register('/hours', hoursPage);
register('/productivity', productivityPage);
register('/goals', goalsPage);
register('/profile', profilePage);

async function init() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div>';

  await restoreSession();

  if (isLoggedIn()) {
    renderSidebar();
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#/login') {
      window.location.hash = '#/dashboard';
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

init();
