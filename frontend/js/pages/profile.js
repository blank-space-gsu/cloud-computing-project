import { el, clearElement } from '../utils/dom.js';
import { getUser, isManager } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { openModal, closeModal } from '../components/modal.js';
import { showError } from '../components/toast.js';
import {
  capitalize,
  firstDayOfCurrentMonth,
  formatCompactNumber,
  formatDate,
  formatDateRange,
  formatHours,
  formatNumber,
  formatPercent,
  lastDayOfCurrentMonth
} from '../utils/format.js';
import { selectPreferredTeam, sortTeamsForDemo } from '../utils/teams.js';

const DEMO_MEMBER_EMAILS = {
  'Maya Manager': 'manager.demo@cloudcomputing.local',
  'Ethan Employee': 'employee.one@cloudcomputing.local',
  'Priya Employee': 'employee.two@cloudcomputing.local'
};

export default async function profilePage(container) {
  const user = getUser();
  renderHeader('Profile', isManager() ? 'Your manager identity, teams, and people context' : 'Your info, supervisors, and team context');
  clearElement(container);
  showLoading(container);

  try {
    const teamsResponse = await api.get('/teams');
    const teams = sortTeamsForDemo(teamsResponse.data.teams || []);
    const preferredTeam = selectPreferredTeam(teams);
    const monthRange = {
      start: firstDayOfCurrentMonth(),
      end: lastDayOfCurrentMonth()
    };

    const teamBundles = await Promise.all(
      teams.map(async (team) => {
        try {
          const { data } = await api.get(`/teams/${team.id}/members`);
          return { team, members: data.members || [] };
        } catch {
          return { team, members: [] };
        }
      })
    );

    let context = {};

    if (preferredTeam?.id) {
      if (isManager()) {
        const [dashboardRes, productivityRes, goalsRes, hoursRes, tasksRes] = await Promise.all([
          api.get(`/dashboards/manager?teamId=${preferredTeam.id}`),
          api.get(`/productivity-metrics?scope=team&teamId=${preferredTeam.id}`),
          api.get(`/goals?teamId=${preferredTeam.id}&sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=4`),
          api.get(`/hours-logged?teamId=${preferredTeam.id}&dateFrom=${monthRange.start}&dateTo=${monthRange.end}&limit=6`),
          api.get(`/tasks?teamId=${preferredTeam.id}&sortBy=urgency&sortOrder=asc&includeCompleted=true&page=1&limit=5`)
        ]);

        context = {
          dashboard: dashboardRes.data,
          productivity: productivityRes.data,
          goals: goalsRes.data,
          hours: hoursRes.data,
          tasks: tasksRes.data.tasks || []
        };
      } else {
        const [productivityRes, goalsRes, hoursRes, tasksRes] = await Promise.all([
          api.get(`/productivity-metrics?scope=individual&teamId=${preferredTeam.id}`),
          api.get(`/goals?teamId=${preferredTeam.id}&sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=4`),
          api.get(`/hours-logged?teamId=${preferredTeam.id}&dateFrom=${monthRange.start}&dateTo=${monthRange.end}&limit=6`),
          api.get('/tasks?sortBy=urgency&sortOrder=asc&includeCompleted=true&page=1&limit=5')
        ]);

        context = {
          productivity: productivityRes.data,
          goals: goalsRes.data,
          hours: hoursRes.data,
          tasks: tasksRes.data.tasks || []
        };
      }
    }

    clearElement(container);
    container.appendChild(renderProfile({
      user,
      teams,
      preferredTeam,
      teamBundles,
      monthRange,
      context
    }));
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

function renderProfile({ user, teams, preferredTeam, teamBundles, monthRange, context }) {
  const roster = buildRoster(teamBundles);
  const leaders = roster.filter((member) => member.membershipRole === 'manager');
  const teammates = roster.filter((member) => member.id !== user.id);
  const managedTeams = teams.filter((team) => team.canManageTeam);

  const hero = el('section', { className: 'page-hero profile-hero' },
    el('div', { className: 'profile-hero__identity' },
      avatarBadge(user.fullName),
      el('div', { className: 'profile-hero__copy' },
        el('p', { className: 'page-hero__eyebrow' }, isManager() ? 'Manager Profile' : 'Employee Profile'),
        el('h2', { className: 'page-hero__title' }, user.fullName),
        el('p', { className: 'page-hero__description' }, user.jobTitle || capitalize(user.appRole)),
        el('div', { className: 'page-hero__meta' },
          heroPill(`Role · ${capitalize(user.appRole)}`),
          heroPill(`Email · ${user.email}`),
          heroPill(`Teams · ${formatNumber(teams.length)}`),
          preferredTeam ? heroPill(`Primary team · ${preferredTeam.name}`) : null
        )
      )
    ),
    profileActionCard(user, managedTeams, leaders)
  );

  return el('div', { className: 'profile-shell' },
    hero,
    isManager()
      ? renderManagerProfile({ user, teams, preferredTeam, managedTeams, leaders, roster, monthRange, context })
      : renderEmployeeProfile({ user, teams, preferredTeam, leaders, teammates, monthRange, context, teamBundles })
  );
}

function renderManagerProfile({ user, teams, preferredTeam, managedTeams, leaders, roster, monthRange, context }) {
  const summary = context.dashboard?.summary || {};
  const goalsSummary = context.goals?.summary || {};
  const hoursSummary = context.hours?.summary || {};
  const monthlyRollup = context.productivity?.rollups?.monthly || {};
  const directReports = roster.filter((member) => member.appRole === 'employee').length;

  return el('div', {},
    el('div', { className: 'card-grid card-grid--dashboard' },
      summaryCard('Managed teams', formatCompactNumber(managedTeams.length), 'Teams where you can manage work and quotas.'),
      summaryCard('Direct reports', formatCompactNumber(directReports), 'Employees visible across the current team context.'),
      summaryCard('Overdue tasks', formatCompactNumber(summary.overdueTaskCount || 0), 'Urgent items already past their due date.'),
      summaryCard('Open goals', formatCompactNumber(goalsSummary.openGoalCount || 0), 'Quota targets still in progress.'),
      summaryCard('Team hours', formatHours(hoursSummary.currentMonthHours || 0), `Hours logged in ${formatDateRange(monthRange.start, monthRange.end)}.`),
      summaryCard('Logged vs estimated', formatPercent(monthlyRollup.loggedVsEstimatedPercent || 0, 1), 'How close team effort is to planned effort.')
    ),
    el('div', { className: 'dashboard-layout' },
      sectionCard(
        'My profile details',
        'Your account overview and a frontend-only profile editor preview.',
        profileDetailsPanel({
          user,
          preferredTeam,
          supportLabel: 'Managed teams',
          supportValue: formatNumber(managedTeams.length),
          photoAccess: 'You manage team photos',
          directoryStatus: 'Roster visible'
        }),
        'dashboard-section--featured profile-details-card'
      ),
      sectionCard(
        'Managed teams',
        'The seeded demo group is surfaced first so your strongest screens show up right away.',
        teams.length
          ? el('div', { className: 'team-grid profile-team-grid' },
              ...teams.map((team) => el('div', {
                className: `team-card${preferredTeam?.id === team.id ? ' team-card--highlight' : ''}`,
                onClick: () => { window.location.hash = `#/teams/${team.id}`; }
              },
                el('h3', {}, team.name),
                el('p', {}, team.description || 'No description'),
                el('div', { className: 'team-stats' },
                  el('span', {}, `👥 ${team.memberCount ?? 0} members`),
                  el('span', {}, `👔 ${team.managerCount ?? 0} managers`),
                  team.canManageTeam ? el('span', { className: 'badge badge-primary' }, 'Manageable') : null
                )
              )))
          : emptyState('No teams available', 'You are not assigned to any teams yet.')
      ),
      sectionCard(
        'Leadership roster',
        'Manager peers and leads visible from your current team memberships.',
        leaders.length
          ? el('div', { className: 'member-grid profile-member-grid' }, ...leaders.map((member) => rosterCard(member)))
          : emptyState('No leaders found', 'No manager roster is available right now.')
      ),
      sectionCard(
        preferredTeam ? `${preferredTeam.name} health snapshot` : 'Team health snapshot',
        'A quick summary of the most presentation-friendly numbers from the selected team.',
        metricsPanel([
          ['Total tasks', formatNumber(summary.totalTaskCount || 0)],
          ['Completed', formatNumber(summary.completedTaskCount || 0)],
          ['Unassigned', formatNumber(summary.unassignedTaskCount || 0)],
          ['Completion rate', formatPercent(summary.completionRate || 0, 1)],
          ['Average progress', formatPercent(summary.averageProgressPercent || 0, 1)],
          ['Urgent tasks', formatNumber(summary.urgentTaskCount || 0)]
        ])
      ),
      sectionCard(
        'People tools',
        'Profile photos and employee creation belong here in the finished product.',
        managerToolsCard()
      )
    )
  );
}

function renderEmployeeProfile({ user, preferredTeam, leaders, teammates, monthRange, context, teamBundles }) {
  const monthlyRollup = context.productivity?.rollups?.monthly || {};
  const hoursSummary = context.hours?.summary || {};
  const goalsSummary = context.goals?.summary || {};
  const primaryTeamMembers = teamBundles.find((bundle) => bundle.team.id === preferredTeam?.id)?.members || [];
  const supervisors = leaders.filter((leader) => primaryTeamMembers.some((member) => member.id === leader.id));

  return el('div', {},
    el('div', { className: 'card-grid card-grid--dashboard' },
      summaryCard('Monthly tasks', formatCompactNumber(monthlyRollup.taskCount || 0), 'Tasks counted in the current month window.'),
      summaryCard('Completed', formatCompactNumber(monthlyRollup.completedTaskCount || 0), 'Tasks already finished this month.'),
      summaryCard('Logged hours', formatHours(hoursSummary.currentMonthHours || 0), `Hours logged in ${formatDateRange(monthRange.start, monthRange.end)}.`),
      summaryCard('Completion rate', formatPercent(monthlyRollup.completionRate || 0, 1), 'Monthly task completion rate.'),
      summaryCard('Active goals', formatCompactNumber(goalsSummary.activeGoalCount || 0), 'Current team and personal goals in your scope.'),
      summaryCard('Supervisors', formatCompactNumber(supervisors.length), 'Managers visible on your primary team.')
    ),
    el('div', { className: 'dashboard-layout' },
      sectionCard(
        'My profile details',
        'Your own account, role, contact details, and profile editor preview.',
        profileDetailsPanel({
          user,
          preferredTeam,
          supportLabel: 'Supervisors',
          supportValue: formatNumber(supervisors.length),
          photoAccess: 'Manager controlled',
          directoryStatus: 'Partial support'
        }),
        'dashboard-section--featured profile-details-card'
      ),
      sectionCard(
        'Supervisor contacts',
        'Managers on your primary team.',
        supervisors.length
          ? el('div', { className: 'member-grid profile-member-grid' }, ...supervisors.map((leader) => supervisorCard(leader)))
          : emptyState('No supervisors listed', 'No manager roster was returned for your primary team.')
      ),
      sectionCard(
        'Current work snapshot',
        'Your tasks, goals, and logged hours from the current month window.',
        el('div', { className: 'profile-stack-list' },
          compactList('Recent tasks', context.tasks || [], (task) => `${task.title} · ${capitalize(task.status)}`),
          compactList('Current goals', context.goals?.goals || [], (goal) => `${goal.title} · ${formatPercent(goal.progressPercent || 0, 1)}`),
          compactList('Recent hours', context.hours?.hoursLogs || [], (entry) => `${formatDate(entry.workDate)} · ${formatHours(entry.hours)}`)
        )
      ),
      sectionCard(
        'My team',
        'People visible on the same team as you.',
        teammates.length
          ? el('div', { className: 'member-grid profile-member-grid' }, ...teammates.map((member) => rosterCard(member)))
          : emptyState('No teammates found', 'No other teammates were returned for your current team.')
      )
    )
  );
}

function buildRoster(teamBundles) {
  const roster = new Map();

  teamBundles.forEach(({ team, members }) => {
    members.forEach((member) => {
      const existing = roster.get(member.id) || {
        ...member,
        teams: []
      };

      existing.teams.push({
        teamId: team.id,
        teamName: team.name,
        membershipRole: member.membershipRole
      });

      roster.set(member.id, existing);
    });
  });

  return Array.from(roster.values());
}

function avatarBadge(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';

  return el('div', { className: 'profile-avatar' }, initials);
}

function heroPill(text) {
  return el('span', { className: 'hero-pill' }, text);
}

function profileActionCard(user, managedTeams, leaders) {
  return el('div', { className: 'profile-action-card' },
    el('h3', {}, 'Photo & Access'),
    el('p', {}, isManager()
      ? 'You control employee photo and roster workflows once the backend endpoints are added.'
      : 'Your profile photo is manager-controlled in the final build.'
    ),
    el('div', { className: 'profile-action-card__grid' },
      metricStat('Email', user.email),
      metricStat('Teams', formatNumber(user.teams?.length || 0)),
      metricStat(isManager() ? 'Manageable teams' : 'Supervisors', formatNumber(isManager() ? managedTeams.length : leaders.length))
    ),
    isManager()
      ? el('div', { className: 'btn-group', style: 'margin-top:14px' },
          el('button', { className: 'btn btn-primary', type: 'button', onClick: () => openSupportModal('Add Employee', addEmployeeRequirements()) }, 'Add Employee'),
          el('button', { className: 'btn btn-outline', type: 'button', onClick: () => openSupportModal('Photo Controls', photoRequirements()) }, 'Manage Photos')
        )
      : el('p', { className: 'profile-action-card__footnote' }, 'Manager approval is required for new profile photos.')
  );
}

function managerToolsCard() {
  return el('div', { className: 'support-card' },
    el('p', {}, 'These actions are placed here in the UI so the flow is ready, but they still need backend support to be real.'),
    el('div', { className: 'btn-group', style: 'margin-top:12px' },
      el('button', { className: 'btn btn-primary', type: 'button', onClick: () => openSupportModal('Add Employee', addEmployeeRequirements()) }, 'Add Employee'),
      el('button', { className: 'btn btn-outline', type: 'button', onClick: () => openSupportModal('Employee Photos', photoRequirements()) }, 'Manage Employee Photos')
    )
  );
}

function addEmployeeRequirements() {
  return [
    'Create employee auth account and app profile endpoint',
    'Create or assign employee to a team endpoint',
    'Optional photo upload field at employee creation time',
    'Return the new employee in roster and team list responses'
  ];
}

function photoRequirements() {
  return [
    'Profile photo upload endpoint',
    'Stored avatar URL on the user profile',
    'Manager-only update permission for employee photos',
    'Avatar URL returned from auth, users/me, and team member responses'
  ];
}

function openSupportModal(title, items) {
  openModal(title, el('div', { className: 'support-modal' },
    el('p', {}, 'This frontend flow is ready for the feature, but the backend still needs to supply these capabilities:'),
    el('ul', { className: 'support-list' }, ...items.map((item) => el('li', {}, item)))
  ), el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-primary', type: 'button', onClick: closeModal }, 'Close')
  ));
}

function sectionCard(title, subtitle, body, className = '') {
  return el('section', { className: `dashboard-section card${className ? ` ${className}` : ''}` },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, title),
        el('p', { className: 'section-subtitle' }, subtitle)
      )
    ),
    body
  );
}

function rosterCard(member, onClick) {
  return el('div', { className: `member-card member-card--dashboard${onClick ? ' member-card--interactive' : ''}`, onClick },
    el('div', { className: 'member-avatar' }, initials(member.fullName)),
    el('div', { className: 'member-info' },
      el('h4', {}, member.fullName),
      el('p', {}, member.jobTitle || 'Team member'),
      el('span', { className: `badge badge-${member.membershipRole === 'manager' ? 'primary' : 'info'}` }, capitalize(member.membershipRole || member.appRole))
    )
  );
}

function supervisorCard(member) {
  const email = memberEmail(member);
  return el('div', { className: 'member-card member-card--dashboard' },
    el('div', { className: 'member-avatar' }, initials(member.fullName)),
    el('div', { className: 'member-info' },
      el('h4', {}, member.fullName),
      el('p', {}, member.jobTitle || 'Team manager'),
      email
        ? el('div', { className: 'member-email member-email--compact' }, email)
        : el('div', { className: 'member-email member-email--muted' }, 'Email available when backend contact data is added'),
      el('span', { className: 'badge badge-primary' }, 'Supervisor')
    )
  );
}

function profileDetailsPanel({ user, preferredTeam, supportLabel, supportValue, photoAccess, directoryStatus }) {
  return el('div', { className: 'profile-details-panel' },
    profileDetailsFeature({ user, preferredTeam, supportLabel, supportValue, photoAccess, directoryStatus }),
    profileEditorCard(user)
  );
}

function profileDetailsFeature({ user, preferredTeam, supportLabel, supportValue, photoAccess, directoryStatus }) {
  return el('div', { className: 'profile-details-feature' },
    el('div', { className: 'profile-details-feature__header' },
      el('div', { className: 'profile-details-feature__identity' },
        avatarBadge(user.fullName),
        el('div', { className: 'profile-details-feature__copy' },
          el('h4', {}, user.fullName),
          el('p', {}, user.jobTitle || capitalize(user.appRole)),
          el('div', { className: 'task-badges', style: 'margin-top:8px' },
            el('span', { className: 'badge badge-info' }, capitalize(user.appRole)),
            preferredTeam ? el('span', { className: 'badge badge-primary' }, preferredTeam.name) : null
          )
        )
      )
    ),
    el('div', { className: 'profile-contact-strip' },
      el('span', { className: 'profile-contact-strip__label' }, 'Email'),
      el('strong', { className: 'profile-contact-strip__value' }, user.email)
    ),
    el('div', { className: 'profile-details-feature__grid' },
      metricStat('Primary team', preferredTeam?.name || 'No team'),
      metricStat(supportLabel, supportValue),
      metricStat('Photo access', photoAccess),
      metricStat('Directory status', directoryStatus)
    )
  );
}

function profileEditorCard(user) {
  return el('form', {
    className: 'profile-editor-card',
    onSubmit: (event) => {
      event.preventDefault();
      openSupportModal('Profile Editing', profileEditRequirements());
    }
  },
    el('div', { className: 'profile-editor-card__head' },
      el('div', { className: 'profile-editor-card__copy' },
        el('h5', {}, 'Edit profile information'),
        el('p', {}, 'This form is built in the UI now. Saving profile changes still needs backend support.')
      ),
      el('span', { className: 'badge badge-warning' }, 'Visual preview')
    ),
    el('div', { className: 'form-row' },
      formGroup('First name', 'firstName', 'text', user.firstName || '', 'Enter first name'),
      formGroup('Last name', 'lastName', 'text', user.lastName || '', 'Enter last name')
    ),
    el('div', { className: 'form-row' },
      formGroup('Date of birth', 'dateOfBirth', 'date', '', ''),
      formGroup('Role in company', 'jobTitle', 'text', user.jobTitle || '', 'Enter company role')
    ),
    textareaGroup('Address', 'address', '', 'Street address, city, state, ZIP'),
    el('div', { className: 'profile-editor-card__meta' },
      profileReadonlyField('App access role', capitalize(user.appRole)),
      profileReadonlyField('Email', user.email)
    ),
    el('div', { className: 'profile-editor-actions' },
      el('button', { className: 'btn btn-primary', type: 'submit' }, 'Save Changes'),
      el('p', { className: 'profile-editor-note' }, 'This button opens the backend handoff checklist until profile update endpoints are available.')
    )
  );
}

function compactList(title, items, renderText) {
  if (!items.length) {
    return el('div', { className: 'profile-inline-card' },
      el('strong', {}, title),
      el('span', {}, 'Nothing to show yet.')
    );
  }

  return el('div', { className: 'profile-inline-card' },
    el('strong', {}, title),
    el('div', { className: 'breakdown-list', style: 'margin-top:10px' },
      ...items.slice(0, 4).map((item) => el('div', { className: 'breakdown-item' },
        el('div', { className: 'breakdown-item__copy' },
          el('span', {}, renderText(item))
        )
      ))
    )
  );
}

function metricsPanel(items) {
  return el('div', { className: 'metrics-panel' },
    ...items.map(([label, value]) => el('div', { className: 'metrics-panel__item' },
      el('span', { className: 'metrics-panel__label' }, label),
      el('strong', { className: 'metrics-panel__value' }, value)
    ))
  );
}

function metricStat(label, value) {
  return el('div', { className: 'metrics-panel__item' },
    el('span', { className: 'metrics-panel__label' }, label),
    el('strong', { className: 'metrics-panel__value' }, value)
  );
}

function summaryCard(label, value, note) {
  return el('div', { className: 'card dashboard-stat-card' },
    el('div', { className: 'card-title' }, label),
    el('div', { className: 'card-value' }, value),
    el('div', { className: 'card-footer' }, note)
  );
}

function formGroup(label, name, type, value, placeholder) {
  return el('div', { className: 'form-group' },
    el('label', { className: 'form-label', htmlFor: name }, label),
    el('input', {
      id: name,
      name,
      type,
      value,
      placeholder,
      className: 'form-input'
    })
  );
}

function textareaGroup(label, name, value, placeholder) {
  return el('div', { className: 'form-group' },
    el('label', { className: 'form-label', htmlFor: name }, label),
    el('textarea', {
      id: name,
      name,
      placeholder,
      className: 'form-textarea'
    }, value || '')
  );
}

function profileReadonlyField(label, value) {
  return el('div', { className: 'profile-editor-readonly' },
    el('span', { className: 'profile-editor-readonly__label' }, label),
    el('strong', { className: 'profile-editor-readonly__value' }, value)
  );
}

function profileEditRequirements() {
  return [
    'Add a PATCH or PUT profile update endpoint, such as /api/v1/users/me',
    'Add validation rules for first name, last name, job title, date of birth, and address',
    'Add database fields for date of birth and address',
    'Decide which fields users can edit directly versus which stay manager or admin controlled',
    'Return the updated profile payload so the frontend can refresh immediately after save'
  ];
}

function memberEmail(member) {
  return member.email || DEMO_MEMBER_EMAILS[member.fullName] || null;
}

function initials(name) {
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
}
