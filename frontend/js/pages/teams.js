import { el, clearElement } from '../utils/dom.js';
import { getUser, isManager } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { openModal, closeModal } from '../components/modal.js';
import { showError, showSuccess } from '../components/toast.js';
import {
  capitalize,
  formatDate,
  formatDateRange,
  formatNumber,
  formatPercent
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam, sortTeamsForDemo } from '../utils/teams.js';
import {
  assignPeopleToTeam,
  buildAssignablePeople,
  createCustomTeam,
  getTeamDetail,
  getWorkspaceTeams,
  isLocalTeam,
  updateTeamRecord
} from '../utils/localTeams.js';

export default async function teamsPage(container, params) {
  if (params.teamId) {
    await renderTeamDetail(container, params.teamId);
  } else {
    await renderTeamList(container);
  }
}

async function renderTeamList(container) {
  renderHeader(isManager() ? 'Teams & People' : 'Teams', isManager() ? 'Open a team to inspect people, structure, and demo-ready details' : 'Your teams and teammates');
  clearElement(container);
  showLoading(container);

  try {
    const { data } = await api.get('/teams');
    clearElement(container);

    const baseTeams = sortTeamsForDemo(getVisibleTeams(data.teams || []));
    const teams = getWorkspaceTeams(baseTeams, getUser());
    const preferredTeam = selectPreferredTeam(teams);
    if (!teams.length) {
      container.appendChild(emptyState('No teams', 'You are not part of any teams yet.'));
      return;
    }

    if (teams.length === 1) {
      await renderTeamDetail(container, teams[0].id, { showBackButton: false });
      return;
    }

    const overview = el('section', { className: 'page-hero page-hero--compact' },
      el('div', { className: 'page-hero__content' },
        el('p', { className: 'page-hero__eyebrow' }, isManager() ? 'People Directory' : 'Team Overview'),
        el('h2', { className: 'page-hero__title' }, preferredTeam?.name || 'Your teams'),
        el('p', { className: 'page-hero__description' },
          preferredTeam?.description || 'Open a team to inspect the roster, identify supervisors, and review the current team structure.'
        )
      ),
      el('div', { className: 'page-hero__meta' },
        heroPill(`Visible teams · ${formatNumber(teams.length)}`),
        heroPill(`People directory · Ready`),
        preferredTeam ? heroPill(`Focused team · ${preferredTeam.name}`) : null
      )
    );

    const actions = isManager()
      ? el('div', { className: 'btn-group', style: 'margin-bottom:16px' },
          el('button', {
            className: 'btn btn-primary',
            type: 'button',
            onClick: async () => {
              const bundles = await loadTeamBundles(baseTeams);
              openTeamEditorModal({
                mode: 'create',
                availablePeople: buildAssignablePeople(bundles, getUser()),
                onSave: async ({ name, description, members }) => {
                  const created = createCustomTeam({
                    name,
                    description,
                    currentUser: getUser(),
                    selectedMembers: members
                  });
                  showSuccess('New team created in the frontend demo workspace.');
                  window.location.hash = `#/teams/${created.id}`;
                }
              });
            }
          }, '+ New Team')
        )
      : null;

    const grid = el('div', { className: 'team-grid' },
      ...teams.map((team) => el('div', {
        className: `team-card${preferredTeam?.id === team.id ? ' team-card--highlight' : ''}`,
        onClick: () => { window.location.hash = `#/teams/${team.id}`; }
      },
        el('div', { className: 'team-card__top' },
          el('h3', {}, team.name),
          el('div', { className: 'task-badges' },
            preferredTeam?.id === team.id ? el('span', { className: 'badge badge-primary' }, 'Demo ready') : null,
            team.isLocalTeam ? el('span', { className: 'badge badge-info' }, 'Local demo') : null
          )
        ),
        el('p', {}, team.description || 'No description'),
        el('div', { className: 'team-stats' },
          el('span', {}, `👥 ${team.memberCount ?? 0} members`),
          el('span', {}, `👔 ${team.managerCount ?? 0} managers`),
          team.canManageTeam ? el('span', { className: 'badge badge-info' }, 'Manageable') : null
        )
      ))
    );

    container.append(overview);
    if (actions) container.append(actions);
    container.append(grid);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

async function renderTeamDetail(container, teamId, { showBackButton = true } = {}) {
  renderHeader('Team Directory', 'Loading roster and team details');
  clearElement(container);
  showLoading(container);

  try {
    const currentUser = getUser();
    const { data: teamsData } = await api.get('/teams');
    const baseTeams = sortTeamsForDemo(getVisibleTeams(teamsData.teams || []));
    const workspaceTeams = getWorkspaceTeams(baseTeams, currentUser);
    const baseTeam = workspaceTeams.find((team) => team.id === teamId && !team.isLocalTeam) || null;
    const teamBundles = await loadTeamBundles(baseTeams);
    const availablePeople = buildAssignablePeople(teamBundles, currentUser);

    clearElement(container);

    let team = {};
    let members = [];

    if (isLocalTeam(teamId)) {
      const resolved = getTeamDetail(teamId, { currentUser });
      team = resolved.team;
      members = resolved.members;
    } else {
      const { data } = await api.get(`/teams/${teamId}/members`);
      const resolved = getTeamDetail(teamId, {
        baseTeam: baseTeam || data.team,
        baseMembers: data.members || [],
        currentUser
      });
      team = resolved.team;
      members = resolved.members;
    }

    const leaders = members.filter((member) => member.membershipRole === 'manager');
    const employees = members.filter((member) => member.membershipRole !== 'manager');

    renderHeader(team.name || 'Team Directory', isManager() ? 'People, leadership, and demo-ready team context' : 'Your team roster');

    const actionItems = [];
    if (showBackButton) {
      actionItems.push(
        el('button', { className: 'btn btn-outline', type: 'button', onClick: () => { window.location.hash = '#/teams'; } }, '← Back to Teams')
      );
    }
    if (isManager() && team.canManageTeam) {
      actionItems.push(
        el('button', {
          className: 'btn btn-primary',
          type: 'button',
          onClick: () => openTeamEditorModal({
            mode: 'create',
            availablePeople,
            onSave: async ({ name, description, members: selectedMembers }) => {
              const created = createCustomTeam({
                name,
                description,
                currentUser,
                selectedMembers
              });
              showSuccess('New team created in the frontend demo workspace.');
              window.location.hash = `#/teams/${created.id}`;
            }
          })
        }, 'Create Team'),
        el('button', {
          className: 'btn btn-outline',
          type: 'button',
          onClick: () => openTeamEditorModal({
            mode: 'edit',
            team,
            availablePeople,
            onSave: async ({ name, description }) => {
              updateTeamRecord(team.id, { name, description });
              showSuccess('Team details updated for this frontend demo.');
              await renderTeamDetail(container, team.id, { showBackButton });
            }
          })
        }, 'Edit Team'),
        el('button', {
          className: 'btn btn-outline',
          type: 'button',
          onClick: () => openAssignPeopleModal({
            team,
            availablePeople,
            onSave: async (selectedMembers) => {
              assignPeopleToTeam(team.id, selectedMembers, { teamName: team.name });
              showSuccess('People assigned to the team in this frontend demo.');
              await renderTeamDetail(container, team.id, { showBackButton });
            }
          })
        }, 'Assign People'),
        el('button', { className: 'btn btn-primary', type: 'button', onClick: () => openSupportModal('Add Employee', addEmployeeRequirements()) }, 'Add Employee'),
        el('button', { className: 'btn btn-outline', type: 'button', onClick: () => openSupportModal('Profile Photos', photoRequirements()) }, 'Photo Controls')
      );
    }

    const actions = actionItems.length ? el('div', { className: 'btn-group' }, ...actionItems) : null;

    const hero = el('section', { className: 'page-hero page-hero--compact' },
      el('div', { className: 'page-hero__content' },
        el('p', { className: 'page-hero__eyebrow' }, team.canManageTeam ? 'Manager Team View' : 'Team View'),
        el('h2', { className: 'page-hero__title' }, team.name || 'Team'),
        el('p', { className: 'page-hero__description' }, team.description || 'Inspect your team roster, leadership structure, and profile-ready people details.')
      ),
      el('div', { className: 'page-hero__meta' },
        heroPill(`Members · ${formatNumber(team.memberCount || members.length)}`),
        heroPill(`Managers · ${formatNumber(team.managerCount || leaders.length)}`),
        heroPill(`Directory · ${team.canManageTeam ? 'Manager tools ready' : 'Roster view'}`),
        team.isLocalTeam ? heroPill('Source · Local demo team') : null
      )
    );

    const layout = el('div', { className: 'dashboard-layout', style: 'margin-top:20px' },
        sectionCard(
          'Leadership',
          'Managers are listed first so employees can quickly identify their supervisors.',
          leaders.length
            ? el('div', { className: 'member-grid profile-member-grid' },
                ...leaders.map((member) => personCard(member, () => openMemberDetailModal({ team, member })))
              )
            : emptyState('No managers found', 'No manager roster was returned for this team.')
        ),
        sectionCard(
          'Employees',
          isManager()
            ? 'Click an employee to open their task and goal snapshot.'
            : 'Your teammate roster for this team.',
          employees.length
            ? el('div', { className: 'member-grid profile-member-grid' },
                ...employees.map((member) => personCard(member, () => openMemberDetailModal({ team, member })))
              )
            : emptyState('No employees found', 'No employee roster was returned for this team.')
        ),
        sectionCard(
          'People tools',
          'The frontend flow is ready for contact and profile management, but some actions still need backend support.',
          el('div', { className: 'support-card' },
            el('p', {}, 'Right now you can inspect roster roles and profile snapshots. New employee creation, avatar uploads, and full team email contact lists still need backend endpoints.'),
            team.canManageTeam
              ? el('div', { className: 'btn-group', style: 'margin-top:12px' },
                  el('button', { className: 'btn btn-primary', type: 'button', onClick: () => openSupportModal('Add Employee', addEmployeeRequirements()) }, 'Add Employee'),
                  el('button', { className: 'btn btn-outline', type: 'button', onClick: () => openSupportModal('Email Directory', emailRequirements()) }, 'Contact Data')
                )
              : null
          )
        )
      );

    container.append(hero);
    if (actions) container.append(actions);
    container.append(layout);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

async function loadTeamBundles(baseTeams) {
  return Promise.all(
    baseTeams.map(async (team) => {
      try {
        const { data } = await api.get(`/teams/${team.id}/members`);
        return { team, members: data.members || [] };
      } catch {
        return { team, members: [] };
      }
    })
  );
}

function openTeamEditorModal({ mode, team = null, availablePeople = [], onSave }) {
  const nameInput = el('input', {
    className: 'form-input',
    name: 'teamName',
    value: team?.name || '',
    placeholder: 'Physical Ops Team'
  });
  const descriptionInput = el('textarea', {
    className: 'form-textarea',
    name: 'teamDescription',
    placeholder: 'Short description for this team.'
  }, team?.description || '');

  const list = mode === 'create'
    ? el('div', { className: 'team-member-picker' },
        ...availablePeople.map((person) => el('label', { className: 'team-member-picker__item' },
          el('input', { type: 'checkbox', value: person.id }),
          el('div', {},
            el('strong', {}, person.fullName),
            el('span', {}, person.jobTitle || capitalize(person.appRole))
          )
        ))
      )
    : null;

  const form = el('form', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Team name'),
      nameInput
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Description'),
      descriptionInput
    ),
    list
      ? el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Assign people now'),
          list
        )
      : null
  );

  const saveBtn = el('button', { className: 'btn btn-primary', type: 'button' }, mode === 'create' ? 'Create Team' : 'Save Team');
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showError('Team name is required.');
      return;
    }

    const selectedMembers = list
      ? availablePeople.filter((person) => list.querySelector(`input[value="${person.id}"]`)?.checked)
      : [];

    await onSave({
      name,
      description: descriptionInput.value.trim(),
      members: selectedMembers
    });
    closeModal();
  });

  openModal(
    mode === 'create' ? 'Create New Team' : 'Edit Team',
    form,
    el('div', { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', type: 'button', onClick: closeModal }, 'Cancel'),
      saveBtn
    )
  );
}

function openAssignPeopleModal({ team, availablePeople = [], onSave }) {
  const picker = el('div', { className: 'team-member-picker' },
    ...availablePeople.map((person) => el('label', { className: 'team-member-picker__item' },
      el('input', { type: 'checkbox', value: person.id }),
      el('div', {},
        el('strong', {}, person.fullName),
        el('span', {}, person.jobTitle || capitalize(person.appRole))
      )
    ))
  );

  const saveBtn = el('button', { className: 'btn btn-primary', type: 'button' }, 'Assign People');
  saveBtn.addEventListener('click', async () => {
    const selectedMembers = availablePeople.filter((person) => picker.querySelector(`input[value="${person.id}"]`)?.checked);
    if (!selectedMembers.length) {
      showError('Select at least one person to assign.');
      return;
    }

    await onSave(selectedMembers);
    closeModal();
  });

  openModal(
    `Assign People · ${team.name}`,
    el('div', {},
      el('p', { style: 'margin-bottom:12px' }, 'Assigning people here is frontend-only for the demo and does not change the backend team table.'),
      picker
    ),
    el('div', { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', type: 'button', onClick: closeModal }, 'Cancel'),
      saveBtn
    )
  );
}

function personCard(member, onClick) {
  return el('div', { className: 'member-card member-card--dashboard member-card--interactive', onClick },
    el('div', { className: 'member-avatar' }, initials(member.fullName)),
    el('div', { className: 'member-info' },
      el('h4', {}, member.fullName || `${member.firstName} ${member.lastName}`),
      el('p', {}, member.jobTitle || 'Team member'),
      el('span', { className: `badge badge-${member.membershipRole === 'manager' ? 'primary' : 'info'}` }, capitalize(member.membershipRole || member.appRole))
    )
  );
}

async function openMemberDetailModal({ team, member }) {
  const body = el('div', { className: 'profile-modal-shell' });
  showLoading(body);

  openModal(
    member.fullName || `${member.firstName} ${member.lastName}`,
    body,
    el('div', { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', type: 'button', onClick: closeModal }, 'Close')
    )
  );

  try {
    const canInspectInDepth = isManager() && team.canManageTeam;
    const isSelf = member.id === getUser().id;
    const requests = [];

    if (canInspectInDepth || isSelf) {
      requests.push(
        api.get(`/productivity-metrics?scope=individual&teamId=${team.id}${canInspectInDepth ? `&userId=${member.id}` : ''}`),
        api.get(`/tasks?teamId=${team.id}${canInspectInDepth ? `&assigneeUserId=${member.id}` : ''}&sortBy=urgency&sortOrder=asc&includeCompleted=true&page=1&limit=6`),
        api.get(`/goals?teamId=${team.id}${canInspectInDepth ? `&userId=${member.id}&scope=user` : ''}&sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=6`)
      );
    }

    const [productivityRes, tasksRes, goalsRes] = requests.length ? await Promise.all(requests) : [];
    clearElement(body);

    const productivity = productivityRes?.data || {};
    const tasks = tasksRes?.data?.tasks || [];
    const goals = goalsRes?.data?.goals || [];
    const email = isSelf
      ? getUser().email
      : tasks.find((task) => task.assignment?.assigneeUserId === member.id)?.assignment?.assigneeEmail ||
        goals.find((goal) => goal.targetUser?.id === member.id)?.targetUser?.email ||
        null;

    body.appendChild(el('div', { className: 'profile-modal-header' },
      avatarBadge(member.fullName),
      el('div', { className: 'profile-modal-header__copy' },
        el('h3', {}, member.fullName),
        el('p', {}, member.jobTitle || capitalize(member.appRole)),
        el('div', { className: 'page-hero__meta', style: 'margin-top:10px' },
          heroPill(`Team · ${team.name}`),
          heroPill(`Role · ${capitalize(member.membershipRole || member.appRole)}`),
          email ? heroPill(`Email · ${email}`) : heroPill('Email · Backend needed')
        )
      )
    ));

    if (!canInspectInDepth && !isSelf) {
      body.appendChild(el('div', { className: 'support-card', style: 'margin-top:18px' },
        el('p', {}, 'Employees can see who is on the team, but detailed teammate metrics and full contact information are reserved for manager views with backend support.')
      ));
      return;
    }

    if (productivity.rollups?.monthly || goals.length || tasks.length) {
      const monthly = productivity.rollups?.monthly || {};
      body.appendChild(el('div', { className: 'card-grid card-grid--dashboard', style: 'margin:18px 0' },
        summaryCard('Monthly tasks', formatNumber(monthly.taskCount || 0), 'Tasks in the current month window.'),
        summaryCard('Completed', formatNumber(monthly.completedTaskCount || 0), 'Completed tasks in the current month.'),
        summaryCard('Open', formatNumber(monthly.openTaskCount || 0), 'Open tasks still in progress.'),
        summaryCard('Completion rate', formatPercent(monthly.completionRate || 0, 1), 'Task completion rate in the current month.')
      ));
    }

    body.appendChild(el('div', { className: 'profile-modal-grid' },
      detailCard(
        'Assigned tasks',
        tasks.length
          ? el('div', { className: 'breakdown-list' },
              ...tasks.slice(0, 4).map((task) => el('div', { className: 'breakdown-item' },
                el('div', { className: 'breakdown-item__copy' },
                  el('strong', {}, task.title),
                  el('span', {}, `${capitalize(task.status)} · ${task.dueAt ? formatDate(task.dueAt) : 'No due date'}`)
                )
              ))
            )
          : emptyState('No task details', 'No assigned tasks were returned for this person.')
      ),
      detailCard(
        'Goals',
        goals.length
          ? el('div', { className: 'breakdown-list' },
              ...goals.slice(0, 4).map((goal) => el('div', { className: 'breakdown-item' },
                el('div', { className: 'breakdown-item__copy' },
                  el('strong', {}, goal.title),
                  el('span', {}, `${formatPercent(goal.progressPercent || 0, 1)} · ${formatDateRange(goal.startDate, goal.endDate)}`)
                )
              ))
            )
          : emptyState('No user goals', 'No user-scoped goals were returned for this person.')
      ),
      detailCard(
        'Profile overview',
        metricsPanel([
          ['Team', team.name],
          ['Role', capitalize(member.membershipRole || member.appRole)],
          ['Completion rate', formatPercent(productivity.rollups?.monthly?.completionRate || 0, 1)],
          ['Average progress', formatPercent(productivity.rollups?.monthly?.averageProgressPercent || 0, 1)]
        ])
      )
    ));

    if (!email) {
      body.appendChild(el('div', { className: 'support-card', style: 'margin-top:18px' },
        el('p', {}, 'This person’s email is not reliably available in the current backend team-member response. A dedicated contact endpoint would make the directory complete.')
      ));
    }
  } catch (err) {
    clearElement(body);
    body.appendChild(emptyState('Unable to load profile', err.message || 'This person could not be loaded right now.'));
  }
}

function detailCard(title, body) {
  return el('section', { className: 'profile-inline-card' },
    el('strong', {}, title),
    el('div', { style: 'margin-top:12px' }, body)
  );
}

function heroPill(text) {
  return el('span', { className: 'hero-pill' }, text);
}

function avatarBadge(name) {
  return el('div', { className: 'profile-avatar profile-avatar--sm' }, initials(name));
}

function sectionCard(title, subtitle, body) {
  return el('section', { className: 'dashboard-section card' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, title),
        el('p', { className: 'section-subtitle' }, subtitle)
      )
    ),
    body
  );
}

function summaryCard(label, value, note) {
  return el('div', { className: 'card dashboard-stat-card' },
    el('div', { className: 'card-title' }, label),
    el('div', { className: 'card-value' }, value),
    el('div', { className: 'card-footer' }, note)
  );
}

function openSupportModal(title, items) {
  openModal(title, el('div', { className: 'support-modal' },
    el('p', {}, 'This frontend entry point is placed intentionally, but these backend capabilities still need to be added:'),
    el('ul', { className: 'support-list' }, ...items.map((item) => el('li', {}, item)))
  ), el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-primary', type: 'button', onClick: closeModal }, 'Close')
  ));
}

function addEmployeeRequirements() {
  return [
    'Create employee account endpoint',
    'Create user profile and assign team membership endpoint',
    'Return the created employee in team-member responses',
    'Optional create-time avatar upload support'
  ];
}

function photoRequirements() {
  return [
    'User avatar upload endpoint',
    'Stored avatar URL returned in auth and team-member payloads',
    'Manager-only permission for employee photo changes'
  ];
}

function emailRequirements() {
  return [
    'Expose member email in /teams/:teamId/members or provide a dedicated people endpoint',
    'Return contact preferences if you want richer team contact cards'
  ];
}

function metricsPanel(items) {
  return el('div', { className: 'metrics-panel' },
    ...items.map(([label, value]) => el('div', { className: 'metrics-panel__item' },
      el('span', { className: 'metrics-panel__label' }, label),
      el('strong', { className: 'metrics-panel__value' }, value)
    ))
  );
}

function initials(name) {
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
}
