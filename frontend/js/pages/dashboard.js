import { el, clearElement } from '../utils/dom.js';
import { isEmployee, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import {
  capitalize,
  formatNumber,
  formatPercent,
  formatShortDate,
  statusLabel,
  formatTimeRemaining
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam } from '../utils/teams.js';

export default async function dashboardPage(container) {
  if (isEmployee()) {
    window.location.hash = '#/tasks';
    return;
  }

  const user = getUser();
  renderHeader('Dashboard', `Welcome back, ${user.firstName}`);
  clearElement(container);
  showLoading(container);

  try {
    await renderManagerDashboard(container);
  } catch (err) {
    if (!isDashboardViewActive()) return;
    showError(err);
    hideLoading(container);
    clearElement(container);
    container.appendChild(emptyState('Unable to load dashboard', err.message || 'The dashboard could not be rendered right now.'));
  }
}

function isDashboardViewActive() {
  return (window.location.hash || '#/dashboard').startsWith('#/dashboard');
}

async function renderManagerDashboard(container) {
  const teamResponse = await api.get('/teams');
  if (!isDashboardViewActive()) return;
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
      const [dashboardRes, tasksRes, teamMembersRes] = await Promise.all([
        api.get(`/dashboards/manager?teamId=${teamId}`),
        api.get(`/tasks?teamId=${teamId}&sortBy=urgency&sortOrder=asc&includeCompleted=false&page=1&limit=8`),
        api.get(`/teams/${teamId}/members`)
      ]);

      if (!isDashboardViewActive()) return;
      clearElement(content);

      const dashboard = dashboardRes.data;
      const tasks = tasksRes.data.tasks || [];
      const teamInfo = teamMembersRes.data.team || teams.find((team) => team.id === teamId);
      const mergedMembers = mergeMemberMetrics(
        teamMembersRes.data.members || [],
        dashboard.charts?.workloadByEmployee || []
      );
      const employeeRows = mergedMembers.filter((member) => member.appRole === 'employee');
      const summary = dashboard.summary || {};
      const attentionTasks = buildManagerAttentionTasks(tasks, dashboard.tasks?.upcomingDeadlines || []);
      const blockedCount = tasks.filter((t) => t.status === 'blocked').length;

      const header = el('header', { className: 'mgr-header' },
        el('div', { className: 'mgr-header__text' },
          el('h2', { className: 'mgr-header__title' }, teamInfo?.name || 'Team dashboard'),
          el('p', { className: 'mgr-header__desc' }, teamInfo?.description || 'See who needs help, what is overdue, and where to act next.')
        ),
        el('div', { className: 'btn-group' },
          dashboardActionButton('Open Tasks', '#/tasks', 'btn btn-primary btn-sm'),
          dashboardActionButton('Open Team', `#/teams/${teamId}`, 'btn btn-outline btn-sm')
        )
      );

      const statStrip = el('div', { className: 'mgr-stat-strip' },
        mgrStatCell('Overdue', summary.overdueTaskCount || 0, (summary.overdueTaskCount || 0) > 0 ? 'danger' : null),
        mgrStatCell('Blocked', blockedCount, blockedCount > 0 ? 'warning' : null),
        mgrStatCell('Unassigned', summary.unassignedTaskCount || 0, (summary.unassignedTaskCount || 0) > 0 ? 'info' : null),
        mgrStatCell('Completion', formatPercent(summary.completionRate || 0, 0), null)
      );

      const watchMembers = [...employeeRows].sort(compareMemberAttention).slice(0, 4);

      const attentionSection = el('section', { className: 'dashboard-section card' },
        el('div', { className: 'section-header section-header--stacked' },
          el('div', {},
            el('h3', { className: 'section-title' }, 'Needs attention'),
            el('p', { className: 'section-subtitle' }, 'Overdue, blocked, due-soon, and unassigned work sorted by urgency.')
          )
        ),
        attentionTasks.length
          ? el('div', { className: 'mgr-attention-list' }, ...attentionTasks.slice(0, 5).map(mgrAttentionRow))
          : emptyState('Nothing urgent', 'No overdue or priority items need follow-up right now.'),
        el('div', { className: 'mgr-section-footer' },
          dashboardActionButton('Review all tasks', '#/tasks', 'btn btn-outline btn-sm')
        )
      );

      const peopleSection = el('section', { className: 'dashboard-section card' },
        el('div', { className: 'section-header section-header--stacked' },
          el('div', {},
            el('h3', { className: 'section-title' }, 'People check-in'),
            el('p', { className: 'section-subtitle' }, 'Who may need help, reassignment, or a quick follow-up.')
          )
        ),
        watchMembers.length
          ? el('div', { className: 'mgr-people-list' }, ...watchMembers.map(mgrPeopleRow))
          : emptyState('No team members', 'Add employees to this team to see workload guidance.'),
        el('div', { className: 'mgr-section-footer' },
          dashboardActionButton('Open team', `#/teams/${teamId}`, 'btn btn-outline btn-sm')
        )
      );

      const layout = el('div', { className: 'mgr-flow' },
        attentionSection,
        peopleSection
      );

      if (!isDashboardViewActive()) return;
      content.append(header, statStrip, layout);
    } catch (err) {
      if (!isDashboardViewActive()) return;
      showError(err);
      hideLoading(content);
      clearElement(content);
      content.appendChild(emptyState('Unable to load team dashboard', err.message || 'This dashboard could not be loaded right now.'));
    }
  }

  await loadManagerData(selectedTeamId);
}

function buildHero({ eyebrow, title, description, meta = [], actions = [], className = 'page-hero' }) {
  return el('section', { className },
    el('div', { className: 'page-hero__content' },
      el('p', { className: 'page-hero__eyebrow' }, eyebrow),
      el('h2', { className: 'page-hero__title' }, title),
      el('p', { className: 'page-hero__description' }, description)
    ),
    el('div', { className: 'page-hero__meta' },
      ...meta,
      actions.length
        ? el('div', { className: 'page-hero__actions' }, ...actions)
        : null
    )
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

function buildTaskAccordionList(tasks, { showAssignee = false, showDueHint = false, onComplete } = {}) {
  return el('div', { className: 'task-accordion-list' },
    ...tasks.map((task) => taskAccordionItem(task, { showAssignee, showDueHint, onComplete }))
  );
}

function taskAccordionItem(task, { showAssignee = false, showDueHint = false, onComplete } = {}) {
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
        showDueHint ? el('span', {
          className: `task-accordion__due${task.isOverdue ? ' task-accordion__due--danger' : task.isDueSoon ? ' task-accordion__due--warning' : ''}`
        }, task.dueAt ? `${formatShortDate(task.dueAt)} · ${formatTimeRemaining(task.timeRemainingSeconds)}` : 'No due date') : null,
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

function dashboardActionButton(label, hash, className = 'btn btn-outline btn-sm') {
  return el('button', {
    className,
    type: 'button',
    onClick: () => {
      window.location.hash = hash;
    }
  }, label);
}

function buildManagerAttentionTasks(priorityTasks = [], deadlineTasks = []) {
  const seen = new Set();

  return [...priorityTasks, ...deadlineTasks]
    .filter((task) => task && task.id && task.status !== 'completed' && task.status !== 'cancelled')
    .sort((left, right) => compareAttentionTasks(left, right))
    .filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    })
    .slice(0, 6);
}

function compareAttentionTasks(left, right) {
  const scoreDiff = attentionTaskScore(right) - attentionTaskScore(left);
  if (scoreDiff !== 0) return scoreDiff;

  const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;

  return leftDue - rightDue;
}

function attentionTaskScore(task) {
  const priorityWeight = {
    urgent: 40,
    high: 28,
    medium: 16,
    low: 8
  };

  let score = priorityWeight[task.priority] || 0;
  if (task.isOverdue) score += 120;
  else if (task.isDueSoon) score += 72;
  if (!task.assignment?.assigneeFullName) score += 40;
  if (task.status === 'blocked') score += 52;

  return score;
}

function compareMemberAttention(left, right) {
  const blockedDiff = Number(right.blockedTaskCount || 0) - Number(left.blockedTaskCount || 0);
  if (blockedDiff !== 0) return blockedDiff;

  const openDiff = Number(right.openTaskCount || 0) - Number(left.openTaskCount || 0);
  if (openDiff !== 0) return openDiff;

  return Number(left.completionRate || 0) - Number(right.completionRate || 0);
}

function workloadSignal(member) {
  const blocked = Number(member.blockedTaskCount || 0);
  const open = Number(member.openTaskCount || 0);
  const completion = Number(member.completionRate || 0);

  if (blocked > 0) {
    return {
      label: 'Blocked work',
      tone: 'warning',
      note: `${formatNumber(blocked)} blocked ${blocked === 1 ? 'task needs' : 'tasks need'} help right now.`
    };
  }

  if (open >= 5) {
    return {
      label: 'High load',
      tone: 'danger',
      note: `${formatNumber(open)} open tasks suggest this teammate may need reassignment support.`
    };
  }

  if (open >= 3) {
    return {
      label: 'Busy',
      tone: 'primary',
      note: `${formatNumber(open)} open tasks are in motion, so keep an eye on new assignments.`
    };
  }

  if ((member.taskCount || 0) > 0 && completion < 0.5) {
    return {
      label: 'Needs follow-up',
      tone: 'info',
      note: `Completion pace is ${formatPercent(completion, 1)}, which may need a quick manager check-in.`
    };
  }

  return {
    label: 'On track',
    tone: 'success',
    note: 'Current workload looks manageable at a glance.'
  };
}

function mgrStatCell(label, value, tone) {
  return el('div', { className: `mgr-stat-strip__cell${tone ? ` mgr-stat-strip__cell--${tone}` : ''}` },
    el('span', { className: 'mgr-stat-strip__label' }, label),
    el('strong', { className: 'mgr-stat-strip__value' }, String(value))
  );
}

function attentionSignal(task) {
  if (task.isOverdue) return { label: 'Overdue', tone: 'danger' };
  if (task.status === 'blocked') return { label: 'Blocked', tone: 'warning' };
  if (task.isDueSoon) return { label: 'Due soon', tone: 'warning' };
  if (!task.assignment?.assigneeFullName) return { label: 'Unassigned', tone: 'info' };
  return { label: capitalize(task.priority || 'medium'), tone: 'default' };
}

function mgrAttentionRow(task) {
  const signal = attentionSignal(task);
  return el('div', { className: 'mgr-attention-row' },
    el('div', { className: 'mgr-attention-row__main' },
      el('strong', { className: 'mgr-attention-row__title' }, task.title),
      el('span', { className: 'mgr-attention-row__assignee' }, task.assignment?.assigneeFullName || 'Unassigned')
    ),
    el('div', { className: 'mgr-attention-row__meta' },
      el('span', { className: `badge badge-${signal.tone}` }, signal.label),
      el('span', { className: 'mgr-attention-row__due' }, task.dueAt ? formatShortDate(task.dueAt) : 'No due date')
    )
  );
}

function mgrPeopleRow(member) {
  const signal = workloadSignal(member);
  return el('div', { className: 'mgr-people-row' },
    el('div', { className: 'mgr-people-row__main' },
      el('strong', {}, member.fullName),
      el('span', {}, member.jobTitle || 'Team member')
    ),
    el('div', { className: 'mgr-people-row__meta' },
      el('span', { className: `badge badge-${signal.tone}` }, signal.label),
      el('span', {}, `${formatNumber(member.openTaskCount || 0)} open`)
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
