import { el, clearElement } from '../utils/dom.js';
import { navigate } from '../router.js';

const commonJourneys = [
  {
    title: 'Review my assigned tasks',
    description: 'Employees can sign in to see current assignments, due dates, progress, and goal alignment.',
    audience: 'Employees'
  },
  {
    title: 'Track my hours and weekly output',
    description: 'Log hours, check monthly totals, and review personal productivity trends in one place.',
    audience: 'Employees'
  },
  {
    title: 'Open the manager overview',
    description: 'Managers can see overdue work, completion rates, team effort, and goal progress immediately.',
    audience: 'Managers'
  },
  {
    title: 'Inspect the team directory',
    description: 'See supervisors, team members, and profile-ready roster details before diving into the dashboards.',
    audience: 'Managers'
  }
];

const demoJourneys = [
  {
    title: 'Manager demo experience',
    description: 'Use the manager login to access dashboards, team oversight, people tools, and goal tracking.',
    audience: 'manager.demo@cloudcomputing.local'
  },
  {
    title: 'Employee demo experience',
    description: 'Use the employee login to show personal tasks, profile details, hours, goals, and supervisor access.',
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
        title: 'Find my assigned tasks and deadlines',
        copy: 'Employees can review live assignments, due pressure, notes, and progress from the task dashboard.'
      },
      {
        title: 'Find my logged hours and productivity',
        copy: 'Employees can log time, review hours trends, and compare progress against estimated effort.'
      },
      {
        title: 'Review team performance and overdue work',
        copy: 'Managers can review team performance, overdue tasks, workload, and monthly progress after signing in.'
      },
      {
        title: 'Open profiles, supervisors, and the team directory',
        copy: 'The profile and people views help present the employee-side experience as a full workplace portal.'
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
        el('span', {}, 'Cloud workforce operations')
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
      el('p', { className: 'landing-kicker' }, 'Cloud-Based Workforce Task Management'),
      el('h1', {}, 'User logins, team operations, and role-based workspace access in one place'),
      el('p', { className: 'landing-hero__description' },
        'TaskFlow helps employees track work, managers monitor team performance, and both roles move through a cleaner workforce portal before entering the full application experience.'
      ),
      el('div', { className: 'landing-hero__actions' },
        el('button', { className: 'btn btn-primary btn-lg', type: 'button', onClick: onSignIn }, 'Go To Sign In'),
        el('button', { className: 'btn btn-outline btn-lg', type: 'button', onClick: () => onJump('landing-features') }, 'View Workflows')
      ),
      el('div', { className: 'landing-stat-row' },
        landingStat('Employee workspace', 'Tasks, hours, profile, supervisors'),
        landingStat('Manager control', 'Dashboard, goals, roster, metrics'),
        landingStat('Role-based access', 'Clear entry points for employee and manager sign-in')
      )
    ),
    el('div', { className: 'landing-hero__panel' },
      el('div', { className: 'landing-hero-card' },
        el('span', { className: 'landing-hero-card__label' }, 'Platform overview'),
        el('h3', {}, 'Built for daily workforce coordination'),
        el('p', {}, 'Employees and managers each get a focused workspace with the right tools for task tracking, time logging, team visibility, and progress monitoring.'),
        el('div', { className: 'landing-hero-card__chips' },
          el('span', { className: 'badge badge-primary' }, 'Role-based views'),
          el('span', { className: 'badge badge-success' }, 'Task tracking'),
          el('span', { className: 'badge badge-warning' }, 'Hours & goals'),
          el('span', { className: 'badge badge-info' }, 'Team visibility')
        )
      ),
      el('div', { className: 'landing-hero-note' },
        el('strong', {}, 'Sign-in guidance'),
        el('p', {}, 'Choose the manager login for oversight features or the employee login for the self-service workspace and personal task view.')
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
        el('p', {}, 'Use the employee login to see personal tasks, hours, goals, supervisors, and your own profile details.')
      ),
      el('div', { className: 'landing-support-block' },
        el('strong', {}, 'Managers'),
        el('p', {}, 'Use the manager login to open dashboards, people directory, goal tracking, and team metrics.')
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
