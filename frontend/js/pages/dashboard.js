import { el, clearElement } from '../utils/dom.js';
import { isManager, isEmployee, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading, renderInto } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError } from '../components/toast.js';
import { doughnutChart, barChart, STATUS_COLORS, PRIORITY_COLORS } from '../components/charts.js';
import { statusLabel, priorityLabel, formatDate, formatTimeRemaining } from '../utils/format.js';

export default async function dashboardPage(container) {
  const user = getUser();
  renderHeader('Dashboard', `Welcome back, ${user.firstName}`);
  clearElement(container);
  showLoading(container);

  try {
    if (isEmployee()) {
      await renderEmployeeDashboard(container);
    } else {
      await renderManagerDashboard(container);
    }
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

async function renderEmployeeDashboard(container) {
  const { data } = await api.get('/dashboards/employee');
  clearElement(container);

  const s = data.summary || {};
  const cards = el('div', { className: 'card-grid' },
    summaryCard('Total Tasks', s.totalTasks ?? 0, '📋'),
    summaryCard('In Progress', s.inProgressTasks ?? 0, '🔄'),
    summaryCard('Completed', s.completedTasks ?? 0, '✅'),
    summaryCard('Overdue', s.overdueTasks ?? 0, '⚠️', s.overdueTasks > 0 ? 'danger' : null)
  );

  const charts = data.charts || {};
  const chartSection = el('div', { className: 'chart-grid' });

  if (charts.byStatus && charts.byStatus.length) {
    const labels = charts.byStatus.map(c => c.status || c.label);
    const values = charts.byStatus.map(c => c.count || c.value);
    chartSection.appendChild(chartCard('Tasks by Status', 'chart-status'));
    setTimeout(() => doughnutChart('chart-status', labels, values, STATUS_COLORS), 0);
  }

  if (charts.byPriority && charts.byPriority.length) {
    const labels = charts.byPriority.map(c => c.priority || c.label);
    const values = charts.byPriority.map(c => c.count || c.value);
    chartSection.appendChild(chartCard('Tasks by Priority', 'chart-priority'));
    setTimeout(() => doughnutChart('chart-priority', labels, values, PRIORITY_COLORS), 0);
  }

  const sections = el('div');
  const tasks = data.tasks || {};

  if (tasks.upcomingDeadlines?.length) {
    sections.appendChild(taskListSection('Upcoming Deadlines', tasks.upcomingDeadlines));
  }
  if (tasks.urgentTasks?.length) {
    sections.appendChild(taskListSection('Urgent Tasks', tasks.urgentTasks));
  }

  container.append(cards, chartSection, sections);
}

async function renderManagerDashboard(container) {
  let teams = [];
  try {
    const res = await api.get('/teams');
    teams = res.data.teams || [];
  } catch { /* no teams */ }

  const firstTeamId = teams.length ? teams[0].id : null;
  let selectedTeamId = firstTeamId;

  clearElement(container);

  const teamSelector = el('div', { className: 'filters-bar' });
  if (teams.length > 1) {
    const sel = el('select', { className: 'form-select', style: 'min-width:200px' });
    for (const t of teams) {
      sel.appendChild(el('option', { value: t.id }, t.name));
    }
    sel.addEventListener('change', async () => {
      selectedTeamId = sel.value;
      await loadManagerData(container, dashArea, selectedTeamId);
    });
    teamSelector.appendChild(el('div', { className: 'filter-group' },
      el('label', {}, 'Team'),
      sel
    ));
  }

  const dashArea = el('div');
  container.append(teamSelector, dashArea);

  if (selectedTeamId) {
    await loadManagerData(container, dashArea, selectedTeamId);
  } else {
    dashArea.appendChild(emptyState('No teams found', 'You are not assigned to any teams yet.'));
  }
}

async function loadManagerData(container, dashArea, teamId) {
  clearElement(dashArea);
  showLoading(dashArea);

  try {
    const url = teamId ? `/dashboards/manager?teamId=${teamId}` : '/dashboards/manager';
    const { data } = await api.get(url);
    clearElement(dashArea);

    const s = data.summary || {};
    const cards = el('div', { className: 'card-grid' },
      summaryCard('Total Tasks', s.totalTasks ?? 0, '📋'),
      summaryCard('In Progress', s.inProgressTasks ?? 0, '🔄'),
      summaryCard('Completed', s.completedTasks ?? 0, '✅'),
      summaryCard('Overdue', s.overdueTasks ?? 0, '⚠️', s.overdueTasks > 0 ? 'danger' : null),
      summaryCard('Unassigned', s.unassignedTasks ?? 0, '📌')
    );

    const charts = data.charts || {};
    const chartSection = el('div', { className: 'chart-grid' });

    if (charts.workloadByEmployee?.length) {
      const labels = charts.workloadByEmployee.map(e => e.employeeName || e.fullName || 'Employee');
      const values = charts.workloadByEmployee.map(e => e.taskCount ?? e.totalTasks ?? 0);
      chartSection.appendChild(chartCard('Workload by Employee', 'chart-workload'));
      setTimeout(() => barChart('chart-workload', labels, [{ label: 'Tasks', data: values, color: '#6366f1' }]), 0);
    }

    if (charts.byStatus?.length) {
      const labels = charts.byStatus.map(c => c.status || c.label);
      const values = charts.byStatus.map(c => c.count || c.value);
      chartSection.appendChild(chartCard('Tasks by Status', 'chart-mgr-status'));
      setTimeout(() => doughnutChart('chart-mgr-status', labels, values, STATUS_COLORS), 0);
    }

    if (charts.byPriority?.length) {
      const labels = charts.byPriority.map(c => c.priority || c.label);
      const values = charts.byPriority.map(c => c.count || c.value);
      chartSection.appendChild(chartCard('Tasks by Priority', 'chart-mgr-priority'));
      setTimeout(() => doughnutChart('chart-mgr-priority', labels, values, PRIORITY_COLORS), 0);
    }

    const sections = el('div');
    const tasks = data.tasks || {};

    if (tasks.upcomingDeadlines?.length) {
      sections.appendChild(taskListSection('Upcoming Deadlines', tasks.upcomingDeadlines));
    }
    if (tasks.urgentTasks?.length) {
      sections.appendChild(taskListSection('Urgent Tasks', tasks.urgentTasks));
    }

    dashArea.append(cards, chartSection, sections);
  } catch (err) {
    showError(err);
    hideLoading(dashArea);
  }
}

function summaryCard(title, value, icon, variant) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card-title' }, `${icon} ${title}`),
    el('div', { className: `card-value${variant ? ' text-' + variant : ''}`, style: variant === 'danger' && value > 0 ? 'color:var(--color-danger)' : '' }, String(value))
  );
  return card;
}

function chartCard(title, canvasId) {
  return el('div', { className: 'chart-card' },
    el('h3', {}, title),
    el('div', { className: 'chart-container' },
      el('canvas', { id: canvasId })
    )
  );
}

function taskListSection(title, tasks) {
  const section = el('div', { className: 'section' },
    el('h3', { className: 'section-title' }, title)
  );
  const list = el('div', { className: 'inline-list' });
  for (const t of tasks.slice(0, 8)) {
    const item = el('div', { className: 'inline-item' },
      el('span', { className: 'title' }, t.title),
      el('span', { className: 'meta' },
        t.dueAt ? el('span', {}, formatDate(t.dueAt)) : null,
        el('span', { className: `badge badge-${t.isOverdue ? 'danger' : t.isDueSoon ? 'warning' : 'default'}` },
          t.isOverdue ? 'Overdue' : t.isDueSoon ? 'Due Soon' : statusLabel(t.status)
        )
      )
    );
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}
