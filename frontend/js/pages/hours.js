import { el, clearElement } from '../utils/dom.js';
import { isManager } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { barChart, doughnutChart } from '../components/charts.js';
import {
  capitalize,
  firstDayOfCurrentMonth,
  formatDate,
  formatDateRange,
  formatHours,
  formatNumber,
  formatPercent,
  lastDayOfCurrentMonth,
  todayDateString
} from '../utils/format.js';
import { selectPreferredTeam } from '../utils/teams.js';

export default async function hoursPage(container) {
  renderHeader('Hours Logged', isManager() ? 'Review team time tracking and reporting' : 'Track work hours and task effort');
  clearElement(container);

  const teams = await loadTeams();
  const state = {
    teamId: selectPreferredTeam(teams)?.id || teams[0]?.id || '',
    userId: '',
    dateFrom: firstDayOfCurrentMonth(),
    dateTo: lastDayOfCurrentMonth()
  };

  let members = [];

  const shell = el('div');
  const content = el('div');

  if (!isManager() && teams.length) {
    shell.appendChild(buildLogForm({
      teams,
      initialTeamId: state.teamId,
      onSuccess: async (teamId) => {
        if (teamId && teamId !== state.teamId) {
          state.teamId = teamId;
          teamSelect.value = teamId;
        }
        await loadHours();
      }
    }));
  }

  const filtersBar = el('div', { className: 'filters-bar filters-bar--hero' });
  const teamSelect = buildSelect(teams.map((team) => ({ value: team.id, label: team.name })));
  const userSelect = buildSelect([{ value: '', label: 'All employees' }]);
  const fromInput = el('input', { className: 'form-input', type: 'date', value: state.dateFrom });
  const toInput = el('input', { className: 'form-input', type: 'date', value: state.dateTo });
  const resetBtn = el('button', {
    className: 'btn btn-outline',
    type: 'button',
    onClick: async () => {
      state.dateFrom = firstDayOfCurrentMonth();
      state.dateTo = lastDayOfCurrentMonth();
      fromInput.value = state.dateFrom;
      toInput.value = state.dateTo;
      await loadHours();
    }
  }, 'Reset Range');

  if (teams.length && (isManager() || teams.length > 1)) {
    teamSelect.value = state.teamId;
    teamSelect.addEventListener('change', async () => {
      state.teamId = teamSelect.value;
      state.userId = '';
      userSelect.value = '';
      members = await loadMembers(state.teamId);
      populateUserSelect(userSelect, members);
      await loadHours();
    });

    filtersBar.appendChild(el('div', { className: 'filter-group' },
      el('label', {}, 'Team'),
      teamSelect
    ));
  }

  if (isManager()) {
    userSelect.addEventListener('change', async () => {
      state.userId = userSelect.value;
      await loadHours();
    });

    filtersBar.appendChild(el('div', { className: 'filter-group' },
      el('label', {}, 'Employee'),
      userSelect
    ));
  }

  fromInput.addEventListener('change', async () => {
    state.dateFrom = fromInput.value;
    await loadHours();
  });

  toInput.addEventListener('change', async () => {
    state.dateTo = toInput.value;
    await loadHours();
  });

  filtersBar.append(
    el('div', { className: 'filter-group' },
      el('label', {}, 'From'),
      fromInput
    ),
    el('div', { className: 'filter-group' },
      el('label', {}, 'To'),
      toInput
    ),
    resetBtn
  );

  shell.append(filtersBar, content);
  container.appendChild(shell);

  if (state.teamId && isManager()) {
    members = await loadMembers(state.teamId);
    populateUserSelect(userSelect, members);
  }

  await loadHours();

  async function loadHours() {
    clearElement(content);
    showLoading(content);

    try {
      let url = '/hours-logged?sortBy=workDate&sortOrder=desc&page=1&limit=40';
      if (state.teamId) url += `&teamId=${state.teamId}`;
      if (state.userId && isManager()) url += `&userId=${state.userId}`;
      if (state.dateFrom) url += `&dateFrom=${state.dateFrom}`;
      if (state.dateTo) url += `&dateTo=${state.dateTo}`;

      const { data } = await api.get(url);
      clearElement(content);
      content.appendChild(renderHoursView(data, {
        team: teams.find((team) => team.id === state.teamId),
        members,
        selectedUserId: state.userId,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo
      }));
    } catch (err) {
      showError(err);
      hideLoading(content);
    }
  }
}

async function loadTeams() {
  try {
    const { data } = await api.get('/teams');
    const teams = data.teams || [];
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

async function loadTasks(teamId) {
  if (!teamId) return [];

  try {
    const { data } = await api.get(`/tasks?teamId=${teamId}&includeCompleted=true&page=1&limit=100`);
    return data.tasks || [];
  } catch {
    return [];
  }
}

function renderHoursView(data, { team, members, selectedUserId, dateFrom, dateTo }) {
  const logs = data.hoursLogs || [];
  const summary = data.summary || {};
  const byDate = data.charts?.byDate || [];
  const dailyEntries = byDate.map((entry) => ({
    label: formatDate(entry.workDate, { month: 'short', day: 'numeric' }),
    value: Number(entry.totalHours || 0)
  }));

  const avgEntryHours = summary.entryCount ? (summary.totalHours || 0) / summary.entryCount : 0;
  const activeDays = new Set(logs.map((entry) => entry.workDate)).size;
  const contributorCount = new Set(logs.map((entry) => entry.userFullName || entry.userId).filter(Boolean)).size;
  const taskMix = aggregateBy(logs, (entry) => entry.taskTitle || 'General work', 6);
  const peopleMix = aggregateBy(logs, (entry) => entry.userFullName || 'Unknown', 6);
  const weekdayMix = aggregateByWeekday(logs);
  const selectedEmployee = members.find((member) => member.id === selectedUserId);

  const fragment = el('div');
  fragment.append(
    buildHero({
      teamName: team?.name || 'Hours overview',
      range: formatDateRange(dateFrom, dateTo),
      summary,
      contributorCount,
      selectedEmployee
    }),
    el('div', { className: 'card-grid card-grid--dashboard' },
      summaryCard('Entries', formatNumber(summary.entryCount || logs.length), 'Number of visible time entries.'),
      summaryCard('Total hours', formatHours(summary.totalHours || 0), 'Total hours in the current range.'),
      summaryCard('Current week', formatHours(summary.currentWeekHours || 0), 'Hours recorded in the current week.'),
      summaryCard('Current month', formatHours(summary.currentMonthHours || 0), 'Hours recorded in the current month.'),
      summaryCard('Average entry', formatHours(avgEntryHours, 2), 'Average hours per logged entry.'),
      summaryCard(
        isManager() ? 'Active contributors' : 'Active workdays',
        formatNumber(isManager() ? contributorCount : activeDays),
        isManager() ? 'Employees who logged time in this range.' : 'Distinct dates with hours logged.'
      )
    ),
    buildChartGrid({
      dailyEntries,
      taskMix,
      peopleMix,
      weekdayMix
    }),
    buildDetailsSection(logs, {
      taskMix,
      peopleMix,
      weekdayMix,
      summary,
      activeDays
    })
  );

  return fragment;
}

function buildHero({ teamName, range, summary, contributorCount, selectedEmployee }) {
  return el('section', { className: 'page-hero page-hero--compact' },
    el('div', { className: 'page-hero__content' },
      el('p', { className: 'page-hero__eyebrow' }, 'Hours & Effort'),
      el('h2', { className: 'page-hero__title' }, teamName),
      el('p', { className: 'page-hero__description' },
        isManager()
          ? 'Track recent time entries, daily hours, and which teammates are carrying the most logged effort.'
          : 'Log time, review your recent entries, and compare task effort across the current date range.'
      )
    ),
    el('div', { className: 'page-hero__meta' },
      heroPill(`Range · ${range || 'Current selection'}`),
      heroPill(`Visible hours · ${formatHours(summary.totalHours || 0)}`),
      heroPill(isManager()
        ? `Contributors · ${formatNumber(contributorCount)}`
        : `Focus · ${selectedEmployee?.fullName || 'Personal log'}`
      )
    )
  );
}

function buildChartGrid({ dailyEntries, taskMix, peopleMix, weekdayMix }) {
  const grid = el('div', { className: 'chart-grid chart-grid--dashboard' });

  if (dailyEntries.length) {
    grid.appendChild(chartCard('Daily hours', 'hours-daily-chart', 'Daily totals from the current filter.'));
    requestAnimationFrame(() => barChart(
      'hours-daily-chart',
      dailyEntries.map((entry) => entry.label),
      [{ label: 'Hours', data: dailyEntries.map((entry) => entry.value), color: '#6366f1' }]
    ));
  }

  const mix = isManager() ? peopleMix : taskMix;
  if (mix.labels.length) {
    grid.appendChild(chartCard(
      isManager() ? 'Hours by employee' : 'Hours by task',
      'hours-mix-chart',
      isManager() ? 'See who logged the most time in this range.' : 'See where most of your time is being spent.'
    ));
    requestAnimationFrame(() => doughnutChart('hours-mix-chart', mix.labels, mix.values));
  }

  if (weekdayMix.labels.length) {
    grid.appendChild(chartCard('Weekday pattern', 'hours-weekday-chart', 'A quick view of when hours are being logged most often.'));
    requestAnimationFrame(() => barChart(
      'hours-weekday-chart',
      weekdayMix.labels,
      [{ label: 'Hours', data: weekdayMix.values, color: '#22c55e' }]
    ));
  }

  return grid.childNodes.length
    ? grid
    : el('section', { className: 'dashboard-section card', style: 'margin-top:24px' },
        emptyState('No hours charts yet', 'Charts will appear once time entries exist in the selected range.')
      );
}

function buildDetailsSection(logs, { taskMix, peopleMix, weekdayMix, summary, activeDays }) {
  const topTask = taskMix.labels[0];
  const topTaskHours = taskMix.values[0] || 0;
  const topContributor = peopleMix.labels[0];
  const topContributorHours = peopleMix.values[0] || 0;
  const busiestDay = weekdayMix.labels[weekdayMix.values.indexOf(Math.max(...weekdayMix.values, 0))];
  const averagePerDay = activeDays ? (summary.totalHours || 0) / activeDays : 0;

  return el('div', { className: 'dashboard-layout' },
    stackedSection(
      'Recent entries',
      'The latest hours logged in the current filter.',
      logs.length ? buildHoursTable(logs) : emptyState('No hours logged', 'No time entries were found for this date range.')
    ),
    stackedSection(
      'Allocation insights',
      'Quick summaries for presentations and manager reporting.',
      el('div', { className: 'metrics-panel' },
        metricTile('Top task', topTask || 'No task data'),
        metricTile('Task hours', formatHours(topTaskHours)),
        metricTile(isManager() ? 'Top contributor' : 'Most active day', isManager() ? (topContributor || 'No contributor data') : (busiestDay || 'No weekday data')),
        metricTile(isManager() ? 'Contributor hours' : 'Current month hours', isManager() ? formatHours(topContributorHours) : formatHours(summary.currentMonthHours || 0)),
        metricTile('Current week', formatHours(summary.currentWeekHours || 0)),
        metricTile('Avg per day', formatHours(averagePerDay, 2))
      )
    ),
    stackedSection(
      isManager() ? 'Employee breakdown' : 'Task breakdown',
      isManager()
        ? 'This is useful for the manager-facing reporting view from your slides.'
        : 'A quick look at how your effort is split across work items.',
      buildBreakdownList(isManager() ? peopleMix : taskMix)
    )
  );
}

function buildHoursTable(logs) {
  return el('div', { className: 'table-wrapper' },
    el('table', {},
      el('thead', {},
        el('tr', {},
          el('th', {}, 'Date'),
          isManager() ? el('th', {}, 'Employee') : null,
          el('th', {}, 'Team'),
          el('th', {}, 'Task'),
          el('th', {}, 'Hours'),
          el('th', {}, 'Note')
        )
      ),
      el('tbody', {},
        ...logs.map((entry) => el('tr', {},
          el('td', {}, formatDate(entry.workDate)),
          isManager() ? el('td', {}, entry.userFullName || '—') : null,
          el('td', {}, entry.teamName || '—'),
          el('td', {}, entry.taskTitle || 'General work'),
          el('td', {}, formatHours(entry.hours || 0)),
          el('td', {}, entry.note || '—')
        ))
      )
    )
  );
}

function buildBreakdownList(series) {
  if (!series.labels.length) {
    return emptyState('No breakdown data', 'The current range does not have enough hours data to build a breakdown.');
  }

  return el('div', { className: 'breakdown-list' },
    ...series.labels.map((label, index) => el('div', { className: 'breakdown-item' },
      el('div', { className: 'breakdown-item__copy' },
        el('strong', {}, label),
        el('span', {}, `${formatPercent(series.share[index] || 0, 1)} of visible hours`)
      ),
      el('div', { className: 'breakdown-item__value' }, formatHours(series.values[index] || 0))
    ))
  );
}

function buildLogForm({ teams, initialTeamId, onSuccess }) {
  const section = el('section', { className: 'dashboard-section card', style: 'margin-bottom:24px' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, 'Log Hours'),
        el('p', { className: 'section-subtitle' }, 'Add a time entry tied to a team and, if you want, a specific task.')
      )
    )
  );

  const form = el('form', {},
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Team'),
        buildSelect(teams.map((team) => ({ value: team.id, label: team.name })))
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Task'),
        buildSelect([{ value: '', label: 'General team work' }])
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Work date'),
        el('input', { className: 'form-input', name: 'workDate', type: 'date', value: todayDateString(), required: true })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Hours'),
        el('input', { className: 'form-input', name: 'hours', type: 'number', min: '0.25', max: '24', step: '0.25', placeholder: '0', required: true })
      )
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Note'),
      el('textarea', { className: 'form-textarea', name: 'note', placeholder: 'What did you work on?' })
    )
  );

  const [teamSelect, taskSelect] = form.querySelectorAll('select');
  teamSelect.name = 'teamId';
  taskSelect.name = 'taskId';
  teamSelect.value = initialTeamId || selectPreferredTeam(teams)?.id || teams[0]?.id || '';

  async function refreshTasks() {
    const tasks = await loadTasks(teamSelect.value);
    clearElement(taskSelect);
    taskSelect.appendChild(el('option', { value: '' }, 'General team work'));
    tasks.forEach((task) => {
      taskSelect.appendChild(el('option', { value: task.id }, task.title));
    });
  }

  teamSelect.addEventListener('change', refreshTasks);
  refreshTasks();

  const submitBtn = el('button', { className: 'btn btn-primary', type: 'submit' }, 'Log Hours');
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    submitBtn.disabled = true;
    try {
      const payload = {
        teamId: form.querySelector('[name="teamId"]').value,
        workDate: form.querySelector('[name="workDate"]').value,
        hours: Number(form.querySelector('[name="hours"]').value),
        note: form.querySelector('[name="note"]').value.trim() || undefined
      };

      const taskId = form.querySelector('[name="taskId"]').value;
      if (taskId) payload.taskId = taskId;

      await api.post('/hours-logged', payload);
      showSuccess('Hours logged successfully.');
      form.querySelector('[name="hours"]').value = '';
      form.querySelector('[name="note"]').value = '';
      await onSuccess(payload.teamId);
    } catch (err) {
      showError(err);
    }
    submitBtn.disabled = false;
  });

  section.appendChild(form);
  return section;
}

function aggregateBy(items, getKey, limit = 6) {
  const totals = new Map();

  items.forEach((item) => {
    const key = getKey(item);
    const current = totals.get(key) || 0;
    totals.set(key, current + Number(item.hours || 0));
  });

  const rows = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const total = rows.reduce((sum, [, value]) => sum + value, 0);

  return {
    labels: rows.map(([label]) => label),
    values: rows.map(([, value]) => value),
    share: rows.map(([, value]) => total ? (value / total) * 100 : 0)
  };
}

function aggregateByWeekday(items) {
  const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totals = new Map(order.map((day) => [day, 0]));

  items.forEach((item) => {
    if (!item.workDate) return;
    const weekday = order[new Date(item.workDate).getDay()];
    totals.set(weekday, (totals.get(weekday) || 0) + Number(item.hours || 0));
  });

  const labels = order.filter((day) => (totals.get(day) || 0) > 0);
  return {
    labels,
    values: labels.map((day) => totals.get(day) || 0),
    share: []
  };
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

function summaryCard(label, value, note) {
  return el('div', { className: 'card dashboard-stat-card' },
    el('div', { className: 'card-title' }, label),
    el('div', { className: 'card-value' }, value),
    el('div', { className: 'card-footer' }, note)
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

function stackedSection(title, subtitle, body) {
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

function heroPill(text) {
  return el('span', { className: 'hero-pill' }, text);
}

function metricTile(label, value) {
  return el('div', { className: 'metrics-panel__item' },
    el('span', { className: 'metrics-panel__label' }, label),
    el('strong', { className: 'metrics-panel__value' }, value)
  );
}
