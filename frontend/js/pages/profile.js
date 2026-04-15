import { el, clearElement } from '../utils/dom.js';
import { getUser, isManager, setUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { openModal, closeModal } from '../components/modal.js';
import { showError, showSuccess } from '../components/toast.js';
import { buildNotificationArchiveSection } from '../components/notifications.js';
import {
  capitalize,
  formatCompactNumber,
  formatNumber,
  formatPercent
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam, sortTeamsForDemo } from '../utils/teams.js';

const DEMO_MEMBER_EMAILS = {
  'Maya Manager': 'manager.demo@cloudcomputing.local',
  'Ethan Employee': 'employee.one@cloudcomputing.local',
  'Priya Employee': 'employee.two@cloudcomputing.local'
};

export default async function profilePage(container, params = {}) {
  const user = getUser();
  renderHeader('Profile', isManager() ? 'Your manager identity, teams, and people context' : 'Your info, supervisors, and team context');
  clearElement(container);
  showLoading(container);

  try {
    const teamsResponse = await api.get('/teams');
    const teams = sortTeamsForDemo(getVisibleTeams(teamsResponse.data.teams || []));
    const preferredTeam = selectPreferredTeam(teams);

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
        const [dashboardRes, goalsRes] = await Promise.all([
          api.get(`/dashboards/manager?teamId=${preferredTeam.id}`),
          api.get(`/goals?teamId=${preferredTeam.id}&sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=4`)
        ]);

        context = {
          dashboard: dashboardRes.data,
          goals: goalsRes.data
        };
      } else {
        const [productivityRes, goalsRes] = await Promise.all([
          api.get(`/productivity-metrics?scope=individual&teamId=${preferredTeam.id}`),
          api.get(`/goals?teamId=${preferredTeam.id}&sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=4`)
        ]);

        context = {
          productivity: productivityRes.data,
          goals: goalsRes.data
        };
      }
    }

    clearElement(container);
    const profile = renderProfile({
      user,
      preferredTeam,
      teamBundles,
      context,
      onProfileUpdated: async () => profilePage(container, params)
    });
    const notificationsArchive = await buildNotificationArchiveSection({ open: params.section === 'notifications' });
    profile.appendChild(notificationsArchive);
    container.appendChild(profile);

    if (params.section === 'notifications') {
      requestAnimationFrame(() => {
        document.getElementById('notifications-archive')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

function renderProfile({ user, preferredTeam, teamBundles, context, onProfileUpdated }) {
  const roster = buildRoster(teamBundles);
  const leaders = roster.filter((member) => member.membershipRole === 'manager');
  const teammates = roster.filter((member) => member.id !== user.id);

  const hero = el('section', { className: 'page-hero profile-hero' },
    el('div', { className: 'profile-hero__identity' },
      avatarBadge(user.fullName),
      el('div', { className: 'profile-hero__copy' },
        el('p', { className: 'page-hero__eyebrow' }, isManager() ? 'Manager Profile' : 'Employee Profile'),
        el('h2', { className: 'page-hero__title' }, user.fullName),
        el('p', { className: 'page-hero__description' }, user.jobTitle || capitalize(user.appRole)),
        el('div', { className: 'page-hero__meta' },
          heroPill(`Role · ${capitalize(user.appRole)}`),
          preferredTeam ? heroPill(`Primary team · ${preferredTeam.name}`) : null
        )
      )
    ),
    profileActionCard(user, leaders)
  );

  return el('div', { className: 'profile-shell' },
    hero,
    isManager()
      ? renderManagerProfile({ user, preferredTeam, leaders, roster, context, onProfileUpdated })
      : renderEmployeeProfile({ user, preferredTeam, leaders, teammates, context, teamBundles, onProfileUpdated })
  );
}

function renderManagerProfile({ user, preferredTeam, leaders, roster, context, onProfileUpdated }) {
  const summary = context.dashboard?.summary || {};
  const goalsSummary = context.goals?.summary || {};
  const directReports = roster.filter((member) => member.appRole === 'employee').length;

  return el('div', {},
    el('div', { className: 'card-grid card-grid--dashboard' },
      summaryCard('Direct reports', formatCompactNumber(directReports), 'Employees visible across the current team context.'),
      summaryCard('Overdue tasks', formatCompactNumber(summary.overdueTaskCount || 0), 'Urgent items already past their due date.'),
      summaryCard('Active goals', formatCompactNumber(goalsSummary.activeGoalCount || 0), 'Quota targets still in progress.'),
      summaryCard('Completion rate', formatPercent(summary.completionRate || 0, 1), 'Task completion across the selected team.')
    ),
    el('div', { className: 'dashboard-layout' },
      sectionCard(
        'My profile details',
        'Your account overview and backend-saved profile controls.',
        profileDetailsPanel({
          user,
          preferredTeam,
          supportLabel: 'Direct reports',
          supportValue: formatNumber(directReports),
          photoAccess: 'Manager-controlled (planned)',
          directoryStatus: 'Roster visible',
          onProfileUpdated
        }),
        'dashboard-section--featured profile-details-card'
      ),
      sectionCard(
        'Leadership roster',
        'Manager peers and leads visible from your current team memberships.',
        leaders.length
          ? el('div', { className: 'member-grid profile-member-grid' }, ...leaders.map((member) => rosterCard(member)))
          : emptyState('No leaders found', 'No manager roster is available right now.')
      ),
      sectionCard(
        'People tools',
        'Profile photos and employee creation belong here in the finished product.',
        managerToolsCard()
      )
    )
  );
}

function renderEmployeeProfile({ user, preferredTeam, leaders, teammates, context, teamBundles, onProfileUpdated }) {
  const monthlyRollup = context.productivity?.rollups?.monthly || {};
  const goalsSummary = context.goals?.summary || {};
  const primaryTeamMembers = teamBundles.find((bundle) => bundle.team.id === preferredTeam?.id)?.members || [];
  const supervisors = leaders.filter((leader) => primaryTeamMembers.some((member) => member.id === leader.id));

  return el('div', {},
    el('div', { className: 'card-grid card-grid--dashboard' },
      summaryCard('Monthly tasks', formatCompactNumber(monthlyRollup.taskCount || 0), 'Tasks counted in the current month window.'),
      summaryCard('Completed', formatCompactNumber(monthlyRollup.completedTaskCount || 0), 'Tasks already finished this month.'),
      summaryCard('Completion rate', formatPercent(monthlyRollup.completionRate || 0, 1), 'Monthly task completion rate.'),
      summaryCard('Active goals', formatCompactNumber(goalsSummary.activeGoalCount || 0), 'Current team and personal goals in your scope.'),
      summaryCard('Supervisors', formatCompactNumber(supervisors.length), 'Managers visible on your primary team.')
    ),
    el('div', { className: 'dashboard-layout' },
      sectionCard(
        'My profile details',
        'Your own account, role, contact details, and backend-saved profile editor.',
        profileDetailsPanel({
          user,
          preferredTeam,
          supportLabel: 'Supervisors',
          supportValue: formatNumber(supervisors.length),
          photoAccess: 'Manager controlled',
          directoryStatus: 'Partial support',
          onProfileUpdated
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

function profileActionCard(user, leaders) {
  return el('div', { className: 'profile-action-card' },
    el('h3', {}, 'Access & Actions'),
    el('p', {}, isManager()
      ? 'You can manage team rosters now; employee photo controls remain planned.'
      : 'Your profile photo is manager-controlled in the final build.'
    ),
    el('div', { className: 'profile-action-card__grid' },
      metricStat('Email', user.email),
      metricStat('Primary team', user.teams?.[0]?.teamName || 'No team'),
      metricStat(isManager() ? 'Direct controls' : 'Supervisors', isManager() ? 'People tools' : formatNumber(leaders.length))
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

function profileDetailsPanel({ user, preferredTeam, supportLabel, supportValue, photoAccess, directoryStatus, onProfileUpdated }) {
  return el('div', { className: 'profile-details-panel' },
    profileDetailsFeature({ user, preferredTeam, supportLabel, supportValue, photoAccess, directoryStatus }),
    profileEditorCard(user, onProfileUpdated)
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

function profileEditorCard(user, onProfileUpdated) {
  let saveBtn;
  return el('form', {
    className: 'profile-editor-card',
    onSubmit: async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        firstName: form.querySelector('[name="firstName"]').value.trim(),
        lastName: form.querySelector('[name="lastName"]').value.trim(),
        jobTitle: form.querySelector('[name="jobTitle"]').value.trim() || null,
        dateOfBirth: form.querySelector('[name="dateOfBirth"]').value || null,
        address: form.querySelector('[name="address"]').value.trim() || null
      };

      saveBtn.disabled = true;
      try {
        const { data } = await api.patch('/users/me', payload);
        setUser(data.user);
        showSuccess('Profile updated successfully.');
        await onProfileUpdated?.();
      } catch (err) {
        showError(err);
        saveBtn.disabled = false;
      }
    }
  },
    el('div', { className: 'profile-editor-card__head' },
      el('div', { className: 'profile-editor-card__copy' },
        el('h5', {}, 'Edit profile information'),
        el('p', {}, 'Update your self-service profile fields through the backend.')
      ),
      el('span', { className: 'badge badge-success' }, 'Backend saved')
    ),
    el('div', { className: 'form-row' },
      formGroup('First name', 'firstName', 'text', user.firstName || '', 'Enter first name'),
      formGroup('Last name', 'lastName', 'text', user.lastName || '', 'Enter last name')
    ),
    el('div', { className: 'form-row' },
      formGroup('Date of birth', 'dateOfBirth', 'date', user.dateOfBirth || '', ''),
      formGroup('Role in company', 'jobTitle', 'text', user.jobTitle || '', 'Enter company role')
    ),
    textareaGroup('Address', 'address', user.address || '', 'Street address, city, state, ZIP'),
    el('div', { className: 'profile-editor-card__meta' },
      profileReadonlyField('App access role', capitalize(user.appRole)),
      profileReadonlyField('Email', user.email)
    ),
    el('div', { className: 'profile-editor-actions' },
      (saveBtn = el('button', { className: 'btn btn-primary', type: 'submit' }, 'Save Changes')),
      el('p', { className: 'profile-editor-note' }, 'Editable fields are saved with PATCH /api/v1/users/me.')
    )
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
