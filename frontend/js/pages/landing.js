import { el, clearElement } from '../utils/dom.js';
import { navigate } from '../router.js';

export default async function landingPage(container) {
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('main-wrapper').classList.add('full-width');
  document.getElementById('header').style.display = 'none';
  container.classList.add('content--public');

  clearElement(container);

  const jumpTo = (id) => {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const page = el('div', { className: 'lp' },
    buildTopBar(),
    buildHero({ onJump: jumpTo }),
    buildSteps(),
    buildRoles(),
    buildFinalCta()
  );

  container.appendChild(page);

  return () => {
    container.classList.remove('content--public');
    document.getElementById('header').style.display = '';
    document.getElementById('main-wrapper').classList.remove('full-width');
  };
}

function buildTopBar() {
  return el('header', { className: 'lp-top' },
    el('div', { className: 'lp-top__brand' },
      el('span', { className: 'lp-top__mark', 'aria-hidden': 'true' }, '⚡'),
      el('span', { className: 'lp-top__name' }, 'TaskTrail')
    ),
    el('button', {
      className: 'lp-btn lp-btn--primary',
      type: 'button',
      onClick: () => navigate('#/login')
    }, 'Sign in')
  );
}

function buildHero({ onJump }) {
  return el('section', { className: 'lp-hero', id: 'lp-hero' },
    el('span', { className: 'lp-eyebrow' }, 'Team-based work assignment'),
    el('h1', { className: 'lp-hero__title' },
      'Get work to the right people.',
      el('br', {}),
      'Keep teams on schedule.'
    ),
    el('p', { className: 'lp-hero__sub' },
      'Managers assign and track work. Employees join teams and complete tasks.'
    ),
    el('div', { className: 'lp-hero__actions' },
      el('button', {
        className: 'lp-btn lp-btn--primary lp-btn--lg',
        type: 'button',
        onClick: () => navigate('#/login')
      }, 'Sign in'),
      el('button', {
        className: 'lp-btn lp-btn--ghost lp-btn--lg',
        type: 'button',
        onClick: () => onJump('lp-how')
      }, 'How it works')
    )
  );
}

function buildSteps() {
  const steps = [
    {
      n: '01',
      title: 'Create or join a team',
      copy: 'Managers set up teams and share a join code. Employees join with a code or invite link.'
    },
    {
      n: '02',
      title: 'Assign and track work',
      copy: 'Give each task an owner, a priority, and a due date. Progress stays visible in one place.'
    },
    {
      n: '03',
      title: 'Complete tasks on time',
      copy: 'Employees work through assignments and watch due dates in Calendar. Managers see what needs attention.'
    }
  ];

  return el('section', { className: 'lp-section lp-how', id: 'lp-how' },
    el('div', { className: 'lp-section__head' },
      el('span', { className: 'lp-eyebrow' }, 'How it works'),
      el('h2', { className: 'lp-section__title' }, 'Three steps. That\u2019s the whole product.')
    ),
    el('div', { className: 'lp-steps' },
      ...steps.map((step) => el('article', { className: 'lp-step' },
        el('span', { className: 'lp-step__num' }, step.n),
        el('h3', { className: 'lp-step__title' }, step.title),
        el('p', { className: 'lp-step__copy' }, step.copy)
      ))
    )
  );
}

function buildRoles() {
  const managerPoints = [
    'Create teams and share join access.',
    'Assign, reassign, and prioritize work.',
    'See overdue, blocked, and unassigned at a glance.'
  ];
  const employeePoints = [
    'Join a team with a code or invite link.',
    'Work through assigned tasks in one list.',
    'Track due dates in Calendar.'
  ];

  return el('section', { className: 'lp-section lp-roles' },
    el('div', { className: 'lp-section__head' },
      el('span', { className: 'lp-eyebrow' }, 'Roles'),
      el('h2', { className: 'lp-section__title' }, 'Built for the two people on the task.')
    ),
    el('div', { className: 'lp-roles__grid' },
      roleCard('For managers', managerPoints),
      roleCard('For employees', employeePoints)
    )
  );
}

function roleCard(title, points) {
  return el('article', { className: 'lp-role' },
    el('h3', { className: 'lp-role__title' }, title),
    el('ul', { className: 'lp-role__list' },
      ...points.map((point) => el('li', { className: 'lp-role__item' }, point))
    )
  );
}

function buildFinalCta() {
  return el('section', { className: 'lp-cta' },
    el('h2', { className: 'lp-cta__title' }, 'Ready to get started?'),
    el('p', { className: 'lp-cta__sub' }, 'Sign in to create a team or join one.'),
    el('button', {
      className: 'lp-btn lp-btn--primary lp-btn--lg',
      type: 'button',
      onClick: () => navigate('#/login')
    }, 'Sign in')
  );
}
