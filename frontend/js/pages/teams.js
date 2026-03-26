import { el, clearElement } from '../utils/dom.js';
import { isManager } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError } from '../components/toast.js';
import { capitalize } from '../utils/format.js';

export default async function teamsPage(container, params) {
  if (params.teamId) {
    await renderTeamDetail(container, params.teamId);
  } else {
    await renderTeamList(container);
  }
}

async function renderTeamList(container) {
  renderHeader('Teams', 'Your teams and members');
  clearElement(container);
  showLoading(container);

  try {
    const { data } = await api.get('/teams');
    clearElement(container);

    const teams = data.teams || [];
    if (!teams.length) {
      container.appendChild(emptyState('No teams', 'You are not part of any teams yet.'));
      return;
    }

    const grid = el('div', { className: 'team-grid' });
    for (const t of teams) {
      const card = el('div', { className: 'team-card', onClick: () => { window.location.hash = `#/teams/${t.id}`; } },
        el('h3', {}, t.name),
        el('p', {}, t.description || 'No description'),
        el('div', { className: 'team-stats' },
          el('span', {}, `👥 ${t.memberCount ?? '?'} members`),
          el('span', {}, `👔 ${t.managerCount ?? '?'} manager${(t.managerCount ?? 0) !== 1 ? 's' : ''}`),
          t.canManageTeam ? el('span', { className: 'badge badge-primary' }, 'Manager') : null
        )
      );
      grid.appendChild(card);
    }
    container.appendChild(grid);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

async function renderTeamDetail(container, teamId) {
  renderHeader('Team Members', '');
  clearElement(container);
  showLoading(container);

  try {
    const { data } = await api.get(`/teams/${teamId}/members`);
    clearElement(container);

    const team = data.team || {};
    renderHeader(team.name || 'Team Members', 'Team roster');

    const backBtn = el('button', { className: 'btn btn-outline', style: 'margin-bottom:20px', onClick: () => { window.location.hash = '#/teams'; } }, '← Back to Teams');
    container.appendChild(backBtn);

    const members = data.members || [];
    if (!members.length) {
      container.appendChild(emptyState('No members', 'This team has no members yet.'));
      return;
    }

    const grid = el('div', { className: 'member-grid' });
    for (const m of members) {
      const initials = (m.firstName?.charAt(0) || '') + (m.lastName?.charAt(0) || '');
      const roleClass = m.membershipRole === 'manager' ? 'primary' : 'info';
      grid.appendChild(
        el('div', { className: 'member-card' },
          el('div', { className: 'member-avatar' }, initials),
          el('div', { className: 'member-info' },
            el('h4', {}, m.fullName || `${m.firstName} ${m.lastName}`),
            el('p', {}, m.jobTitle || 'Team Member'),
            el('span', { className: `badge badge-${roleClass}` }, capitalize(m.membershipRole || m.appRole))
          )
        )
      );
    }
    container.appendChild(grid);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}
