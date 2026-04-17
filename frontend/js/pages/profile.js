import { el, clearElement } from '../utils/dom.js';
import { getUser, isManager, setUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { buildNotificationArchiveSection } from '../components/notifications.js';
import {
  capitalize,
  formatNumber
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam, sortTeamsForDemo } from '../utils/teams.js';

const DEMO_MEMBER_EMAILS = {
  'Maya Manager': 'manager.demo@cloudcomputing.local',
  'Ethan Employee': 'employee.one@cloudcomputing.local',
  'Priya Employee': 'employee.two@cloudcomputing.local'
};

export default async function profilePage(container, params = {}) {
  const user = getUser();
  renderHeader(
    'Profile',
    isManager() ? 'Your account details and notification history.' : 'Your info, supervisors, and team context'
  );
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

    clearElement(container);
    const profile = renderProfile({
      user,
      preferredTeam,
      teamBundles,
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

function renderProfile({ user, preferredTeam, teamBundles, onProfileUpdated }) {
  const roster = buildRoster(teamBundles);
  const leaders = roster.filter((member) => member.membershipRole === 'manager');
  const teammates = roster.filter((member) => member.id !== user.id);
  const visibleTeamsCount = teamBundles.length;

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
    isManager()
      ? managerAccountCard({ user, preferredTeam, visibleTeamsCount })
      : profileActionCard(user, leaders)
  );

  return el('div', { className: `profile-shell${isManager() ? ' profile-shell--manager' : ''}` },
    hero,
    isManager()
      ? renderManagerProfile({ user, preferredTeam, visibleTeamsCount, onProfileUpdated })
      : renderEmployeeProfile({ user, preferredTeam, leaders, teammates, teamBundles, onProfileUpdated })
  );
}

function renderManagerProfile({ user, preferredTeam, visibleTeamsCount, onProfileUpdated }) {
  return el('div', { className: 'profile-stack-list' },
    sectionCard(
      'My profile details',
      'Update your account details and review the team context tied to your manager access.',
      profileDetailsPanel({
        user,
        preferredTeam,
        detailStats: [
          ['Visible teams', formatNumber(visibleTeamsCount)],
          ['Notifications', 'Past alerts below']
        ],
        onProfileUpdated
      }),
      'profile-details-card'
    )
  );
}

function renderEmployeeProfile({ user, preferredTeam, leaders, teammates, teamBundles, onProfileUpdated }) {
  const primaryTeamMembers = teamBundles.find((bundle) => bundle.team.id === preferredTeam?.id)?.members || [];
  const supervisors = leaders.filter((leader) => primaryTeamMembers.some((member) => member.id === leader.id));

  return el('div', { className: 'dashboard-layout' },
    sectionCard(
      'My profile details',
      'Your own account, role, contact details, and backend-saved profile editor.',
      profileDetailsPanel({
        user,
        preferredTeam,
        detailStats: [
          ['Supervisors', formatNumber(supervisors.length)],
          ['Visible teams', formatNumber(teamBundles.length)]
        ],
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
      ? 'You can manage team rosters, assign people, and review your directory from here.'
      : 'View your identity, team context, and supervisor contacts.'
    ),
    el('div', { className: 'profile-action-card__grid' },
      metricStat('Email', user.email),
      metricStat('Primary team', user.teams?.[0]?.teamName || 'No team'),
      metricStat(isManager() ? 'Team access' : 'Supervisors', isManager() ? 'Roster & directory' : formatNumber(leaders.length))
    )
  );
}

function managerAccountCard({ user, preferredTeam, visibleTeamsCount }) {
  return el('div', { className: 'profile-action-card profile-action-card--quiet' },
    el('h3', {}, 'Account context'),
    el('p', {}, 'A quiet summary of the account and team scope tied to your manager access.'),
    el('div', { className: 'profile-action-card__grid' },
      metricStat('Email', user.email),
      metricStat('Primary team', preferredTeam?.name || 'No team'),
      metricStat('Visible teams', formatNumber(visibleTeamsCount))
    )
  );
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

function profileDetailsPanel({ user, preferredTeam, detailStats = [], onProfileUpdated }) {
  return el('div', { className: 'profile-details-panel' },
    profileDetailsFeature({ user, preferredTeam, detailStats }),
    profileEditorCard(user, onProfileUpdated)
  );
}

function profileDetailsFeature({ user, preferredTeam, detailStats = [] }) {
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
      ...detailStats.map(([label, value]) => metricStat(label, value))
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
