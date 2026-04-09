import { el, clearElement } from '../utils/dom.js';
import { isManager } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError } from '../components/toast.js';
import { lineChart, barChart } from '../components/charts.js';
import {
  capitalize,
  formatDateRange,
  formatNumber,
  formatPercent,
  formatTrendLabel,
  formatTrendTooltip
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam } from '../utils/teams.js';

export default async function productivityPage(container) {
  renderHeader('Productivity', isManager() ? 'Team performance metrics' : 'Your performance metrics');
  clearElement(container);

  if (isManager()) {
    await renderManagerProductivity(container);
  } else {
    await renderEmployeeProductivity(container);
  }
}

async function renderEmployeeProductivity(container) {
  showLoading(container);

  try {
    const { data } = await api.get('/productivity-metrics?scope=individual');
    clearElement(container);
    container.appendChild(renderProductivityView(data, { title: 'Personal productivity overview' }));
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

async function renderManagerProductivity(container) {
  let teams = [];
  try {
    const response = await api.get('/teams');
    teams = getVisibleTeams((response.data.teams || []).filter((team) => team.canManageTeam));
  } catch {
    teams = [];
  }

  clearElement(container);

  if (!teams.length) {
    container.appendChild(emptyState('No manageable teams', 'There is no team available for manager productivity reporting.'));
    return;
  }

  const state = {
    teamId: selectPreferredTeam(teams)?.id || teams[0].id,
    scope: 'team',
    userId: ''
  };

  const filtersBar = el('div', { className: 'filters-bar filters-bar--hero' });
  const scopeSel = el('select', { className: 'form-select' },
    el('option', { value: 'team' }, 'Team overview'),
    el('option', { value: 'individual' }, 'Individual view')
  );
  const memberSel = el('select', { className: 'form-select' });
  const memberGroup = el('div', { className: 'filter-group', style: 'display:none' },
    el('label', {}, 'Employee'),
    memberSel
  );

  if (teams.length > 1) {
    const teamSel = el('select', { className: 'form-select' },
      ...teams.map((team) => el('option', { value: team.id }, team.name))
    );
    teamSel.value = state.teamId;
    teamSel.addEventListener('change', async () => {
      state.teamId = teamSel.value;
      await loadMembers();
      await loadData();
    });

    filtersBar.appendChild(el('div', { className: 'filter-group' }, el('label', {}, 'Team'), teamSel));
  }

  scopeSel.addEventListener('change', async () => {
    state.scope = scopeSel.value;
    memberGroup.style.display = state.scope === 'individual' ? '' : 'none';
    await loadData();
  });

  memberSel.addEventListener('change', async () => {
    state.userId = memberSel.value;
    await loadData();
  });

  filtersBar.append(
    el('div', { className: 'filter-group' }, el('label', {}, 'Scope'), scopeSel),
    memberGroup
  );

  const dataArea = el('div');
  container.append(filtersBar, dataArea);

  async function loadMembers() {
    clearElement(memberSel);

    try {
      const { data } = await api.get(`/teams/${state.teamId}/members`);
      const members = (data.members || []).filter((member) => member.appRole === 'employee');
      members.forEach((member) => {
        memberSel.appendChild(el('option', { value: member.id }, member.fullName));
      });
      state.userId = members[0]?.id || '';
    } catch {
      state.userId = '';
    }
  }

  async function loadData() {
    clearElement(dataArea);
    showLoading(dataArea);

    try {
      let url = `/productivity-metrics?scope=${state.scope}&teamId=${state.teamId}`;
      if (state.scope === 'individual' && state.userId) {
        url += `&userId=${state.userId}`;
      }

      const { data } = await api.get(url);
      clearElement(dataArea);
      dataArea.appendChild(renderProductivityView(data, {
        title: state.scope === 'team' ? 'Team productivity overview' : 'Individual productivity overview'
      }));
    } catch (err) {
      showError(err);
      hideLoading(dataArea);
    }
  }

  await loadMembers();
  await loadData();
}

function renderProductivityView(data, { title }) {
  const monthly = data.rollups?.monthly || {};
  const weekly = data.rollups?.weekly || {};
  const yearly = data.rollups?.yearly || {};
  const members = data.breakdown?.members || [];

  const fragment = el('div');
  fragment.append(
    el('div', { className: 'dashboard-top-split' },
      heroBanner(title, data),
      summaryTableCard('At a glance', buildSummaryRows(weekly, monthly, yearly))
    ),
    buildTrendGrid(data.charts || {})
  );

  if (data.scope === 'team') {
    fragment.appendChild(buildMemberBreakdown(members));
  } else if (data.user) {
    fragment.appendChild(userFocusCard(data.user, monthly));
  }

  return fragment;
}

function heroBanner(title, data) {
  return el('section', { className: 'page-hero page-hero--compact' },
    el('div', { className: 'page-hero__content' },
      el('p', { className: 'page-hero__eyebrow' }, 'Productivity Metrics'),
      el('h2', { className: 'page-hero__title' }, title),
      el('p', { className: 'page-hero__description' },
        data.scope === 'team'
          ? 'Weekly, monthly, and yearly task performance rollups for the selected team.'
          : 'Track personal completion, blockers, and overall progress over time.'
      )
    ),
    el('div', { className: 'page-hero__meta' },
      heroPill(`Scope · ${capitalize(data.scope)}`),
      heroPill(`Reference date · ${data.referenceDate}`),
      data.user ? heroPill(`User · ${data.user.fullName}`) : null
    )
  );
}

function buildSummaryRows(weekly, monthly, yearly) {
  return [
    {
      label: 'Tasks this week',
      value: formatNumber(weekly.taskCount || 0),
      note: 'Current weekly task count in the active scope.'
    },
    {
      label: 'Monthly completion',
      value: formatPercent(monthly.completionRate || 0, 1),
      note: 'Completed tasks as a share of monthly workload.'
    },
    {
      label: 'Average progress',
      value: formatPercent(monthly.averageProgressPercent || 0, 1),
      note: 'Average progress across monthly tasks.'
    },
    {
      label: 'Monthly blockers',
      value: formatNumber(monthly.blockedTaskCount || 0),
      note: 'Blocked tasks that need attention.'
    },
    {
      label: 'Yearly tasks',
      value: formatNumber(yearly.taskCount || 0),
      note: 'Tasks counted inside the yearly window.'
    }
  ];
}

function buildTrendGrid(charts) {
  const weeklyTrend = charts.weeklyTrend || [];
  const monthlyTrend = charts.monthlyTrend || [];

  const grid = el('div', { className: 'chart-grid chart-grid--dashboard' });

  grid.appendChild(trendChartCard({
    title: 'Weekly trend',
    canvasId: 'productivity-weekly-trend',
    subtitle: 'Completed and open tasks across recent weeks.',
    points: weeklyTrend,
    datasets: [
      { label: 'Completed Tasks', dataKey: 'completedTaskCount', color: '#22c55e' },
      { label: 'Open Tasks', dataKey: 'openTaskCount', color: '#6366f1' }
    ]
  }));

  grid.appendChild(trendChartCard({
    title: 'Monthly trend',
    canvasId: 'productivity-monthly-trend',
    subtitle: 'Monthly completion and task volume over time.',
    points: monthlyTrend,
    datasets: [
      { label: 'Completed Tasks', dataKey: 'completedTaskCount', color: '#6366f1' },
      { label: 'Completion Rate', dataKey: 'completionRate', color: '#f59e0b' }
    ]
  }));

  return grid;
}

function buildMemberBreakdown(members) {
  if (!members.length) {
    return stackedSection('Team member comparison', 'Compare teammates by task volume and progress.', emptyState('No member data', 'No member breakdown was returned for this team.'));
  }

  const employeeRows = members.filter((member) => member.taskCount || member.completedTaskCount || member.openTaskCount);
  const section = stackedSection(
    'Team member comparison',
    'A compact comparison of the key task metrics for each visible employee.',
    el('div')
  );

  const body = section.querySelector('div:last-child');
  body.appendChild(chartCard('Completed vs open tasks', 'productivity-member-comparison', 'A quick comparison across visible employees.'));
  requestAnimationFrame(() => barChart(
    'productivity-member-comparison',
    employeeRows.map((member) => member.fullName),
    [
      { label: 'Completed Tasks', data: employeeRows.map((member) => member.completedTaskCount || 0), color: '#22c55e' },
      { label: 'Open Tasks', data: employeeRows.map((member) => member.openTaskCount || 0), color: '#6366f1' }
    ]
  ));

  body.appendChild(
    el('div', { className: 'table-wrapper', style: 'margin-top:16px' },
      el('table', {},
        el('thead', {},
          el('tr', {},
            el('th', {}, 'Employee'),
            el('th', {}, 'Tasks'),
            el('th', {}, 'Completed'),
            el('th', {}, 'Open'),
            el('th', {}, 'Blocked'),
            el('th', {}, 'Avg progress'),
            el('th', {}, 'Completion rate')
          )
        ),
        el('tbody', {},
          ...employeeRows.map((member) => el('tr', {},
            el('td', {}, member.fullName),
            el('td', {}, formatNumber(member.taskCount || 0)),
            el('td', {}, formatNumber(member.completedTaskCount || 0)),
            el('td', {}, formatNumber(member.openTaskCount || 0)),
            el('td', {}, formatNumber(member.blockedTaskCount || 0)),
            el('td', {}, formatPercent(member.averageProgressPercent || 0, 1)),
            el('td', {}, formatPercent(member.completionRate || 0, 1))
          ))
        )
      )
    )
  );

  return section;
}

function userFocusCard(user, monthlyRollup) {
  return stackedSection(
    'User focus',
    'A quick identity card for the selected individual productivity view.',
    el('div', { className: 'performance-roster' },
      el('div', { className: 'performance-roster__card' },
        el('div', { className: 'performance-roster__header' },
          el('div', {},
            el('h4', {}, user.fullName),
            el('p', {}, user.jobTitle || capitalize(user.appRole))
          ),
          el('span', { className: 'badge badge-primary' }, capitalize(user.appRole))
        ),
        el('div', { className: 'performance-roster__grid' },
          rosterStat('Monthly tasks', formatNumber(monthlyRollup.taskCount || 0)),
          rosterStat('Completed', formatNumber(monthlyRollup.completedTaskCount || 0)),
          rosterStat('Open', formatNumber(monthlyRollup.openTaskCount || 0)),
          rosterStat('Blocked', formatNumber(monthlyRollup.blockedTaskCount || 0)),
          rosterStat('Completion rate', formatPercent(monthlyRollup.completionRate || 0, 1)),
          rosterStat('Avg progress', formatPercent(monthlyRollup.averageProgressPercent || 0, 1))
        )
      )
    )
  );
}

function chartCard(title, canvasId, subtitle) {
  return el('div', { className: 'chart-card chart-card--enhanced' },
    el('div', { className: 'chart-card__top' },
      el('h3', {}, title),
      subtitle ? el('p', {}, subtitle) : null
    ),
    el('div', { className: 'chart-container' }, el('canvas', { id: canvasId }))
  );
}

function summaryTableCard(title, rows) {
  return el('section', { className: 'card dashboard-summary-table-card' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, title),
        el('p', { className: 'section-subtitle' }, 'The most important metrics for this view in one compact table.')
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

function trendChartCard({ title, canvasId, subtitle, points, datasets }) {
  const hasActivity = points.some((point) =>
    datasets.some((dataset) => Number(point?.[dataset.dataKey] || 0) > 0)
  );

  if (!points.length || !hasActivity) {
    return emptyChartCard(title, subtitle, 'No activity to plot for this time range yet.');
  }

  const card = chartCard(title, canvasId, subtitle);
  requestAnimationFrame(() => lineChart(
    canvasId,
    points.map((point) => formatTrendLabel(point.startDate, point.endDate)),
    datasets.map((dataset) => ({
      label: dataset.label,
      data: points.map((point) => point?.[dataset.dataKey] || 0),
      color: dataset.color
    })),
    {
      tooltipTitles: points.map((point) => formatTrendTooltip(point.startDate, point.endDate)),
      maxTicksLimit: 6
    }
  ));

  return card;
}

function emptyChartCard(title, subtitle, message) {
  return el('div', { className: 'chart-card chart-card--enhanced chart-card--empty' },
    el('div', { className: 'chart-card__top' },
      el('h3', {}, title),
      subtitle ? el('p', {}, subtitle) : null
    ),
    el('div', { className: 'chart-card__empty' },
      el('strong', {}, 'No trend yet'),
      el('span', {}, message)
    )
  );
}

function stackedSection(title, subtitle, body) {
  return el('section', { className: 'dashboard-section card', style: 'margin-top:24px' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, title),
        subtitle ? el('p', { className: 'section-subtitle' }, subtitle) : null
      )
    ),
    body
  );
}

function heroPill(text) {
  return el('span', { className: 'hero-pill' }, text);
}

function rosterStat(label, value) {
  return el('div', { className: 'performance-roster__stat' },
    el('span', {}, label),
    el('strong', {}, value)
  );
}
