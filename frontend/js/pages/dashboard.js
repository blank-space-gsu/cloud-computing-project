import { el, clearElement } from '../utils/dom.js';
import { isEmployee, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { doughnutChart, barChart, STATUS_COLORS } from '../components/charts.js';
import {
  capitalize,
  formatCompactNumber,
  formatCurrency,
  formatDateRange,
  formatNumber,
  formatPercent,
  formatShortDate,
  statusLabel,
  formatTimeRemaining
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam } from '../utils/teams.js';

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
    clearElement(container);
    container.appendChild(emptyState('Unable to load dashboard', err.message || 'The dashboard could not be rendered right now.'));
  }
}

async function renderEmployeeDashboard(container) {
  const user = getUser();

  const [dashboardRes, goalsRes, tasksRes, teamsRes] = await Promise.all([
    api.get('/dashboards/employee'),
    api.get('/goals?sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=4'),
    api.get('/tasks?sortBy=urgency&sortOrder=asc&includeCompleted=false&page=1&limit=6'),
    api.get('/teams')
  ]);

  clearElement(container);

  const dashboard = dashboardRes.data;
  const goals = goalsRes.data;
  const tasks = tasksRes.data.tasks || [];
  const summary = dashboard.summary || {};
  const goalsSummary = goals.summary || {};
  const preferredTeam = selectPreferredTeam(getVisibleTeams(teamsRes.data.teams || []));

  const hero = buildHero({
    eyebrow: 'Employee Overview',
    title: 'Your task command center',
    description: 'See the assignments, deadlines, and goal progress that matter most without extra clutter.',
    meta: [
      pill(`Team · ${preferredTeam?.name || user.teams?.[0]?.teamName || 'No team'}`),
      pill(`Tasks this week · ${summary.currentWeekTaskCount || 0}`)
    ],
    className: 'page-hero page-hero--employee'
  });

  const overview = el('div', { className: 'dashboard-top-split dashboard-top-split--employee' },
    hero,
    summaryTableCard('At a glance', [
      {
        label: 'Assigned tasks',
        value: formatCompactNumber(summary.assignedTaskCount || 0),
        note: 'Current work assigned to you.'
      },
      {
        label: 'Completion rate',
        value: formatPercent(summary.completionRate || 0, 1),
        note: 'How much assigned work is already finished.'
      },
      {
        label: 'Average progress',
        value: formatPercent(summary.averageProgressPercent || 0, 1),
        note: 'Progress across your active tasks.'
      },
      {
        label: 'Tasks this month',
        value: formatCompactNumber(summary.currentMonthTaskCount || 0),
        note: 'Work counted in the current month window.'
      },
      {
        label: 'Active goals',
        value: formatCompactNumber(goalsSummary.activeGoalCount || 0),
        note: 'Current goals visible to you.'
      }
    ])
  );

  const charts = el('div', { className: 'chart-grid chart-grid--dashboard' },
    chartCard('Weekly task completion', 'dash-employee-weekly', 'See how your recent tasks are grouped by week.'),
    chartCard('Task status mix', 'dash-employee-status', 'A quick view of what is waiting, active, or blocked.')
  );

  requestAnimationFrame(() => barChart(
    'dash-employee-weekly',
    (dashboard.charts?.byWeek || []).map((point) => formatShortDate(point.weekStartDate)),
    [{ label: 'Tasks', data: (dashboard.charts?.byWeek || []).map((point) => point.count), color: '#6366f1' }]
  ));

  requestAnimationFrame(() => doughnutChart(
    'dash-employee-status',
    (dashboard.charts?.byStatus || []).map((item) => item.status),
    (dashboard.charts?.byStatus || []).map((item) => item.count),
    STATUS_COLORS
  ));

  const sections = el('div', { className: 'dashboard-layout' },
    stackedSection(
      'My active tasks',
      'Your prioritized task list for the current week.',
      tasks.length
        ? buildTaskAccordionList(tasks, {
            onComplete: (task) => quickCompleteTask(task, () => renderEmployeeDashboard(container))
          })
        : emptyState('No active tasks', 'You do not have active tasks right now.')
    ),
    stackedSection(
      'Upcoming deadlines',
      'Ordered by urgency, with due pressure highlighted.',
      deadlineList(dashboard.tasks?.upcomingDeadlines || [])
    ),
    stackedSection(
      'Goal spotlight',
      'Current quotas and shared targets in your scope.',
      goals.goals?.length
        ? el('div', { className: 'goal-spotlight-grid' }, ...goals.goals.slice(0, 3).map(goalSpotlightCard))
        : emptyState('No goals yet', 'No goals are available for this employee profile.')
    )
  );

  container.append(overview, charts, sections);
}

async function renderManagerDashboard(container) {
  const teamResponse = await api.get('/teams');
  const teams = getVisibleTeams((teamResponse.data.teams || []).filter((team) => team.canManageTeam));

  clearElement(container);

  if (!teams.length) {
    container.appendChild(emptyState('No manageable teams', 'This manager account does not currently have a team to manage.'));
    return;
  }

  let selectedTeamId = selectPreferredTeam(teams)?.id || teams[0].id;
  const shell = el('div');
  const content = el('div');

  if (teams.length > 1) {
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

    shell.appendChild(controlBar);
  }

  shell.appendChild(content);
  container.appendChild(shell);

  async function loadManagerData(teamId) {
    clearElement(content);
    showLoading(content);

    try {
      const [dashboardRes, productivityRes, goalsRes, tasksRes, teamMembersRes] = await Promise.all([
        api.get(`/dashboards/manager?teamId=${teamId}`),
        api.get(`/productivity-metrics?scope=team&teamId=${teamId}`),
        api.get(`/goals?teamId=${teamId}&sortBy=endDate&sortOrder=asc&includeCancelled=false&limit=6`),
        api.get(`/tasks?teamId=${teamId}&sortBy=urgency&sortOrder=asc&includeCompleted=true&page=1&limit=6`),
        api.get(`/teams/${teamId}/members`)
      ]);

      clearElement(content);

      const dashboard = dashboardRes.data;
      const productivity = productivityRes.data;
      const goals = goalsRes.data;
      const tasks = tasksRes.data.tasks || [];
      const teamInfo = teamMembersRes.data.team || teams.find((team) => team.id === teamId);
      const mergedMembers = mergeMemberMetrics(teamMembersRes.data.members || [], productivity.breakdown?.members || []);
      const employeeRows = mergedMembers.filter((member) => member.appRole === 'employee');

      const summary = dashboard.summary || {};
      const goalsSummary = goals.summary || {};

      const hero = buildHero({
        eyebrow: 'Manager Overview',
        title: teamInfo?.name || 'Team dashboard',
        description: teamInfo?.description || 'Focus on assignment pressure, task progress, and the key team outcomes that matter.',
        meta: [
          pill(`Members · ${teamInfo?.memberCount || mergedMembers.length}`),
          pill(`Overdue · ${summary.overdueTaskCount || 0}`),
          pill(`Active goals · ${goalsSummary.activeGoalCount || 0}`)
        ],
        className: 'page-hero'
      });

      const overview = el('div', { className: 'dashboard-top-split' },
        hero,
        summaryTableCard('At a glance', [
          {
            label: 'Total tasks',
            value: formatCompactNumber(summary.totalTaskCount || 0),
            note: 'Tracked tasks in this team scope.'
          },
          {
            label: 'Completion rate',
            value: formatPercent(summary.completionRate || 0, 1),
            note: 'Share of tasks already completed.'
          },
          {
            label: 'Overdue tasks',
            value: formatCompactNumber(summary.overdueTaskCount || 0),
            note: 'Items already past their due date.'
          },
          {
            label: 'Unassigned tasks',
            value: formatCompactNumber(summary.unassignedTaskCount || 0),
            note: 'Tasks still waiting for assignment.'
          },
          {
            label: 'Active goals',
            value: formatCompactNumber(goalsSummary.activeGoalCount || 0),
            note: 'Quota targets still in progress.'
          },
          {
            label: 'Average progress',
            value: formatPercent(summary.averageProgressPercent || 0, 1),
            note: 'Average task progress across the team.'
          }
        ])
      );

      const charts = el('div', { className: 'chart-grid chart-grid--dashboard' },
        chartCard('Workload by employee', 'dash-manager-workload', 'Assigned task counts by teammate.'),
        chartCard('Task status mix', 'dash-manager-status', 'Current task stages across the selected team.')
      );

      requestAnimationFrame(() => barChart(
        'dash-manager-workload',
        (dashboard.charts?.workloadByEmployee || []).map((member) => member.fullName),
        [{
          label: 'Assigned tasks',
          data: (dashboard.charts?.workloadByEmployee || []).map((member) => member.assignedTaskCount),
          color: '#6366f1'
        }],
        true
      ));

      requestAnimationFrame(() => doughnutChart(
        'dash-manager-status',
        (dashboard.charts?.byStatus || []).map((item) => item.status),
        (dashboard.charts?.byStatus || []).map((item) => item.count),
        STATUS_COLORS
      ));

      const sections = el('div', { className: 'dashboard-layout' },
        stackedSection(
          'Priority tasks',
          'The most urgent work in the current team scope.',
          tasks.length
            ? buildTaskAccordionList(tasks, {
                showAssignee: true,
                onComplete: (task) => quickCompleteTask(task, () => loadManagerData(teamId))
              })
            : emptyState('No tasks found', 'There are no tasks to show for this team.')
        ),
        stackedSection(
          'Upcoming deadlines',
          'The next due and overdue tasks that need attention.',
          deadlineList(dashboard.tasks?.upcomingDeadlines || [])
        ),
        stackedSection(
          'Team performance roster',
          'Employee task volume and progress in one place.',
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
        )
      );

      content.append(overview, charts, sections);
    } catch (err) {
      showError(err);
      hideLoading(content);
      clearElement(content);
      content.appendChild(emptyState('Unable to load team dashboard', err.message || 'This dashboard could not be loaded right now.'));
    }
  }

  await loadManagerData(selectedTeamId);
}

function buildHero({ eyebrow, title, description, meta = [], className = 'page-hero' }) {
  return el('section', { className },
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

function summaryTableCard(title, rows) {
  return el('section', { className: 'card dashboard-summary-table-card' },
    el('div', { className: 'section-header section-header--stacked' },
      el('div', {},
        el('h3', { className: 'section-title' }, title),
        el('p', { className: 'section-subtitle' }, 'The most important metrics for this workspace in one compact view.')
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

function buildTaskAccordionList(tasks, { showAssignee = false, onComplete } = {}) {
  return el('div', { className: 'task-accordion-list' },
    ...tasks.map((task) => taskAccordionItem(task, { showAssignee, onComplete }))
  );
}

function taskAccordionItem(task, { showAssignee = false, onComplete } = {}) {
  const progressValue = Number(task.progressPercent ?? 0);

  return el('details', { className: 'task-accordion card' },
    el('summary', { className: 'task-accordion__summary' },
      el('div', { className: 'task-accordion__head' },
        el('strong', { className: 'task-accordion__title' }, task.title),
        el('div', { className: 'task-badges' },
          el('span', { className: `badge badge-${task.status === 'completed' ? 'success' : task.status === 'blocked' ? 'warning' : task.status === 'in_progress' ? 'primary' : 'default'}` }, statusLabel(task.status)),
          el('span', { className: `badge badge-priority-${task.priority || 'medium'}` }, capitalize(task.priority || 'medium'))
        )
      ),
      el('div', { className: 'task-accordion__summary-meta' },
        showAssignee ? el('span', {}, task.assignment?.assigneeFullName || 'Unassigned') : null,
        el('span', { className: 'task-accordion__icon', 'aria-hidden': 'true' })
      )
    ),
    el('div', { className: 'task-accordion__body' },
      task.description ? el('p', { className: 'task-note' }, task.description) : null,
      el('div', { className: 'task-inline-metrics', style: 'margin-top:12px' },
        infoChip('Due', task.dueAt ? formatShortDate(task.dueAt) : 'Not scheduled'),
        infoChip('Time left', task.timeRemainingSeconds != null ? formatTimeRemaining(task.timeRemainingSeconds) : 'No deadline'),
        infoChip('Progress', formatPercent(progressValue, 0))
      ),
      el('div', { className: 'task-progress-block' },
        el('div', { className: 'task-progress-row' },
          el('span', { className: 'task-progress-title' }, 'Progress'),
          el('span', { className: 'task-progress-value' }, formatPercent(progressValue, 0))
        ),
        el('div', { className: 'progress-bar-container progress-bar-container--lg' },
          el('div', { className: 'progress-bar', style: `width:${Math.max(0, Math.min(progressValue, 100))}%` })
        )
      ),
      task.status !== 'completed' && onComplete
        ? el('div', { className: 'task-actions' },
            el('button', {
              className: 'btn btn-sm btn-primary',
              type: 'button',
              onClick: () => onComplete(task)
            }, 'Mark Completed')
          )
        : null
    )
  );
}

function infoChip(label, value) {
  return el('div', { className: 'task-inline-chip' },
    el('span', { className: 'task-inline-chip__label' }, label),
    el('strong', { className: 'task-inline-chip__value' }, value)
  );
}

async function quickCompleteTask(task, reload) {
  try {
    await api.patch(`/tasks/${task.id}`, {
      status: 'completed',
      progressPercent: 100
    });
    showSuccess('Task marked completed.');
    await reload();
  } catch (err) {
    showError(err);
  }
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
        el('span', {}, task.dueAt ? formatShortDate(task.dueAt) : 'No due date'),
        el('span', {}, formatTimeRemaining(task.timeRemainingSeconds))
      )
    ))
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
        rosterStat('Open', formatNumber(member.openTaskCount || 0)),
        rosterStat('Blocked', formatNumber(member.blockedTaskCount || 0)),
        rosterStat('Avg progress', formatPercent(member.averageProgressPercent || 0, 1)),
        rosterStat('Completion rate', formatPercent(member.completionRate || 0, 1))
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
