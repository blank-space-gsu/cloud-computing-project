import { el, clearElement } from '../utils/dom.js';
import { getUser, isEmployee, isManager, refreshCurrentUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { openModal, closeModal } from '../components/modal.js';
import { showError, showSuccess } from '../components/toast.js';
import {
  capitalize,
  formatDate,
  formatNumber
} from '../utils/format.js';
import { selectPreferredTeam } from '../utils/teams.js';
import {
  buildAssignablePeople,
  getTeamDetail,
  getWorkspaceTeams,
  isLocalTeam
} from '../utils/localTeams.js';

export default async function teamsPage(container, params) {
  if (params.teamId) {
    await renderTeamDetail(container, params.teamId);
  } else {
    await renderTeamList(container);
  }
}

async function renderTeamList(container) {
  renderHeader('Teams', isManager() ? 'Rosters and membership' : 'Your teams and teammates');
  clearElement(container);
  showLoading(container);

  try {
    const { data } = await api.get('/teams');
    clearElement(container);

    const baseTeams = data.teams || [];
    const teams = getWorkspaceTeams(baseTeams, getUser());
    const preferredTeam = selectPreferredTeam(teams);
    if (!teams.length) {
      const shellEmpty = el('div', { className: 'mteams' });
      shellEmpty.appendChild(el('section', { className: 'mteams-top' },
        el('div', { className: 'mteams-top__heading' },
          el('h2', { className: 'mteams-top__title' }, 'Your teams'),
          el('p', { className: 'mteams-top__sub' },
            isEmployee() ? 'No team memberships yet.' : 'You are not part of any teams yet.'
          )
        )
      ));

      const emptyPanel = el('div', { className: 'mteams-empty' },
        el('h4', {}, 'No teams yet'),
        el('p', {},
          isEmployee()
            ? 'Use a join code or invite link to join your first team.'
            : 'You are not part of any teams yet.'
        )
      );

      if (isEmployee()) {
        emptyPanel.appendChild(el('div', { className: 'mteams-empty__action' },
          el('button', {
            className: 'mteams-btn mteams-btn--primary',
            type: 'button',
            onClick: () => { window.location.hash = '#/join'; }
          }, 'Join a Team')
        ));
      }

      shellEmpty.appendChild(emptyPanel);
      container.appendChild(shellEmpty);
      return;
    }

    if (teams.length === 1) {
      await renderTeamDetail(container, teams[0].id, { showBackButton: false });
      return;
    }

    const totalPeople = teams.reduce((sum, team) => sum + Number(team.memberCount || 0), 0);

    const shell = el('div', { className: 'mteams' });

    const heading = el('div', { className: 'mteams-top__heading' },
      el('h2', { className: 'mteams-top__title' }, isManager() ? 'Your teams' : 'Your teams'),
      el('p', { className: 'mteams-top__sub' },
        `${formatNumber(teams.length)} team${teams.length === 1 ? '' : 's'} \u00b7 ${formatNumber(totalPeople)} ${totalPeople === 1 ? 'person' : 'people'} in view`
      )
    );

    const actionCluster = el('div', { className: 'mteams-top__actions' });
    if (isManager()) {
      actionCluster.appendChild(el('button', {
        className: 'mteams-btn mteams-btn--primary',
        type: 'button',
        onClick: async () => {
          const bundles = await loadTeamBundles(baseTeams);
          openTeamEditorModal({
            mode: 'create',
            availablePeople: buildAssignablePeople(bundles, getUser()),
            onSave: async ({ name, description, members }) => {
              const created = await createPersistedTeam({ name, description, members });
              showSuccess('New team created successfully.');
              window.location.hash = `#/teams/${created.id}`;
            }
          });
        }
      }, '+ New Team'));
    }

    shell.appendChild(el('section', { className: 'mteams-top' }, heading, actionCluster));

    const grid = el('div', { className: 'mteams-grid' },
      ...teams.map((team) => el('article', {
        className: `mteams-team${preferredTeam?.id === team.id ? ' is-primary' : ''}`,
        onClick: () => { window.location.hash = `#/teams/${team.id}`; }
      },
        el('div', { className: 'mteams-team__head' },
          el('h3', { className: 'mteams-team__name' }, team.name),
          team.isLocalTeam
            ? el('span', { className: 'mteams-chip mteams-chip--custom' }, 'Custom')
            : null
        ),
        el('p', { className: 'mteams-team__desc' }, team.description || 'No description'),
        el('div', { className: 'mteams-team__stats' },
          el('span', { className: 'mteams-team__stat' },
            el('span', { className: 'mteams-team__stat-num' }, String(team.memberCount ?? 0)),
            el('span', { className: 'mteams-team__stat-label' }, (team.memberCount ?? 0) === 1 ? 'member' : 'members')
          ),
          el('span', { className: 'mteams-team__stat' },
            el('span', { className: 'mteams-team__stat-num' }, String(team.managerCount ?? 0)),
            el('span', { className: 'mteams-team__stat-label' }, (team.managerCount ?? 0) === 1 ? 'manager' : 'managers')
          )
        )
      ))
    );

    shell.appendChild(grid);
    container.appendChild(shell);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

async function renderTeamDetail(container, teamId, { showBackButton = true } = {}) {
  renderHeader('Team', 'Roster and membership');
  clearElement(container);
  showLoading(container);

  try {
    const currentUser = getUser();
    const { data: teamsData } = await api.get('/teams');
    const baseTeams = teamsData.teams || [];
    const workspaceTeams = getWorkspaceTeams(baseTeams, currentUser);
    const baseTeam = workspaceTeams.find((team) => team.id === teamId && !team.isLocalTeam) || null;
    const teamBundles = await loadTeamBundles(baseTeams);
    const availablePeople = buildAssignablePeople(teamBundles, currentUser);

    clearElement(container);

    let team = {};
    let members = [];
    let joinAccess = null;

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

      if (isManager() && team.canManageTeam) {
        try {
          const joinAccessResponse = await api.get(`/teams/${teamId}/join-access`);
          joinAccess = joinAccessResponse.data.joinAccess || null;
        } catch (joinAccessError) {
          showError(joinAccessError);
        }
      }
    }

    const leaders = members.filter((member) => member.membershipRole === 'manager');
    const employees = members.filter((member) => member.membershipRole !== 'manager');
    const currentMember = members.find((member) => member.id === currentUser.id) || null;
    const currentMemberIds = new Set(members.map((member) => member.id));
    const assignablePeople = availablePeople.filter((person) => !currentMemberIds.has(person.id));

    renderHeader(team.name || 'Team', isManager() ? 'Roster and membership' : 'Your team roster');

    const shell = el('div', { className: 'mteams mteams--detail' });

    // --- Detail top (back + title + meta + actions) --------------------
    const topHeading = el('div', { className: 'mteams-top__heading' },
      el('h2', { className: 'mteams-top__title' }, team.name || 'Team'),
      el('p', { className: 'mteams-top__sub' },
        `${formatNumber(team.memberCount || members.length)} members \u00b7 ${formatNumber(team.managerCount || leaders.length)} manager${(team.managerCount || leaders.length) === 1 ? '' : 's'}${team.isLocalTeam ? ' \u00b7 Custom team' : ''}`
      )
    );

    const topActions = el('div', { className: 'mteams-top__actions' });
    if (showBackButton) {
      topActions.appendChild(el('button', {
        className: 'mteams-btn mteams-btn--ghost',
        type: 'button',
        onClick: () => { window.location.hash = '#/teams'; }
      }, '\u2039 Teams'));
    }
    if (isEmployee() && !team.isLocalTeam && currentMember?.membershipRole !== 'manager') {
      topActions.appendChild(el('button', {
        className: 'mteams-btn mteams-btn--ghost',
        type: 'button',
        onClick: () => leavePersistedTeam({ team, member: currentMember })
      }, 'Leave team'));
    }
    if (isManager() && team.canManageTeam) {
      topActions.appendChild(el('button', {
        className: 'mteams-btn mteams-btn--ghost',
        type: 'button',
        onClick: () => openTeamEditorModal({
          mode: 'edit',
          team,
          availablePeople,
          onSave: async ({ name, description }) => {
            await updatePersistedTeam(team.id, { name, description });
            showSuccess('Team details updated successfully.');
            await renderTeamDetail(container, team.id, { showBackButton });
          }
        })
      }, 'Edit team'));
      topActions.appendChild(el('button', {
        className: 'mteams-btn mteams-btn--primary',
        type: 'button',
        onClick: () => openAssignPeopleModal({
          team,
          availablePeople: assignablePeople,
          onSave: async (selectedMembers) => {
            await addPersistedTeamMembers(team.id, selectedMembers);
            showSuccess('People assigned to the team successfully.');
            await renderTeamDetail(container, team.id, { showBackButton });
          }
        })
      }, '+ Assign people'));
    }

    shell.appendChild(el('section', { className: 'mteams-top' }, topHeading, topActions));

    if (team.description) {
      shell.appendChild(el('p', { className: 'mteams-desc' }, team.description));
    }

    // --- Join access section ------------------------------------------
    if (joinAccess) {
      shell.appendChild(buildMteamsSection('Join access', 'Share a code or link so employees can join directly.',
        buildJoinAccessCard({
          team,
          joinAccess,
          onRegenerate: async () => {
            const confirmed = window.confirm(`Regenerate join access for ${team.name}? Existing links and codes will stop working.`);
            if (!confirmed) return;
            try {
              await api.post(`/teams/${team.id}/join-access/regenerate`);
              showSuccess('Join access regenerated successfully.');
              await renderTeamDetail(container, team.id, { showBackButton });
            } catch (error) {
              showError(error);
            }
          }
        })
      ));
    }

    // --- Leadership ----------------------------------------------------
    shell.appendChild(buildMteamsSection(
      'Leadership',
      `${leaders.length} manager${leaders.length === 1 ? '' : 's'}`,
      leaders.length
        ? buildMemberList(leaders, { team, onClickMember: (member) => openMemberDetailModal({ team, member }) })
        : buildMteamsEmpty('No managers listed', 'No manager roster was returned for this team.')
    ));

    // --- Employees -----------------------------------------------------
    shell.appendChild(buildMteamsSection(
      'Employees',
      `${employees.length} ${employees.length === 1 ? 'person' : 'people'}`,
      employees.length
        ? buildMemberList(employees, {
            team,
            onClickMember: (member) => openMemberDetailModal({ team, member }),
            getAction: (member) => (team.canManageTeam && !team.isLocalTeam)
              ? {
                  label: 'Remove',
                  tone: 'danger',
                  onClick: () => removePersistedTeamMember({ container, team, member, showBackButton })
                }
              : null
          })
        : buildMteamsEmpty('No employees listed', 'No employee roster was returned for this team.')
    ));

    container.appendChild(shell);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

function buildMteamsSection(title, meta, body) {
  const header = el('header', { className: 'mteams-section__header' },
    el('h3', { className: 'mteams-section__title' }, title)
  );
  if (meta) {
    header.appendChild(el('span', { className: 'mteams-section__meta' }, meta));
  }
  return el('section', { className: 'mteams-section' }, header, body);
}

function buildMteamsEmpty(title, subtitle) {
  return el('div', { className: 'mteams-empty' },
    el('h4', {}, title),
    el('p', {}, subtitle)
  );
}

function buildMemberList(people, { team, onClickMember, getAction } = {}) {
  const list = el('div', { className: 'mteams-member-list' });
  for (const member of people) {
    const row = el('article', {
      className: 'mteams-member',
      onClick: () => onClickMember?.(member)
    });
    row.appendChild(el('span', { className: 'mteams-member__avatar', 'aria-hidden': 'true' }, initials(member.fullName)));

    const body = el('div', { className: 'mteams-member__body' },
      el('span', { className: 'mteams-member__name' }, member.fullName || `${member.firstName} ${member.lastName}`),
      el('span', { className: 'mteams-member__title' }, member.jobTitle || 'Team member')
    );
    row.appendChild(body);

    const chips = el('div', { className: 'mteams-member__chips' });
    const isManagerRow = member.membershipRole === 'manager';
    chips.appendChild(el('span', {
      className: `mteams-chip${isManagerRow ? ' mteams-chip--manager' : ''}`
    }, capitalize(member.membershipRole || member.appRole)));
    row.appendChild(chips);

    const action = typeof getAction === 'function' ? getAction(member) : null;
    if (action) {
      const btn = el('button', {
        className: `mteams-btn mteams-btn--icon${action.tone === 'danger' ? ' mteams-btn--danger' : ''}`,
        type: 'button',
        title: action.label,
        'aria-label': action.label,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          action.onClick(member);
        }
      }, '\u00d7');
      row.appendChild(btn);
    }

    list.appendChild(row);
  }
  return list;
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

async function createPersistedTeam({ name, description, members = [] }) {
  const { data } = await api.post('/teams', {
    name,
    description: description || null
  });
  const team = data.team;

  await addPersistedTeamMembers(team.id, members);

  return team;
}

async function updatePersistedTeam(teamId, { name, description }) {
  const { data } = await api.patch(`/teams/${teamId}`, {
    name,
    description: description || null
  });

  return data.team;
}

async function addPersistedTeamMembers(teamId, members = []) {
  for (const member of members) {
    await api.post(`/teams/${teamId}/members`, {
      userId: member.id,
      membershipRole: 'member'
    });
  }
}

async function removePersistedTeamMember({ container, team, member, showBackButton }) {
  const name = member.fullName || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'this member';
  const confirmed = window.confirm(`Remove ${name} from ${team.name}?`);
  if (!confirmed) return;

  try {
    await api.del(`/teams/${team.id}/members/${member.id}`);
    showSuccess('Team member removed successfully.');
    await renderTeamDetail(container, team.id, { showBackButton });
  } catch (err) {
    showError(err);
  }
}

async function leavePersistedTeam({ team, member }) {
  if (!member || member.membershipRole === 'manager') {
    return;
  }

  const confirmed = window.confirm(`Leave ${team.name}? You can rejoin later with a valid code or invite link.`);
  if (!confirmed) {
    return;
  }

  try {
    const response = await api.post(`/teams/${team.id}/members/me/leave`);
    const updatedUser = await refreshCurrentUser();
    showSuccess(response.message || 'Team left successfully.');
    window.location.hash = updatedUser?.teams?.length ? '#/teams' : '#/join';
  } catch (error) {
    showError(error);
  }
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

    saveBtn.disabled = true;
    try {
      await onSave({
        name,
        description: descriptionInput.value.trim(),
        members: selectedMembers
      });
      closeModal();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
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
  const picker = availablePeople.length
    ? el('div', { className: 'team-member-picker' },
        ...availablePeople.map((person) => el('label', { className: 'team-member-picker__item' },
          el('input', { type: 'checkbox', value: person.id }),
          el('div', {},
            el('strong', {}, person.fullName),
            el('span', {}, person.jobTitle || capitalize(person.appRole))
          )
        ))
      )
    : emptyState('No available people', 'Everyone visible to this manager is already on this team.');

  const saveBtn = el('button', { className: 'btn btn-primary', type: 'button' }, 'Assign People');
  saveBtn.disabled = !availablePeople.length;
  saveBtn.addEventListener('click', async () => {
    if (!availablePeople.length) return;
    const selectedMembers = availablePeople.filter((person) => picker.querySelector(`input[value="${person.id}"]`)?.checked);
    if (!selectedMembers.length) {
      showError('Select at least one person to assign.');
      return;
    }

    saveBtn.disabled = true;
    try {
      await onSave(selectedMembers);
      closeModal();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal(
    `Assign People · ${team.name}`,
    el('div', {},
      el('p', { style: 'margin-bottom:12px' }, 'Assigning people here updates the backend team membership table.'),
      picker
    ),
    el('div', { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', type: 'button', onClick: closeModal }, 'Cancel'),
      saveBtn
    )
  );
}

function personCard(member, onClick, { action = null } = {}) {
  return el('div', { className: 'member-card member-card--dashboard member-card--interactive', onClick },
    el('div', { className: 'member-avatar' }, initials(member.fullName)),
    el('div', { className: 'member-info' },
      el('h4', {}, member.fullName || `${member.firstName} ${member.lastName}`),
      el('p', {}, member.jobTitle || 'Team member'),
      el('span', { className: `badge badge-${member.membershipRole === 'manager' ? 'primary' : 'info'}` }, capitalize(member.membershipRole || member.appRole)),
      action
        ? el('button', {
            className: action.className || 'btn btn-sm btn-outline',
            type: 'button',
            style: 'margin-top:10px',
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
              action.onClick(member);
            }
          }, action.label)
        : null
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
    if (canInspectInDepth) {
      const { data } = await api.get(`/tasks?teamId=${team.id}&assigneeUserId=${member.id}&sortBy=urgency&sortOrder=asc&includeCompleted=true&page=1&limit=4`);
      clearElement(body);

      const tasks = data?.tasks || [];
      const email =
        member.email ||
        tasks.find((task) => task.assignment?.assigneeUserId === member.id)?.assignment?.assigneeEmail ||
        null;

      body.appendChild(memberModalHeader({ team, member, email }));
      body.appendChild(el('div', { className: 'profile-modal-grid profile-modal-grid--compact' },
        detailCard(
          'Task snapshot',
          tasks.length
            ? el('div', { className: 'breakdown-list' },
                ...tasks.map((task) => el('div', { className: 'breakdown-item' },
                  el('div', { className: 'breakdown-item__copy' },
                    el('strong', {}, task.title),
                    el('span', {}, `${capitalize(task.status)} · ${task.dueAt ? formatDate(task.dueAt) : 'No due date'}`)
                  )
                ))
              )
            : emptyState('No assigned tasks', 'No current tasks were returned for this person.')
        )
      ));
      return;
    }

    clearElement(body);
    const email = isSelf ? getUser().email : member.email || null;

    body.appendChild(memberModalHeader({ team, member, email }));

    if (!canInspectInDepth && !isSelf) {
      body.appendChild(el('div', { className: 'support-card', style: 'margin-top:18px' },
        el('p', {}, 'You can see who is on the team here. Managers can handle assignment and roster decisions from Worker Tracker and Teams.')
      ));
      return;
    }

    body.appendChild(el('div', { className: 'profile-modal-grid profile-modal-grid--compact' },
      detailCard(
        'Team context',
        metricsPanel([
          ['Team', team.name],
          ['Role', capitalize(member.membershipRole || member.appRole)],
          ['Visible roster', `${formatNumber(team.memberCount || 0)} members`]
        ])
      )
    ));
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

function buildJoinAccessCard({ team, joinAccess, onRegenerate }) {
  return el('div', { className: 'join-access-card' },
    joinAccessRow(
      'Join code',
      joinAccess.joinCode || 'Unavailable',
      'Share this code with employees who should join this team.',
      joinAccess.joinCode
        ? el('button', {
            className: 'btn btn-outline btn-sm',
            type: 'button',
            onClick: () => copyToClipboard(joinAccess.joinCode, `Copied ${team.name} join code.`)
          }, 'Copy code')
        : null
    ),
    joinAccessRow(
      'Invite link',
      joinAccess.inviteUrl || 'Unavailable',
      'Employees can open this link while signed in to join directly.',
      el('div', { className: 'btn-group' },
        joinAccess.inviteUrl
          ? el('button', {
              className: 'btn btn-outline btn-sm',
              type: 'button',
              onClick: () => copyToClipboard(joinAccess.inviteUrl, 'Copied invite link.')
            }, 'Copy link')
          : null,
        el('button', {
          className: 'btn btn-outline btn-sm',
          type: 'button',
          onClick: onRegenerate
        }, joinAccess.inviteUrl ? 'Regenerate' : 'Generate access')
      )
    )
  );
}

function joinAccessRow(label, value, note, action) {
  return el('div', { className: 'join-access-row' },
    el('div', { className: 'join-access-row__copy' },
      el('span', { className: 'join-access-row__label' }, label),
      el('strong', { className: 'join-access-row__value', title: value }, value),
      el('span', { className: 'join-access-row__note' }, note)
    ),
    action ? el('div', { className: 'join-access-row__action' }, action) : null
  );
}

async function copyToClipboard(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    showSuccess(successMessage);
  } catch {
    window.prompt('Copy this value:', value);
  }
}

function memberModalHeader({ team, member, email = null }) {
  const pills = [
    heroPill(`Team · ${team.name}`),
    heroPill(`Role · ${capitalize(member.membershipRole || member.appRole)}`)
  ];

  if (email) {
    pills.push(heroPill(`Email · ${email}`));
  }

  return el('div', { className: 'profile-modal-header' },
    avatarBadge(member.fullName),
    el('div', { className: 'profile-modal-header__copy' },
      el('h3', {}, member.fullName),
      el('p', {}, member.jobTitle || capitalize(member.appRole)),
      el('div', { className: 'page-hero__meta', style: 'margin-top:10px' }, ...pills)
    )
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
