import { el, clearElement } from '../utils/dom.js';
import { navigate } from '../router.js';

const commonJourneys = [
  {
    title: 'Join my team and start work',
    description: 'Employees can sign in, join one or more teams, and get straight to their assigned work.',
    audience: 'Employees'
  },
  {
    title: 'Open My Tasks',
    description: 'Employees can review assigned tasks, update progress, and mark work complete without extra reporting clutter.',
    audience: 'Employees'
  },
  {
    title: 'Open the manager attention view',
    description: 'Managers can see overdue, blocked, unassigned, or stuck work and decide where to step in next.',
    audience: 'Managers'
  },
  {
    title: 'Run work from Worker Tracker',
    description: 'Managers can drill from team to employee to task, then assign or reassign work from one calm surface.',
    audience: 'Managers'
  }
];

const demoJourneys = [
  {
    title: 'Manager demo experience',
    description: 'Use the manager login to show the attention dashboard, Worker Tracker, team management, and task assignment flow.',
    audience: 'manager.demo@cloudcomputing.local'
  },
  {
    title: 'Employee demo experience',
    description: 'Use the employee login to show join flow, My Tasks, Calendar, team membership, and profile settings.',
    audience: 'employee.one@cloudcomputing.local'
  },
  {
    title: 'Alternative employee view',
    description: 'Use the second employee login to show a different employee-side perspective after sign in.',
    audience: 'employee.two@cloudcomputing.local'
  }
];

export default async function landingPage(container) {
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('main-wrapper').classList.add('full-width');
  document.getElementById('header').style.display = 'none';
  container.classList.add('content--public');

  clearElement(container);

  const state = {
    mode: 'common'
  };

  const page = el('div', { className: 'landing-page' });
  const listSection = el('div');

  const nav = buildNav();
  const hero = buildHero({
    onSignIn: () => navigate('#/login'),
    onJump: (sectionId) => {
      const target = document.getElementById(sectionId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  const tabs = buildTabs(state, () => renderJourneyContent(listSection));

  const mainGrid = el('section', { className: 'landing-main', id: 'landing-access' },
    el('div', { className: 'landing-primary' },
      el('div', { className: 'landing-section-heading' },
        el('span', { className: 'landing-kicker' }, 'User Access'),
        el('h2', {}, 'Choose the fastest way into the platform'),
        el('p', {}, 'Start with a common workflow or jump to the role-based sign-in path that fits the experience you want to show.')
      ),
      tabs,
      listSection
    ),
    buildSupportRail()
  );

  const tasksSection = buildAccordionSection({
    id: 'landing-features',
    title: 'Popular employee and manager tasks',
    subtitle: 'These quick paths mirror the most useful flows in the app and point users toward the right sign-in experience.',
    items: [
      {
        title: 'Join a team with a code or invite link',
        copy: 'Employees can use a join code or invite link, become active members, and start seeing work immediately.'
      },
      {
        title: 'Track my assigned work and mark it complete',
        copy: 'Employees can manage progress, notes, and completion from My Tasks without digging through extra reporting surfaces.'
      },
      {
        title: 'Review overdue, blocked, or unassigned work',
        copy: 'Managers can open the attention dashboard to find the work that needs a decision now.'
      },
      {
        title: 'Drill from team to employee to task',
        copy: 'Worker Tracker lets managers move from team progress into employee workload and then into the underlying tasks.'
      }
    ]
  });

  page.append(nav, hero, mainGrid, tasksSection);
  container.appendChild(page);

  renderJourneyContent(listSection);

  return () => {
    container.classList.remove('content--public');
    document.getElementById('header').style.display = '';
    document.getElementById('main-wrapper').classList.remove('full-width');
  };

  function renderJourneyContent(target) {
    clearElement(target);
    const data = state.mode === 'common' ? commonJourneys : demoJourneys;

    target.appendChild(
      el('div', { className: 'landing-journey-list' },
        ...data.map((item) => journeyCard(item, state.mode))
      )
    );
  }
}

function buildNav() {
  return el('header', { className: 'landing-nav' },
    el('div', { className: 'landing-nav__brand' },
      el('div', { className: 'landing-nav__logo' }, 'TF'),
      el('div', { className: 'landing-nav__brand-copy' },
        el('strong', {}, 'TaskFlow'),
        el('span', {}, 'Team task flow')
      )
    ),
    el('nav', { className: 'landing-nav__links' },
      ...[
        ['Platform', 'landing-home'],
        ['Workflows', 'landing-features'],
        ['Access', 'landing-access'],
        ['Support', 'landing-support']
      ].map(([label, sectionId]) => el('button', {
        className: 'landing-nav__link',
        type: 'button',
        onClick: () => {
          const target = document.getElementById(sectionId);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, label))
    ),
    el('div', { className: 'landing-nav__actions' },
      el('button', {
        className: 'btn btn-outline',
        type: 'button',
        onClick: () => {
          const target = document.getElementById('landing-support');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 'Support'),
      el('button', { className: 'btn btn-primary landing-nav__signin', type: 'button', onClick: () => navigate('#/login') }, 'Sign In')
    )
  );
}

function buildHero({ onSignIn, onJump }) {
  return el('section', { className: 'landing-hero', id: 'landing-home' },
    el('div', { className: 'landing-hero__content' },
      el('p', { className: 'landing-kicker' }, 'Multi-team task assignment'),
      el('h1', {}, 'Assign work, track completion, and keep teams moving without the dashboard clutter'),
      el('p', { className: 'landing-hero__description' },
        'TaskFlow is a focused work-assignment product: managers organize teams and assign work, employees join teams and complete tasks, and both sides stay aligned on what is due next.'
      ),
      el('div', { className: 'landing-hero__actions' },
        el('button', { className: 'btn btn-primary btn-lg', type: 'button', onClick: onSignIn }, 'Go To Sign In'),
        el('button', { className: 'btn btn-outline btn-lg', type: 'button', onClick: () => onJump('landing-features') }, 'View Workflows')
      ),
      el('div', { className: 'landing-stat-row' },
        landingStat('Manager workflow', 'Dashboard, Worker Tracker, Teams, Tasks'),
        landingStat('Employee workflow', 'Join, My Tasks, Calendar, Teams'),
        landingStat('Product focus', 'Assignment, completion, and team visibility')
      )
    ),
    el('div', { className: 'landing-hero__panel' },
      el('div', { className: 'landing-hero-card' },
        el('span', { className: 'landing-hero-card__label' }, 'Platform overview'),
        el('h3', {}, 'Built for day-to-day team execution'),
        el('p', {}, 'Managers use a lightweight attention dashboard and Worker Tracker. Employees join teams, work through assigned tasks, and watch due dates in Calendar.'),
        el('div', { className: 'landing-hero-card__chips' },
        el('span', { className: 'badge badge-primary' }, 'Team-based work'),
        el('span', { className: 'badge badge-success' }, 'Task execution'),
        el('span', { className: 'badge badge-info' }, 'Join & membership'),
        el('span', { className: 'badge badge-warning' }, 'Due-date visibility')
      )
      ),
      el('div', { className: 'landing-hero-note' },
        el('strong', {}, 'Sign-in guidance'),
        el('p', {}, 'Use the manager login for team oversight and assignment. Use the employee login for join, tasks, calendar, and membership flows.')
      )
    )
  );
}

function buildTabs(state, onChange) {
  const commonBtn = el('button', {
    className: 'landing-tab active',
    type: 'button',
    onClick: () => setMode('common')
  }, 'Common Journeys');
  const demoBtn = el('button', {
    className: 'landing-tab',
    type: 'button',
    onClick: () => setMode('demo')
  }, 'Demo Access');

  function setMode(mode) {
    state.mode = mode;
    commonBtn.classList.toggle('active', mode === 'common');
    demoBtn.classList.toggle('active', mode === 'demo');
    onChange();
  }

  return el('div', { className: 'landing-tabs' }, commonBtn, demoBtn);
}

function journeyCard(item, mode) {
  return el('article', { className: 'landing-journey-card' },
    el('div', { className: 'landing-journey-card__top' },
      el('h3', {}, item.title),
      el('span', { className: `badge badge-${mode === 'common' ? 'primary' : 'info'}` }, item.audience)
    ),
    el('p', {}, item.description),
    el('div', { className: 'landing-journey-card__actions' },
      el('button', { className: 'btn btn-outline btn-sm', type: 'button', onClick: () => navigate('#/login') }, 'Open Sign In'),
      mode === 'demo'
        ? el('button', { className: 'btn btn-primary btn-sm', type: 'button', onClick: () => navigate('#/login') }, 'Use This Demo')
        : null
    )
  );
}

function buildSupportRail() {
  return el('aside', { className: 'landing-support', id: 'landing-support' },
    el('div', { className: 'landing-support-card' },
      el('h3', {}, 'User Login Help & Support'),
      el('div', { className: 'landing-support-block' },
        el('strong', {}, 'Employees'),
        el('p', {}, 'Use the employee login to join teams, work through assigned tasks, check due dates in Calendar, and manage membership.')
      ),
      el('div', { className: 'landing-support-block' },
        el('strong', {}, 'Managers'),
        el('p', {}, 'Use the manager login to manage teams, share join access, assign work, and monitor team completion without analytics overload.')
      )
    ),
    el('div', { className: 'landing-support-card landing-support-card--accent' },
      el('span', { className: 'landing-support-card__eyebrow' }, 'Demo accounts'),
      el('h3', {}, 'Presentation-ready logins'),
      el('p', {}, 'Manager:', el('span', { className: 'landing-inline-email' }, 'manager.demo@cloudcomputing.local')),
      el('p', {}, 'Employee:', el('span', { className: 'landing-inline-email' }, 'employee.one@cloudcomputing.local')),
      el('p', { className: 'landing-support-card__note' }, 'Use the demo password from your local .env file.'),
      el('button', { className: 'btn btn-primary', type: 'button', onClick: () => navigate('#/login') }, 'Continue To Sign In')
    )
  );
}

function buildAccordionSection({ id, title, subtitle, items }) {
  return el('section', { className: 'landing-section', id },
    el('div', { className: 'landing-section-heading' },
      el('span', { className: 'landing-kicker' }, 'Popular Paths'),
      el('h2', {}, title),
      el('p', {}, subtitle)
    ),
    el('div', { className: 'landing-accordion-list' },
      ...items.map((item) => accordionItem(item))
    )
  );
}

function accordionItem(item) {
  return el('details', { className: 'landing-accordion' },
    el('summary', { className: 'landing-accordion__summary' },
      el('span', {}, item.title),
      el('span', { className: 'landing-accordion__icon' }, '+')
    ),
    el('div', { className: 'landing-accordion__body' },
      el('p', {}, item.copy),
      el('button', { className: 'btn btn-outline btn-sm', type: 'button', onClick: () => navigate('#/login') }, 'Sign In To Continue')
    )
  );
}

function landingStat(label, value) {
  return el('div', { className: 'landing-stat' },
    el('strong', {}, label),
    el('span', {}, value)
  );
}
