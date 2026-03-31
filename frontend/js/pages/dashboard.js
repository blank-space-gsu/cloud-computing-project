import { el, clearElement } from '../utils/dom.js';
import { isManager, isEmployee, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError } from '../components/toast.js';
import { doughnutChart, barChart, lineChart, STATUS_COLORS, PRIORITY_COLORS } from '../components/charts.js';
import { taskCard } from '../components/taskCard.js';
import {
  capitalize,
  firstDayOfCurrentMonth,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatHours,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatTimeRemaining,
  formatTrendLabel,
  formatTrendTooltip,
  lastDayOfCurrentMonth
} from '../utils/format.js';
import { selectPreferredTeam } from '../utils/teams.js';

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
  const user = getUser();
  const primaryTeamId = user.teams?.[0]?.teamId || null;
  const monthRange = {
    start: firstDayOfCurrentMonth(),
    end: lastDayOfCurrentMonth()
  };

  const [
    dashboardRes,
    productivityRes,
    goalsRes,
    hoursRes,
    tasksRes,
    membersRes
  ] = await Promise.all([
    api.get('/dashboards/employee'),
    api.get('/productivity-metrics'),
    api.get(`/goals?sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=6`),
    api.get(`/hours-logged?dateFrom=${monthRange.start}&dateTo=${monthRange.end}&limit=6`),
    api.get('/tasks?sortBy=urgency&sortOrder=asc&includeCompleted=false&page=1&limit=6'),
    primaryTeamId ? api.get(`/teams/${primaryTeamId}/members`) : Promise.resolve({ data: { members: [] } })
  ]);

  clearElement(container);

  const dashboard = dashboardRes.data;
  const productivity = productivityRes.data;
  const goals = goalsRes.data;
  const hours = hoursRes.data;
  const tasks = tasksRes.data.tasks || [];
  const members = membersRes.data.members || [];

  const hero = buildHero({
    eyebrow: 'Employee Overview',
    title: 'Your weekly task command center',
    description: 'Track deadlines, monitor your weekly completion, review hours, and keep goal progress visible in one place.',
    meta: [
      pill(`Team · ${user.teams?.[0]?.teamName || 'No team'}`),
      pill(`Tasks this week · ${dashboard.summary.currentWeekTaskCount || 0}`),
      pill(`Month window · ${formatDateRange(monthRange.start, monthRange.end)}`)
    ]
  });

  const summary = dashboard.summary || {};
  const monthlyRollup = productivity.rollups?.monthly || {};
  const goalsSummary = goals.summary || {};
  const hoursSummary = hours.summary || {};

  const stats = metricGrid([
    metricCard('Assigned tasks', formatCompactNumber(summary.assignedTaskCount || 0), 'Everything currently assigned to you.'),
    metricCard('Completion rate', formatPercent(summary.completionRate || 0, 1), 'Share of assigned work already completed.'),
    metricCard('Average progress', formatPercent(summary.averageProgressPercent || 0, 1), 'Average progress across your active tasks.'),
    metricCard('Open estimated hours', formatHours(summary.openEstimatedHours || 0), 'Estimated effort still open right now.'),
    metricCard('Logged this month', formatHours(hoursSummary.currentMonthHours || 0), 'Hours recorded during the current month.'),
    metricCard('Active goals', formatCompactNumber(goalsSummary.activeGoalCount || 0), 'Visible team and user goals in your scope.')
  ]);

  const snapshotStrip = rollupStrip('Performance snapshots', [
    rollupItem('Weekly', productivity.rollups?.weekly),
    rollupItem('Monthly', productivity.rollups?.monthly),
    rollupItem('Yearly', productivity.rollups?.yearly)
  ]);

  const charts = el('div', { className: 'chart-grid chart-grid--dashboard' });
  charts.appendChild(chartCard('Weekly task completion', 'dash-employee-weekly', 'See how your tasks are grouped by week start date.'));
  requestAnimationFrame(() => barChart(
    'dash-employee-weekly',
    (dashboard.charts?.byWeek || []).map((point) => formatShortDate(point.weekStartDate)),
    [{ label: 'Tasks', data: (dashboard.charts?.byWeek || []).map((point) => point.count), color: '#6366f1' }]
  ));

  charts.appendChild(chartCard('Task status mix', 'dash-employee-status', 'A quick view of what is waiting, completed, or blocked.'));
  requestAnimationFrame(() => doughnutChart(
    'dash-employee-status',
    (dashboard.charts?.byStatus || []).map((item) => item.status),
    (dashboard.charts?.byStatus || []).map((item) => item.count),
    STATUS_COLORS
  ));

  charts.appendChild(chartCard('Priority pressure', 'dash-employee-priority', 'High-priority work appears here first.'));
  requestAnimationFrame(() => doughnutChart(
    'dash-employee-priority',
    (dashboard.charts?.byPriority || []).map((item) => item.priority),
    (dashboard.charts?.byPriority || []).map((item) => item.count),
    PRIORITY_COLORS
  ));

  charts.appendChild(trendChartCard({
    title: 'Monthly productivity trend',
    canvasId: 'dash-employee-trend',
    subtitle: 'Completed tasks and logged hours across recent weeks.',
    points: productivity.charts?.weeklyTrend || [],
    datasets: [
      { label: 'Completed Tasks', dataKey: 'completedTaskCount', color: '#22c55e' },
      { label: 'Hours Logged', dataKey: 'loggedHours', color: '#06b6d4' }
    ]
  }));

  const sections = el('div', { className: 'dashboard-layout' },
        stackedSection(
          'My active tasks',
          'Your prioritized task list for the current week.',
          tasks.length
            ? el('div', { className: 'task-list dashboard-task-list dashboard-task-list--compact' }, ...tasks.map((task) => taskCard(task, { variant: 'compact' })))
            : emptyState('No active tasks', 'You do not have active tasks right now.')
        ),
    stackedSection(
      'Upcoming deadlines',
      'Ordered by urgency, with due pressure highlighted.',
      deadlineList(dashboard.tasks?.upcomingDeadlines || [])
    ),
    stackedSection(
      'My team',
      'The teammate roster for your primary team.',
      members.length
        ? el('div', { className: 'member-grid dashboard-member-grid' }, ...members.map((member) => memberCard(member)))
        : emptyState('No team members', 'No team roster was returned for your current team.')
    ),
    stackedSection(
      'Goal spotlight',
      'Current quotas and shared targets in your scope.',
      goals.goals?.length
        ? el('div', { className: 'goal-spotlight-grid' }, ...goals.goals.slice(0, 3).map(goalSpotlightCard))
        : emptyState('No goals yet', 'No goals are available for this employee profile.')
    ),
    stackedSection(
      'Recent hours',
      'Your latest time entries in the current month window.',
      hours.hoursLogs?.length
        ? miniTable(
            ['Date', 'Task', 'Hours'],
            hours.hoursLogs.slice(0, 5).map((entry) => [
              formatDate(entry.workDate),
              entry.taskTitle || 'General work',
              formatHours(entry.hours)
            ])
          )
        : emptyState('No hours logged', 'Hours entries will appear here once you start logging time.')
    ),
    stackedSection(
      'Monthly productivity details',
      'Key performance numbers based on task completion and logged hours.',
      metricsPanel([
        ['Tasks this month', formatNumber(monthlyRollup.taskCount || 0)],
        ['Completed', formatNumber(monthlyRollup.completedTaskCount || 0)],
        ['Open', formatNumber(monthlyRollup.openTaskCount || 0)],
        ['Logged hours', formatHours(monthlyRollup.loggedHours || 0)],
        ['Estimated hours', formatHours(monthlyRollup.estimatedHours || 0)],
        ['Logged vs estimated', formatPercent(monthlyRollup.loggedVsEstimatedPercent || 0, 1)]
      ])
    )
  );

  container.append(hero, stats, snapshotStrip, charts, sections);
}

async function renderManagerDashboard(container) {
  const teamResponse = await api.get('/teams');
  const teams = (teamResponse.data.teams || []).filter((team) => team.canManageTeam);

  clearElement(container);

  if (!teams.length) {
    container.appendChild(emptyState('No manageable teams', 'This manager account does not currently have a team to manage.'));
    return;
  }

  let selectedTeamId = selectPreferredTeam(teams)?.id || teams[0].id;
  const shell = el('div');
  const controlBar = el('div', { className: 'filters-bar filters-bar--hero' });
  const teamSelect = el('select', { className: 'form-select' },
    ...teams.map((team) => el('option', { value: team.id }, team.name))
  );
  teamSelect.value = selectedTeamId;
  teamSelect.addEventListener('change', async () => {
    selectedTeamId = teamSelect.value;
    await loadManagerData(selectedTeamId);
  });

  controlBar.appendChild(
    el('div', { className: 'filter-group' },
      el('label', {}, 'Team dashboard'),
      teamSelect
    )
  );

  const content = el('div');
  shell.append(controlBar, content);
  container.appendChild(shell);

  async function loadManagerData(teamId) {
    clearElement(content);
    showLoading(content);

    try {
      const monthRange = {
        start: firstDayOfCurrentMonth(),
        end: lastDayOfCurrentMonth()
      };

      const [
        dashboardRes,
        productivityRes,
        goalsRes,
        hoursRes,
        tasksRes,
        teamMembersRes
      ] = await Promise.all([
        api.get(`/dashboards/manager?teamId=${teamId}`),
        api.get(`/productivity-metrics?scope=team&teamId=${teamId}`),
        api.get(`/goals?teamId=${teamId}&sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=6`),
        api.get(`/hours-logged?teamId=${teamId}&dateFrom=${monthRange.start}&dateTo=${monthRange.end}&limit=20`),
        api.get(`/tasks?teamId=${teamId}&sortBy=urgency&sortOrder=asc&includeCompleted=true&page=1&limit=6`),
        api.get(`/teams/${teamId}/members`)
      ]);

      clearElement(content);

      const dashboard = dashboardRes.data;
      const productivity = productivityRes.data;
      const goals = goalsRes.data;
      const hours = hoursRes.data;
      const tasks = tasksRes.data.tasks || [];
      const teamInfo = teamMembersRes.data.team || teams.find((team) => team.id === teamId);
      const mergedMembers = mergeMemberMetrics(teamMembersRes.data.members || [], productivity.breakdown?.members || []);

      const summary = dashboard.summary || {};
      const monthlyRollup = productivity.rollups?.monthly || {};
      const goalsSummary = goals.summary || {};
      const hoursSummary = hours.summary || {};

      const hero = buildHero({
        eyebrow: 'Manager Overview',
        title: teamInfo?.name || 'Team dashboard',
        description: teamInfo?.description || 'Monitor assignment pressure, productivity, hours, and quota progress for the selected team.',
        meta: [
          pill(`Members · ${teamInfo?.memberCount || mergedMembers.length}`),
          pill(`Manager view · ${capitalize(getUser().appRole)}`),
          pill(`Month window · ${formatDateRange(monthRange.start, monthRange.end)}`)
        ]
      });

      const stats = metricGrid([
        metricCard('Total tasks', formatCompactNumber(summary.totalTaskCount || 0), 'Tracked tasks in this team scope.'),
        metricCard('Completion rate', formatPercent(summary.completionRate || 0, 1), 'Share of tasks already completed.'),
        metricCard('Overdue tasks', formatCompactNumber(summary.overdueTaskCount || 0), 'Items already past their due date.', summary.overdueTaskCount ? 'danger' : null),
        metricCard('Unassigned tasks', formatCompactNumber(summary.unassignedTaskCount || 0), 'Tasks still waiting for assignment.', summary.unassignedTaskCount ? 'warning' : null),
        metricCard('Logged this month', formatHours(hoursSummary.currentMonthHours || 0), 'Hours recorded by the selected team.'),
        metricCard('Open goals', formatCompactNumber(goalsSummary.openGoalCount || 0), 'Quota targets still in progress.'),
        metricCard('Average progress', formatPercent(summary.averageProgressPercent || 0, 1), 'Average task progress across the team.'),
        metricCard('Logged vs estimated', formatPercent(monthlyRollup.loggedVsEstimatedPercent || 0, 1), 'How logged time compares to estimated effort.')
      ]);

      const charts = el('div', { className: 'chart-grid chart-grid--dashboard' });
      charts.appendChild(chartCard('Workload by employee', 'dash-manager-workload', 'Assigned task counts by teammate.'));
      requestAnimationFrame(() => barChart(
        'dash-manager-workload',
        (dashboard.charts?.workloadByEmployee || []).map((member) => member.fullName),
        [
          {
            label: 'Assigned tasks',
            data: (dashboard.charts?.workloadByEmployee || []).map((member) => member.assignedTaskCount),
            color: '#6366f1'
          }
        ],
        true
      ));

      charts.appendChild(chartCard('Team productivity comparison', 'dash-manager-productivity', 'Completed tasks and logged hours for each teammate.'));
      requestAnimationFrame(() => barChart(
        'dash-manager-productivity',
        mergedMembers.filter((member) => member.appRole === 'employee').map((member) => member.fullName),
        [
          {
            label: 'Completed tasks',
            data: mergedMembers.filter((member) => member.appRole === 'employee').map((member) => member.completedTaskCount || 0),
            color: '#22c55e'
          },
          {
            label: 'Hours logged',
            data: mergedMembers.filter((member) => member.appRole === 'employee').map((member) => member.loggedHours || 0),
            color: '#06b6d4'
          }
        ]
      ));

      charts.appendChild(chartCard('Task status mix', 'dash-manager-status', 'Current task stages across the selected team.'));
      requestAnimationFrame(() => doughnutChart(
        'dash-manager-status',
        (dashboard.charts?.byStatus || []).map((item) => item.status),
        (dashboard.charts?.byStatus || []).map((item) => item.count),
        STATUS_COLORS
      ));

      charts.appendChild(trendChartCard({
        title: 'Monthly trend',
        canvasId: 'dash-manager-trend',
        subtitle: 'Completed tasks and logged hours across recent weeks.',
        points: productivity.charts?.weeklyTrend || [],
        datasets: [
          { label: 'Completed Tasks', dataKey: 'completedTaskCount', color: '#22c55e' },
          { label: 'Hours Logged', dataKey: 'loggedHours', color: '#06b6d4' }
        ]
      }));

      const sections = el('div', { className: 'dashboard-layout' },
        stackedSection(
          'Priority task board',
          'The most urgent or visible tasks in the current team scope.',
          tasks.length
            ? el('div', { className: 'task-list dashboard-task-list dashboard-task-list--compact' }, ...tasks.map((task) => taskCard(task, { showAssignee: true, variant: 'compact' })))
            : emptyState('No tasks found', 'There are no tasks to show for this team.')
        ),
        stackedSection(
          'Upcoming deadlines',
          'Ordered by urgency and due pressure.',
          deadlineList(dashboard.tasks?.upcomingDeadlines || [])
        ),
        stackedSection(
          'Team performance roster',
          'Employee task volume, progress, and logged time in one place.',
          mergedMembers.length
            ? performanceRoster(mergedMembers)
            : emptyState('No roster data', 'No member data is available for this team yet.')
        ),
        stackedSection(
          'Goal spotlight',
          'Key quota targets attached to this team.',
          goals.goals?.length
            ? el('div', { className: 'goal-spotlight-grid' }, ...goals.goals.slice(0, 3).map(goalSpotlightCard))
            : emptyState('No goals', 'No goals have been created for this team yet.')
        ),
        stackedSection(
          'Recent hours activity',
          'The most recent time entries from this team.',
          hours.hoursLogs?.length
            ? miniTable(
                ['Date', 'Employee', 'Task', 'Hours'],
                hours.hoursLogs.slice(0, 6).map((entry) => [
                  formatDate(entry.workDate),
                  entry.userFullName,
                  entry.taskTitle || 'General work',
                  formatHours(entry.hours)
                ])
              )
            : emptyState('No hours entries', 'No hours were logged in the current range.')
        ),
        stackedSection(
          'Monthly productivity details',
          'Operational summary for the current month window.',
          metricsPanel([
            ['Tasks', formatNumber(monthlyRollup.taskCount || 0)],
            ['Completed', formatNumber(monthlyRollup.completedTaskCount || 0)],
            ['Open', formatNumber(monthlyRollup.openTaskCount || 0)],
            ['Blocked', formatNumber(monthlyRollup.blockedTaskCount || 0)],
            ['Urgent', formatNumber(monthlyRollup.urgentTaskCount || 0)],
            ['Logged hours', formatHours(monthlyRollup.loggedHours || 0)],
            ['Estimated hours', formatHours(monthlyRollup.estimatedHours || 0)],
            ['Completion rate', formatPercent(monthlyRollup.completionRate || 0, 1)]
          ])
        )
      );

      content.append(hero, stats, charts, sections);
    } catch (err) {
      showError(err);
      hideLoading(content);
    }
  }

  await loadManagerData(selectedTeamId);
}

function buildHero({ eyebrow, title, description, meta = [] }) {
  return el('section', { className: 'page-hero' },
    el('div', { className: 'page-hero__content' },
      el('p', { className: 'page-hero__eyebrow' }, eyebrow),
      el('h2', { className: 'page-hero__title' }, title),
      el('p', { className: 'page-hero__description' }, description)
    ),
    el('div', { className: 'page-hero__meta' }, ...meta)
  );
}

function pill(text) {
  return el('span', { className: 'hero-pill' }, text);
}

function metricGrid(items) {
  return el('div', { className: 'card-grid card-grid--dashboard' }, ...items);
}

function metricCard(label, value, note, tone) {
  return el('div', { className: `card dashboard-stat-card${tone ? ` dashboard-stat-card--${tone}` : ''}` },
    el('div', { className: 'card-title' }, label),
    el('div', { className: 'card-value' }, value),
    el('div', { className: 'card-footer' }, note)
  );
}

function rollupStrip(title, items) {
  return el('section', { className: 'insight-strip' },
    el('div', { className: 'insight-strip__header' },
      el('h3', {}, title),
      el('p', {}, 'Weekly, monthly, and yearly rollups from the productivity endpoint.')
    ),
    el('div', { className: 'insight-strip__grid' }, ...items)
  );
}

function rollupItem(label, rollup = {}) {
  return el('article', { className: 'rollup-card' },
    el('p', { className: 'rollup-card__label' }, label),
    el('div', { className: 'rollup-card__metrics' },
      rollupMetric('Tasks', formatNumber(rollup.taskCount || 0)),
      rollupMetric('Completed', formatNumber(rollup.completedTaskCount || 0)),
      rollupMetric('Hours', formatHours(rollup.loggedHours || 0)),
      rollupMetric('Rate', formatPercent(rollup.completionRate || 0, 1))
    )
  );
}

function rollupMetric(label, value) {
  return el('div', { className: 'rollup-card__metric' },
    el('span', {}, label),
    el('strong', {}, value)
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
  return el('section', { className: 'dashboard-section card' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, title),
        subtitle ? el('p', { className: 'section-subtitle' }, subtitle) : null
      )
    ),
    body
  );
}

function deadlineList(tasks) {
  if (!tasks.length) {
    return emptyState('Nothing urgent', 'No deadline items are waiting right now.');
  }

  return el('div', { className: 'deadline-list' },
    ...tasks.slice(0, 6).map((task) => el('div', { className: 'deadline-item' },
      el('div', { className: 'deadline-item__main' },
        el('strong', {}, task.title),
        el('span', {}, task.assignment?.assigneeFullName || task.teamName || 'Unassigned')
      ),
      el('div', { className: 'deadline-item__meta' },
        el('span', { className: `badge badge-${task.isOverdue ? 'danger' : task.isDueSoon ? 'warning' : 'default'}` }, task.isOverdue ? 'Overdue' : task.isDueSoon ? 'Due Soon' : capitalize(task.status)),
        el('span', {}, task.dueAt ? formatDate(task.dueAt) : 'No due date'),
        el('span', {}, formatTimeRemaining(task.timeRemainingSeconds))
      )
    ))
  );
}

function memberCard(member) {
  const initials = `${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}` || '?';
  return el('div', { className: 'member-card member-card--dashboard' },
    el('div', { className: 'member-avatar' }, initials),
    el('div', { className: 'member-info' },
      el('h4', {}, member.fullName),
      el('p', {}, member.jobTitle || capitalize(member.membershipRole || member.appRole)),
      el('span', { className: `badge badge-${member.appRole === 'manager' ? 'primary' : 'info'}` }, capitalize(member.appRole))
    )
  );
}

function goalSpotlightCard(goal) {
  const valueText = goal.unit === 'USD'
    ? `${formatCurrency(goal.actualValue, goal.unit)} / ${formatCurrency(goal.targetValue, goal.unit)}`
    : `${formatNumber(goal.actualValue)} / ${formatNumber(goal.targetValue)} ${goal.unit}`;

  return el('article', { className: 'goal-highlight-card' },
    el('div', { className: 'goal-highlight-card__head' },
      el('h4', {}, goal.title),
      el('span', { className: `badge badge-${goal.isTargetMet ? 'success' : 'primary'}` }, goal.isTargetMet ? 'Met' : capitalize(goal.scope))
    ),
    el('p', { className: 'goal-highlight-card__meta' }, goal.targetUser ? goal.targetUser.fullName : goal.teamName),
    el('div', { className: 'goal-highlight-card__value' }, valueText),
    el('div', { className: 'progress-bar-container progress-bar-container--lg' },
      el('div', { className: 'progress-bar', style: `width:${Math.min(100, goal.progressPercent || 0)}%` })
    ),
    el('div', { className: 'goal-highlight-card__footer' },
      el('span', {}, `${formatPercent(goal.progressPercent || 0)} complete`),
      el('span', {}, formatDateRange(goal.startDate, goal.endDate))
    )
  );
}

function miniTable(headers, rows) {
  return el('div', { className: 'table-wrapper table-wrapper--mini' },
    el('table', {},
      el('thead', {},
        el('tr', {}, ...headers.map((header) => el('th', {}, header)))
      ),
      el('tbody', {},
        ...rows.map((row) => el('tr', {}, ...row.map((cell) => el('td', {}, cell))))
      )
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

function mergeMemberMetrics(members, breakdown) {
  const breakdownByUserId = new Map(breakdown.map((member) => [member.userId, member]));

  return members.map((member) => ({
    ...member,
    ...(breakdownByUserId.get(member.id) || {})
  }));
}

function performanceRoster(members) {
  const employeeRows = members.filter((member) => member.appRole === 'employee');

  if (!employeeRows.length) {
    return emptyState('No employee metrics', 'Employee comparison data is not available yet.');
  }

  return el('div', { className: 'performance-roster' },
    ...employeeRows.map((member) => el('div', { className: 'performance-roster__card' },
      el('div', { className: 'performance-roster__header' },
        el('div', {},
          el('h4', {}, member.fullName),
          el('p', {}, member.jobTitle || 'Team member')
        ),
        el('span', { className: 'badge badge-info' }, `${formatPercent(member.completionRate || 0, 1)} completion`)
      ),
      el('div', { className: 'performance-roster__grid' },
        rosterStat('Tasks', formatNumber(member.taskCount || 0)),
        rosterStat('Completed', formatNumber(member.completedTaskCount || 0)),
        rosterStat('Hours', formatHours(member.loggedHours || 0)),
        rosterStat('Est. hours', formatHours(member.estimatedHours || 0)),
        rosterStat('Avg progress', formatPercent(member.averageProgressPercent || 0, 1)),
        rosterStat('Logged vs est.', formatPercent(member.loggedVsEstimatedPercent || 0, 1))
      )
    ))
  );
}

function rosterStat(label, value) {
  return el('div', { className: 'performance-roster__stat' },
    el('span', {}, label),
    el('strong', {}, value)
  );
}
