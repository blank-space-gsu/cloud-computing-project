import { el, clearElement } from '../utils/dom.js';
import { isManager } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { doughnutChart } from '../components/charts.js';
import {
  capitalize,
  firstDayOfCurrentMonth,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatNumber,
  formatPercent,
  lastDayOfCurrentMonth
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam } from '../utils/teams.js';

export default async function goalsPage(container) {
  renderHeader('Goals & Quotas', isManager() ? 'Track team targets and quota progress' : 'Track your goals and shared team quotas');
  clearElement(container);

  const teams = await loadTeams();
  const state = {
    teamId: isManager() ? selectPreferredTeam(teams)?.id || teams[0]?.id || '' : '',
    scope: '',
    status: '',
    userId: '',
    page: 1
  };

  let members = [];

  const filtersBar = el('div', { className: 'filters-bar filters-bar--hero' });

  const teamSelect = buildSelect(teams.map((team) => ({ value: team.id, label: team.name })));
  const scopeSelect = buildSelect([
    { value: '', label: 'All scopes' },
    { value: 'team', label: 'Team goals' },
    { value: 'user', label: 'Individual goals' }
  ]);
  const statusSelect = buildSelect([
    { value: '', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'cancelled', label: 'Cancelled' }
  ]);
  const userSelect = buildSelect([{ value: '', label: 'All employees' }]);
  const userFilterGroup = el('div', { className: 'filter-group', style: 'display:none' },
    el('label', {}, 'Employee'),
    userSelect
  );

  if (teams.length > 1) {
    teamSelect.value = state.teamId;
    teamSelect.addEventListener('change', async () => {
      state.teamId = teamSelect.value;
      state.userId = '';
      state.page = 1;
      members = await loadMembers(state.teamId);
      populateUserSelect(userSelect, members);
      await loadGoals();
    });

    filtersBar.appendChild(el('div', { className: 'filter-group' },
      el('label', {}, 'Team'),
      teamSelect
    ));
  }

  scopeSelect.addEventListener('change', async () => {
    state.scope = scopeSelect.value;
    if (state.scope !== 'user') {
      state.userId = '';
      userSelect.value = '';
    }
    syncUserFilter();
    state.page = 1;
    await loadGoals();
  });

  statusSelect.addEventListener('change', async () => {
    state.status = statusSelect.value;
    state.page = 1;
    await loadGoals();
  });

  userSelect.addEventListener('change', async () => {
    state.userId = userSelect.value;
    state.page = 1;
    await loadGoals();
  });

  filtersBar.append(
    el('div', { className: 'filter-group' },
      el('label', {}, 'Scope'),
      scopeSelect
    ),
    el('div', { className: 'filter-group' },
      el('label', {}, 'Status'),
      statusSelect
    ),
    userFilterGroup
  );

  if (isManager()) {
    filtersBar.appendChild(
      el('button', {
        className: 'btn btn-primary',
        onClick: () => openCreateGoalModal({
          teams,
          initialTeamId: state.teamId || selectPreferredTeam(teams)?.id || teams[0]?.id || '',
          reload: loadGoals
        })
      }, '+ New Goal')
    );
  }

  const shell = el('div');
  const content = el('div');
  shell.append(filtersBar, content);
  container.appendChild(shell);

  if (state.teamId) {
    members = await loadMembers(state.teamId);
    populateUserSelect(userSelect, members);
  }
  syncUserFilter();
  await loadGoals();

  function syncUserFilter() {
    userFilterGroup.style.display = isManager() && state.scope === 'user' ? '' : 'none';
  }

  async function loadGoals() {
    clearElement(content);
    showLoading(content);

    try {
      let url = `/goals?sortBy=endDate&sortOrder=asc&page=${state.page}&limit=18&includeCancelled=true`;
      if (state.teamId) url += `&teamId=${state.teamId}`;
      if (state.scope) url += `&scope=${state.scope}`;
      if (state.status) url += `&status=${state.status}`;
      if (state.userId) url += `&userId=${state.userId}`;

      const { data } = await api.get(url);
      clearElement(content);

      const summary = data.summary || {};
      const goals = data.goals || [];
      const selectedTeam = teams.find((team) => team.id === state.teamId);

      content.append(
        el('div', { className: 'dashboard-top-split' },
          buildHero(summary, {
            teamName: selectedTeam?.name || 'All visible goals',
            teamDescription: selectedTeam?.description || '',
            scope: state.scope,
            status: state.status
          }),
          summaryTableCard('At a glance', buildSummaryRows(summary))
        ),
        buildUnitBreakdown(summary),
        buildChartGrid(data.charts || {}),
        buildGoalsBody(goals, {
          onEdit: isManager() ? (goal) => openUpdateGoalModal(goal, members, loadGoals) : null
        })
      );
    } catch (err) {
      showError(err);
      hideLoading(content);
    }
  }
}

async function loadTeams() {
  try {
    const { data } = await api.get('/teams');
    const teams = getVisibleTeams(data.teams || []);
    return isManager() ? teams.filter((team) => team.canManageTeam) : teams;
  } catch {
    return [];
  }
}

async function loadMembers(teamId) {
  if (!teamId) return [];

  try {
    const { data } = await api.get(`/teams/${teamId}/members`);
    return (data.members || []).filter((member) => member.appRole === 'employee');
  } catch {
    return [];
  }
}

function buildHero(summary, { teamName, teamDescription, scope, status }) {
  return el('section', { className: 'page-hero page-hero--compact' },
    el('div', { className: 'page-hero__content' },
      el('p', { className: 'page-hero__eyebrow' }, 'Goals & Quotas'),
      el('h2', { className: 'page-hero__title' }, teamName),
      el('p', { className: 'page-hero__description' },
        teamDescription || 'Monitor target progress, open quotas, and achievement rates across the visible goal set.'
      )
    ),
    el('div', { className: 'page-hero__meta' },
      heroPill(`Visible goals · ${formatNumber(summary.totalGoalCount || 0)}`),
      heroPill(`Average progress · ${formatPercent(summary.averageProgressPercent || 0, 1)}`),
      heroPill(`Scope · ${scope ? capitalize(scope) : 'All'}`),
      heroPill(`Status · ${status ? capitalize(status) : 'All'}`)
    )
  );
}

function buildSummaryRows(summary) {
  const targetTotal = !summary.hasMixedUnits && summary.primaryUnit
    ? formatCurrency(summary.totalTargetValue || 0, summary.primaryUnit)
    : `${formatNumber(summary.totalsByUnit?.length || 0)} unit groups`;

  return [
    {
      label: 'Total goals',
      value: formatNumber(summary.totalGoalCount || 0),
      note: 'All visible goals in the current filter.'
    },
    {
      label: 'Active goals',
      value: formatNumber(summary.activeGoalCount || 0),
      note: 'Targets still running.'
    },
    {
      label: 'Achieved goals',
      value: formatNumber(summary.achievedGoalCount || 0),
      note: 'Goals already meeting their target.'
    },
    {
      label: 'Average progress',
      value: formatPercent(summary.averageProgressPercent || 0, 1),
      note: 'Average completion across the current goal set.'
    },
    {
      label: 'Target total',
      value: targetTotal,
      note: summary.hasMixedUnits ? 'Totals are grouped by unit below.' : `Primary unit: ${summary.primaryUnit || 'USD'}`
    }
  ];
}

function buildUnitBreakdown(summary) {
  const totals = summary.hasMixedUnits
    ? summary.totalsByUnit || []
    : [{
        unit: summary.primaryUnit || 'USD',
        totalTargetValue: summary.totalTargetValue || 0,
        totalActualValue: summary.totalActualValue || 0
      }];

  return el('section', { className: 'dashboard-section card', style: 'margin-top:24px' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, 'Target totals'),
        el('p', { className: 'section-subtitle' },
          summary.hasMixedUnits
            ? 'The current results include multiple units, so totals are split by unit.'
            : 'The current goal set shares a single unit, so totals can be compared directly.'
        )
      )
    ),
    el('div', { className: 'unit-breakdown-grid' },
      ...totals.map((group) => el('article', { className: 'unit-breakdown-card' },
        el('div', { className: 'unit-breakdown-card__top' },
          el('h4', {}, group.unit || 'Units'),
          el('span', { className: 'badge badge-info' }, 'Quota totals')
        ),
        el('div', { className: 'unit-breakdown-card__metrics' },
          metricPair('Target total', formatCurrency(group.totalTargetValue || 0, group.unit)),
          metricPair('Actual total', formatCurrency(group.totalActualValue || 0, group.unit)),
          metricPair(
            'Achievement rate',
            group.totalTargetValue
              ? formatPercent(((group.totalActualValue || 0) / group.totalTargetValue) * 100, 1)
              : '0%'
          )
        )
      ))
    )
  );
}

function buildChartGrid(charts) {
  const grid = el('div', { className: 'chart-grid chart-grid--dashboard' });
  const chartEntries = [
    ['Goals by status', 'goals-status-chart', charts.byStatus, 'status'],
    ['Goals by type', 'goals-type-chart', charts.byType, 'goalType'],
    ['Goals by period', 'goals-period-chart', charts.byPeriod, 'period'],
    ['Goals by scope', 'goals-scope-chart', charts.byScope, 'scope']
  ];

  chartEntries.forEach(([title, canvasId, series, key]) => {
    const rows = series || [];
    if (!rows.length) return;

    grid.appendChild(chartCard(title, canvasId, 'Built from the live goal summary endpoint.'));
    requestAnimationFrame(() => doughnutChart(
      canvasId,
      rows.map((row) => row[key] || row.label || 'Unknown'),
      rows.map((row) => row.count || row.value || 0)
    ));
  });

  return grid.childNodes.length
    ? grid
    : el('section', { className: 'dashboard-section card', style: 'margin-top:24px' },
        emptyState('No goal charts', 'Charts will appear once goals exist for the current filter.')
      );
}

function buildGoalsBody(goals, { onEdit }) {
  if (!goals.length) {
    return el('section', { className: 'dashboard-section card', style: 'margin-top:24px' },
      emptyState('No goals found', 'Try changing the filters or create a goal to start tracking quotas.')
    );
  }

  const spotlight = goals
    .slice()
    .sort((a, b) => {
      const aTime = a.endDate ? new Date(a.endDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.endDate ? new Date(b.endDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 3);

  return el('div', { className: 'goals-shell' },
    collapsibleSection(
      'Goal spotlight',
      'The next deadlines or highest-visibility quota targets.',
      el('div', { className: 'goal-spotlight-grid' }, ...spotlight.map((goal) => goalSpotlightCard(goal, onEdit))),
      false
    ),
    collapsibleSection(
      'All visible goals',
      'Detailed cards for every goal in the current filter.',
      el('div', { className: 'goal-list goal-list--enhanced' }, ...goals.map((goal) => goalCard(goal, onEdit))),
      false
    )
  );
}

function collapsibleSection(title, subtitle, body, open = false) {
  return el('details', { className: 'dashboard-collapsible dashboard-section card', open },
    el('summary', { className: 'dashboard-collapsible__summary' },
      el('div', { className: 'dashboard-collapsible__copy' },
        el('h3', { className: 'section-title' }, title),
        el('p', { className: 'section-subtitle' }, subtitle)
      ),
      el('span', { className: 'dashboard-collapsible__icon', 'aria-hidden': 'true' })
    ),
    el('div', { className: 'dashboard-collapsible__body' }, body)
  );
}

function goalSpotlightCard(goal, onEdit) {
  const endDate = goal.endDate ? new Date(goal.endDate) : null;
  const today = new Date();
  const isPastDue = endDate && endDate < today && !goal.isTargetMet;
  const isClosingSoon = endDate && !isPastDue && ((endDate.getTime() - today.getTime()) / 86400000) <= 7;
  const tone = goal.isTargetMet ? 'success' : isPastDue ? 'danger' : isClosingSoon ? 'warning' : 'primary';

  return el('article', { className: `goal-highlight-card goal-highlight-card--${tone}` },
    el('div', { className: 'goal-highlight-card__header' },
      el('div', {},
        el('h4', {}, goal.title),
        el('p', {}, goal.description || 'No description added.')
      ),
      el('span', { className: `badge badge-${tone}` }, goal.isTargetMet ? 'Target met' : isPastDue ? 'At risk' : isClosingSoon ? 'Closing soon' : 'On track')
    ),
    el('div', { className: 'goal-highlight-card__values' },
      metricPair('Target', formatCurrency(goal.targetValue || 0, goal.unit)),
      metricPair('Actual', formatCurrency(goal.actualValue || 0, goal.unit)),
      metricPair('Progress', formatPercent(goal.progressPercent || 0, 1))
    ),
    el('div', { className: 'goal-progress-bar' },
      el('div', {
        className: `goal-progress-fill ${goal.isTargetMet ? 'met' : 'on-track'}`,
        style: `width:${Math.max(0, Math.min(goal.progressPercent || 0, 100))}%`
      })
    ),
    el('div', { className: 'goal-highlight-card__footer' },
      el('span', {}, goal.targetUser?.fullName || goal.teamName || 'Team goal'),
      el('span', {}, formatDateRange(goal.startDate, goal.endDate))
    ),
    onEdit ? el('button', { className: 'btn btn-sm btn-outline', onClick: () => onEdit(goal) }, 'Edit Goal') : null
  );
}

function goalCard(goal, onEdit) {
  const progress = Number(goal.progressPercent || 0);

  return el('article', { className: 'goal-card goal-card--rich' },
    el('div', { className: 'goal-card-header' },
      el('div', { className: 'goal-card__title-wrap' },
        el('h3', {}, goal.title),
        el('p', { className: 'goal-card__description' }, goal.description || 'No description provided.')
      ),
      el('div', { className: 'task-badges' },
        el('span', { className: `badge badge-${goal.status === 'cancelled' ? 'danger' : 'success'}` }, capitalize(goal.status)),
        el('span', { className: `badge badge-${goal.scope === 'team' ? 'primary' : 'info'}` }, capitalize(goal.scope)),
        el('span', { className: 'badge badge-default' }, capitalize(goal.period)),
        goal.isTargetMet ? el('span', { className: 'badge badge-success' }, 'Achieved') : null
      )
    ),
    el('div', { className: 'goal-values goal-values--rich' },
      el('span', {}, `Target: ${formatCurrency(goal.targetValue || 0, goal.unit)}`),
      el('span', {}, `Actual: ${formatCurrency(goal.actualValue || 0, goal.unit)}`),
      el('span', {}, goal.remainingValue > 0 ? `Remaining: ${formatCurrency(goal.remainingValue, goal.unit)}` : `Exceeded by ${formatCurrency(goal.excessValue || 0, goal.unit)}`)
    ),
    el('div', { className: 'goal-progress-row' },
      el('div', { className: 'goal-progress-bar' },
        el('div', {
          className: `goal-progress-fill ${goal.isTargetMet ? 'met' : 'on-track'}`,
          style: `width:${Math.max(0, Math.min(progress, 100))}%`
        })
      ),
      el('strong', { className: 'goal-progress-label' }, formatPercent(progress, 1))
    ),
    el('div', { className: 'goal-meta-grid' },
      metricPair('Owner', goal.targetUser?.fullName || goal.teamName || 'Team goal'),
      metricPair('Type', capitalize(goal.goalType)),
      metricPair('Window', formatDateRange(goal.startDate, goal.endDate)),
      metricPair('Updated', formatDate(goal.updatedAt || goal.createdAt))
    ),
    onEdit
      ? el('div', { className: 'task-actions', style: 'margin-top:12px' },
          el('button', { className: 'btn btn-sm btn-outline', onClick: () => onEdit(goal) }, 'Edit')
        )
      : null
  );
}

function chartCard(title, canvasId, subtitle) {
  return el('div', { className: 'chart-card chart-card--enhanced' },
    el('div', { className: 'chart-card__top' },
      el('h3', {}, title),
      subtitle ? el('p', {}, subtitle) : null
    ),
    el('div', { className: 'chart-container' },
      el('canvas', { id: canvasId })
    )
  );
}

function summaryTableCard(title, rows) {
  return el('section', { className: 'card dashboard-summary-table-card' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, title),
        el('p', { className: 'section-subtitle' }, 'The most important goal metrics in one compact table.')
      )
    ),
    el('div', { className: 'table-wrapper table-wrapper--compact' },
      el('table', { className: 'dashboard-summary-table' },
        el('tbody', {},
          ...rows.map((row) => el('tr', {},
            el('th', { scope: 'row', className: 'dashboard-summary-table__metric' },
              el('div', { className: 'dashboard-summary-table__label' }, row.label),
              el('span', { className: 'dashboard-summary-table__note' }, row.note)
            ),
            el('td', { className: 'dashboard-summary-table__value' }, row.value)
          ))
        )
      )
    )
  );
}

function heroPill(text) {
  return el('span', { className: 'hero-pill' }, text);
}

function metricPair(label, value) {
  return el('div', { className: 'metrics-panel__item' },
    el('span', { className: 'metrics-panel__label' }, label),
    el('strong', { className: 'metrics-panel__value' }, value)
  );
}

function buildSelect(options) {
  return el('select', { className: 'form-select' },
    ...options.map((option) => el('option', { value: option.value }, option.label))
  );
}

function populateUserSelect(select, members) {
  clearElement(select);
  select.appendChild(el('option', { value: '' }, 'All employees'));
  members.forEach((member) => {
    select.appendChild(el('option', { value: member.id }, member.fullName || `${member.firstName} ${member.lastName}`));
  });
}

function openCreateGoalModal({ teams, initialTeamId, reload }) {
  const defaultStart = firstDayOfCurrentMonth();
  const defaultEnd = lastDayOfCurrentMonth();
  const teamId = initialTeamId || selectPreferredTeam(teams)?.id || teams[0]?.id || '';

  const form = el('form', {},
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Team'),
        buildSelect(teams.map((team) => ({ value: team.id, label: team.name })))
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Scope'),
        buildSelect([
          { value: 'team', label: 'Team goal' },
          { value: 'user', label: 'Individual goal' }
        ])
      )
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', name: 'title', placeholder: 'March sales quota', required: true })
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Description'),
      el('textarea', { className: 'form-textarea', name: 'description', placeholder: 'Optional details about the target.' })
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Period'),
        buildSelect([
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'yearly', label: 'Yearly' }
        ])
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Unit'),
        el('input', { className: 'form-input', name: 'unit', value: 'USD', placeholder: 'USD, deals, tasks...' })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Target value'),
        el('input', { className: 'form-input', name: 'targetValue', type: 'number', min: '1', step: '0.01', required: true })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Starting actual'),
        el('input', { className: 'form-input', name: 'actualValue', type: 'number', min: '0', step: '0.01', value: '0' })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Start date'),
        el('input', { className: 'form-input', name: 'startDate', type: 'date', value: defaultStart, required: true })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'End date'),
        el('input', { className: 'form-input', name: 'endDate', type: 'date', value: defaultEnd, required: true })
      )
    ),
    el('div', { className: 'form-group', id: 'goal-target-user-group', style: 'display:none' },
      el('label', { className: 'form-label' }, 'Target employee'),
      buildSelect([{ value: '', label: 'Select employee' }])
    )
  );

  const [teamSelect, scopeSelect] = form.querySelectorAll('select');
  const targetUserGroup = form.querySelector('#goal-target-user-group');
  const targetUserSelect = targetUserGroup.querySelector('select');

  teamSelect.name = 'teamId';
  scopeSelect.name = 'scope';
  teamSelect.value = teamId;
  scopeSelect.value = 'team';

  async function refreshUsers() {
    const members = await loadMembers(teamSelect.value);
    clearElement(targetUserSelect);
    targetUserSelect.appendChild(el('option', { value: '' }, 'Select employee'));
    members.forEach((member) => {
      targetUserSelect.appendChild(el('option', { value: member.id }, member.fullName || `${member.firstName} ${member.lastName}`));
    });
  }

  function syncScope() {
    targetUserGroup.style.display = scopeSelect.value === 'user' ? '' : 'none';
  }

  teamSelect.addEventListener('change', refreshUsers);
  scopeSelect.addEventListener('change', syncScope);

  syncScope();
  refreshUsers();

  const saveBtn = el('button', { className: 'btn btn-primary', type: 'button' }, 'Create Goal');
  saveBtn.addEventListener('click', async () => {
    const title = form.querySelector('[name="title"]').value.trim();
    if (!title) {
      showError('Title is required.');
      return;
    }

    const scope = form.querySelector('[name="scope"]').value;
    const payload = {
      teamId: form.querySelector('[name="teamId"]').value,
      title,
      description: form.querySelector('[name="description"]').value.trim() || undefined,
      goalType: 'sales_quota',
      scope,
      period: form.querySelector('[name="period"]').value,
      startDate: form.querySelector('[name="startDate"]').value,
      endDate: form.querySelector('[name="endDate"]').value,
      targetValue: Number(form.querySelector('[name="targetValue"]').value),
      actualValue: Number(form.querySelector('[name="actualValue"]').value || 0),
      unit: form.querySelector('[name="unit"]').value.trim() || 'USD',
      status: 'active'
    };

    if (scope === 'user') {
      payload.targetUserId = targetUserSelect.value;
      if (!payload.targetUserId) {
        showError('Please choose the employee for this goal.');
        return;
      }
    }

    saveBtn.disabled = true;
    try {
      await api.post('/goals', payload);
      showSuccess('Goal created successfully.');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal('Create Goal', form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', type: 'button', onClick: closeModal }, 'Cancel'),
    saveBtn
  ));
}

function openUpdateGoalModal(goal, existingMembers, reload) {
  const form = el('form', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', name: 'title', value: goal.title || '' })
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Description'),
      el('textarea', { className: 'form-textarea', name: 'description' }, goal.description || '')
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Scope'),
        buildSelect([
          { value: 'team', label: 'Team goal' },
          { value: 'user', label: 'Individual goal' }
        ])
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Status'),
        buildSelect([
          { value: 'active', label: 'Active' },
          { value: 'cancelled', label: 'Cancelled' }
        ])
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Period'),
        buildSelect([
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'yearly', label: 'Yearly' }
        ])
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Unit'),
        el('input', { className: 'form-input', name: 'unit', value: goal.unit || 'USD' })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Target value'),
        el('input', { className: 'form-input', name: 'targetValue', type: 'number', min: '1', step: '0.01', value: String(goal.targetValue || 0) })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Actual value'),
        el('input', { className: 'form-input', name: 'actualValue', type: 'number', min: '0', step: '0.01', value: String(goal.actualValue || 0) })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Start date'),
        el('input', { className: 'form-input', name: 'startDate', type: 'date', value: goal.startDate ? goal.startDate.split('T')[0] : '' })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'End date'),
        el('input', { className: 'form-input', name: 'endDate', type: 'date', value: goal.endDate ? goal.endDate.split('T')[0] : '' })
      )
    ),
    el('div', { className: 'form-group', id: 'goal-edit-target-group' },
      el('label', { className: 'form-label' }, 'Target employee'),
      buildSelect([{ value: '', label: 'Select employee' }])
    )
  );

  const [scopeSelect, statusSelect, periodSelect] = form.querySelectorAll('select');
  const targetGroup = form.querySelector('#goal-edit-target-group');
  const targetSelect = targetGroup.querySelector('select');

  scopeSelect.name = 'scope';
  statusSelect.name = 'status';
  periodSelect.name = 'period';
  scopeSelect.value = goal.scope || 'team';
  statusSelect.value = goal.status || 'active';
  periodSelect.value = goal.period || 'monthly';

  clearElement(targetSelect);
  targetSelect.appendChild(el('option', { value: '' }, 'Select employee'));
  existingMembers.forEach((member) => {
    targetSelect.appendChild(el('option', {
      value: member.id,
      selected: goal.targetUser?.id === member.id
    }, member.fullName || `${member.firstName} ${member.lastName}`));
  });

  function syncScope() {
    targetGroup.style.display = scopeSelect.value === 'user' ? '' : 'none';
  }

  syncScope();
  scopeSelect.addEventListener('change', syncScope);

  const saveBtn = el('button', { className: 'btn btn-primary', type: 'button' }, 'Save Changes');
  saveBtn.addEventListener('click', async () => {
    const payload = {
      title: form.querySelector('[name="title"]').value.trim() || undefined,
      description: form.querySelector('[name="description"]').value.trim() || undefined,
      scope: scopeSelect.value,
      status: statusSelect.value,
      period: periodSelect.value,
      unit: form.querySelector('[name="unit"]').value.trim() || 'USD',
      targetValue: Number(form.querySelector('[name="targetValue"]').value),
      actualValue: Number(form.querySelector('[name="actualValue"]').value || 0),
      startDate: form.querySelector('[name="startDate"]').value || undefined,
      endDate: form.querySelector('[name="endDate"]').value || undefined
    };

    if (scopeSelect.value === 'user') {
      payload.targetUserId = targetSelect.value;
      if (!payload.targetUserId) {
        showError('Please choose an employee for this individual goal.');
        return;
      }
    }

    saveBtn.disabled = true;
    try {
      await api.patch(`/goals/${goal.id}`, payload);
      showSuccess('Goal updated successfully.');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal(`Edit Goal: ${goal.title}`, form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', type: 'button', onClick: closeModal }, 'Cancel'),
    saveBtn
  ));
}
