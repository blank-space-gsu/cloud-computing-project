import { el, clearElement } from '../utils/dom.js';
import { isManager, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { taskCard } from '../components/taskCard.js';
import { statusLabel, priorityLabel, formatDate, formatShortDate, formatTimeRemaining, mondayDateString } from '../utils/format.js';
import { selectPreferredTeam } from '../utils/teams.js';

let currentPage = 1;
const PAGE_LIMIT = 12;
const WEEKDAY_OPTIONS = [
  ['Sun', 0],
  ['Mon', 1],
  ['Tue', 2],
  ['Wed', 3],
  ['Thu', 4],
  ['Fri', 5],
  ['Sat', 6]
];

const localDateInputValue = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const weekdayFromIsoDate = (value) => new Date(`${value}T12:00:00`).getDay();

export default async function tasksPage(container) {
  renderHeader('Tasks', isManager() ? 'Manage team tasks' : 'Your assigned tasks');
  clearElement(container);

  if (isManager()) {
    await renderManagerTasks(container);
  } else {
    await renderEmployeeTasks(container);
  }
}

/* ======================== EMPLOYEE VIEW ======================== */

const employeeState = {
  teamFilter: '',
  completedOpen: false
};

async function renderEmployeeTasks(container) {
  clearElement(container);
  showLoading(container);

  try {
    const { data } = await api.get('/tasks?sortBy=urgency&sortOrder=asc&limit=100&includeCompleted=true');
    clearElement(container);

    const allTasks = data.tasks || [];

    // Build team list from tasks for the inline filter.
    const teamMap = new Map();
    for (const t of allTasks) {
      const id = t.teamId || t.team?.id;
      const name = t.teamName || t.team?.name || 'Team';
      if (id && !teamMap.has(id)) teamMap.set(id, name);
    }
    const teams = [...teamMap.entries()].map(([id, name]) => ({ id, name }));

    const visibleTasks = employeeState.teamFilter
      ? allTasks.filter((t) => (t.teamId || t.team?.id) === employeeState.teamFilter)
      : allTasks;

    const shell = el('div', { className: 'etasks' });
    shell.appendChild(buildEmployeeTopBand(visibleTasks, teams, container));

    if (!visibleTasks.length) {
      shell.appendChild(el('div', { className: 'etasks-empty' },
        el('h3', {}, 'All clear'),
        el('p', {}, 'You have no tasks right now. Enjoy the breathing room.')
      ));
      container.appendChild(shell);
      return;
    }

    const groups = groupEmployeeTasks(visibleTasks);

    if (groups.attention.length) {
      shell.appendChild(buildEmployeeGroup({
        key: 'attention',
        title: 'Needs attention',
        subtitle: 'Overdue, blocked, or urgent',
        tone: 'danger',
        tasks: groups.attention,
        container
      }));
    }

    if (groups.inProgress.length) {
      shell.appendChild(buildEmployeeGroup({
        key: 'in_progress',
        title: 'In progress',
        subtitle: 'What you\u2019re working on',
        tone: 'info',
        tasks: groups.inProgress,
        container
      }));
    }

    if (groups.upNext.length) {
      shell.appendChild(buildEmployeeGroup({
        key: 'up_next',
        title: 'Up next',
        subtitle: 'Not started yet',
        tone: 'neutral',
        tasks: groups.upNext,
        container
      }));
    }

    if (groups.completed.length) {
      shell.appendChild(buildEmployeeCompletedGroup(groups.completed, container));
    }

    container.appendChild(shell);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

function buildEmployeeTopBand(visibleTasks, teams, container) {
  const summary = computeEmployeeSummary(visibleTasks);

  const summaryParts = [];
  summaryParts.push(`${summary.active} active`);
  if (summary.overdue > 0) summaryParts.push(`${summary.overdue} overdue`);
  if (summary.dueToday > 0) summaryParts.push(`${summary.dueToday} due today`);

  const heading = el('div', { className: 'etasks-top__heading' },
    el('h2', { className: 'etasks-top__title' }, 'My Tasks'),
    el('p', { className: 'etasks-top__summary' }, summaryParts.join(' \u00b7 '))
  );

  const controls = el('div', { className: 'etasks-top__controls' });

  if (teams.length > 1) {
    const select = el('select', { className: 'etasks-filter' },
      el('option', { value: '' }, 'All teams')
    );
    for (const team of teams) {
      select.appendChild(el('option', { value: team.id }, team.name));
    }
    select.value = employeeState.teamFilter;
    select.addEventListener('change', () => {
      employeeState.teamFilter = select.value;
      renderEmployeeTasks(container);
    });
    controls.appendChild(select);
  }

  return el('div', { className: 'etasks-top' }, heading, controls);
}

function computeEmployeeSummary(tasks) {
  const summary = { active: 0, overdue: 0, dueToday: 0 };
  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const t of tasks) {
    if (t.status !== 'completed' && t.status !== 'cancelled') {
      summary.active += 1;
    }
    if (t.isOverdue || (t.dueAt && new Date(t.dueAt) < now && t.status !== 'completed' && t.status !== 'cancelled')) {
      summary.overdue += 1;
    }
    if (t.dueAt && t.status !== 'completed' && t.status !== 'cancelled') {
      const due = new Date(t.dueAt);
      const dueYMD = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      if (dueYMD === todayYMD) summary.dueToday += 1;
    }
  }

  return summary;
}

function groupEmployeeTasks(tasks) {
  const groups = {
    attention: [],
    inProgress: [],
    upNext: [],
    completed: []
  };

  const now = Date.now();
  const SOON_MS = 48 * 60 * 60 * 1000;

  for (const t of tasks) {
    if (t.status === 'completed' || t.status === 'cancelled') {
      groups.completed.push(t);
      continue;
    }

    const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
    const overdue = t.isOverdue || (due !== null && due < now);
    const dueSoon = due !== null && due - now < SOON_MS;
    const blocked = t.status === 'blocked';
    const urgentSoon = t.priority === 'urgent' && dueSoon;

    if (overdue || blocked || urgentSoon) {
      groups.attention.push(t);
    } else if (t.status === 'in_progress') {
      groups.inProgress.push(t);
    } else {
      groups.upNext.push(t);
    }
  }

  return groups;
}

function buildEmployeeGroup({ title, subtitle, tone, tasks, container }) {
  const header = el('div', { className: 'etasks-group__header' },
    el('div', { className: 'etasks-group__title-wrap' },
      el('h3', { className: 'etasks-group__title' }, title),
      el('span', { className: 'etasks-group__count' }, String(tasks.length))
    ),
    el('span', { className: 'etasks-group__subtitle' }, subtitle)
  );

  const list = el('div', { className: 'etasks-group__list' });
  for (const t of tasks) {
    list.appendChild(buildEmployeeTaskRow(t, container));
  }

  return el('section', { className: `etasks-group etasks-group--${tone}` }, header, list);
}

function buildEmployeeCompletedGroup(tasks, container) {
  const expanded = employeeState.completedOpen;

  const toggle = el('button', {
    className: 'etasks-group__header etasks-group__header--toggle',
    type: 'button',
    'aria-expanded': String(expanded)
  },
    el('div', { className: 'etasks-group__title-wrap' },
      el('span', { className: 'etasks-group__chevron', 'aria-hidden': 'true' }, expanded ? '\u25be' : '\u25b8'),
      el('h3', { className: 'etasks-group__title' }, 'Completed'),
      el('span', { className: 'etasks-group__count' }, String(tasks.length))
    ),
    el('span', { className: 'etasks-group__subtitle' }, 'Recently finished')
  );
  toggle.addEventListener('click', () => {
    employeeState.completedOpen = !employeeState.completedOpen;
    renderEmployeeTasks(container);
  });

  const section = el('section', { className: 'etasks-group etasks-group--completed' }, toggle);

  if (expanded) {
    const list = el('div', { className: 'etasks-group__list' });
    for (const t of tasks) {
      list.appendChild(buildEmployeeTaskRow(t, container, { muted: true }));
    }
    section.appendChild(list);
  }

  return section;
}

function buildEmployeeTaskRow(task, container, opts = {}) {
  const { muted = false } = opts;

  const priority = task.priority || 'medium';
  const status = task.status || 'todo';

  const rail = el('span', { className: `etasks-row__rail etasks-row__rail--${priority}` });

  // Title line: title + optional team chip
  const titleLine = el('div', { className: 'etasks-row__title-line' },
    el('h4', { className: 'etasks-row__title' }, task.title || 'Untitled task')
  );
  const teamName = task.teamName || task.team?.name;
  if (teamName) {
    titleLine.appendChild(el('span', { className: 'etasks-row__team' }, teamName));
  }

  // Chip line: status + priority
  const chipLine = el('div', { className: 'etasks-row__chips' },
    el('span', { className: `etasks-chip etasks-chip--status-${status}` }, statusLabel(status)),
    el('span', { className: `etasks-chip etasks-chip--priority-${priority}` }, priorityLabel(priority))
  );

  // Meta line: due + time remaining
  const metaLine = el('div', { className: 'etasks-row__meta' });
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    const overdue = !muted && task.status !== 'completed' && due.getTime() < Date.now();
    metaLine.appendChild(el('span', { className: 'etasks-row__due' },
      el('span', { className: 'etasks-row__due-label' }, 'Due'),
      el('span', {}, formatShortDate(task.dueAt))
    ));
    if (typeof task.secondsUntilDue === 'number' && task.status !== 'completed') {
      metaLine.appendChild(el('span', {
        className: `etasks-row__time-left${overdue ? ' is-overdue' : ''}`
      }, formatTimeRemaining(task.secondsUntilDue)));
    } else if (overdue) {
      metaLine.appendChild(el('span', { className: 'etasks-row__time-left is-overdue' }, 'Overdue'));
    }
  } else {
    metaLine.appendChild(el('span', { className: 'etasks-row__due etasks-row__due--none' }, 'No due date'));
  }

  if (typeof task.estimatedHours === 'number' && task.estimatedHours > 0) {
    metaLine.appendChild(el('span', { className: 'etasks-row__est' }, `${task.estimatedHours}h est.`));
  }

  // Progress
  const progressPct = Math.max(0, Math.min(100, Number(task.progressPercent ?? 0)));
  const progressTone = progressPct >= 100 ? 'success' : progressPct >= 60 ? 'info' : progressPct > 0 ? 'warning' : 'neutral';
  const progress = el('div', { className: 'etasks-row__progress' },
    el('div', { className: 'etasks-row__progress-bar' },
      el('span', { className: `etasks-row__progress-fill etasks-row__progress-fill--${progressTone}`, style: `width: ${progressPct}%;` })
    ),
    el('span', { className: 'etasks-row__progress-pct' }, `${progressPct}%`)
  );

  // Note preview
  const main = el('div', { className: 'etasks-row__main' }, titleLine, chipLine, metaLine, progress);
  if (task.notes && task.notes.trim()) {
    const preview = task.notes.trim();
    const short = preview.length > 140 ? `${preview.slice(0, 137)}\u2026` : preview;
    main.appendChild(el('p', { className: 'etasks-row__note' }, short));
  }

  // Actions
  const actions = el('div', { className: 'etasks-row__actions' });

  if (task.status !== 'completed' && task.status !== 'cancelled') {
    const primaryLabel = task.status === 'todo' ? 'Start' : 'Update';
    const updateBtn = el('button', {
      className: 'etasks-btn etasks-btn--primary',
      type: 'button',
      onClick: () => openEmployeeEditModal(task, container)
    }, primaryLabel);

    const completeBtn = el('button', {
      className: 'etasks-btn etasks-btn--ghost etasks-btn--icon',
      type: 'button',
      title: 'Mark complete',
      'aria-label': 'Mark complete',
      onClick: () => quickCompleteTask(task, () => renderEmployeeTasks(container))
    }, '\u2713');

    actions.append(updateBtn, completeBtn);
  } else {
    actions.appendChild(el('button', {
      className: 'etasks-btn etasks-btn--ghost',
      type: 'button',
      onClick: () => openEmployeeEditModal(task, container)
    }, 'Open'));
  }

  return el('article', {
    className: `etasks-row etasks-row--priority-${priority}${muted ? ' is-muted' : ''}`,
    'data-task-id': task.id
  }, rail, main, actions);
}

function openEmployeeEditModal(task, container) {
  const statusSelect = el('select', { className: 'form-select', name: 'status' },
    ...['todo', 'in_progress', 'blocked', 'completed'].map(s =>
      el('option', { value: s, selected: task.status === s }, statusLabel(s))
    )
  );

  const progressInput = el('input', {
    className: 'form-input', type: 'number', name: 'progressPercent',
    value: String(task.progressPercent ?? 0), min: '0', max: '100'
  });

  const notesInput = el('textarea', { className: 'form-textarea', name: 'notes' }, task.notes || '');

  const form = el('form', { id: 'emp-edit-form' },
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Status'), statusSelect),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Progress (%)'), progressInput),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Notes'), notesInput)
  );

  const clampProgress = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(0, Math.min(parsed, 100));
  };

  const syncEmployeeTaskState = (source) => {
    const progressValue = clampProgress(progressInput.value);
    progressInput.value = String(progressValue);

    if (statusSelect.value === 'completed') {
      progressInput.value = '100';
      return;
    }

    if (source === 'progress' && progressValue === 100) {
      statusSelect.value = 'completed';
      return;
    }

    if (source === 'progress' && progressValue > 0 && statusSelect.value === 'todo') {
      statusSelect.value = 'in_progress';
      return;
    }

    if (source === 'progress' && progressValue === 0 && statusSelect.value === 'completed') {
      statusSelect.value = 'todo';
    }
  };

  statusSelect.addEventListener('change', () => syncEmployeeTaskState('status'));
  progressInput.addEventListener('input', () => syncEmployeeTaskState('progress'));
  syncEmployeeTaskState('status');

  const saveBtn = el('button', { className: 'btn btn-primary', type: 'button' }, 'Save Progress');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      const progressValue = clampProgress(progressInput.value);
      await api.patch(`/tasks/${task.id}`, {
        status: statusSelect.value,
        progressPercent: progressValue,
        notes: notesInput.value || null
      });
      showSuccess('Task updated!');
      closeModal();
      await renderEmployeeTasks(container);
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal(`Update: ${task.title}`, form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'),
    saveBtn
  ));
}

/* ======================== MANAGER VIEW ======================== */

async function renderManagerTasks(container) {
  let teams = [];
  try {
    const res = await api.get('/teams');
    teams = (res.data.teams || []).filter((team) => team.canManageTeam);
  } catch { /* ignore */ }

  clearElement(container);

  const preferredTeam = selectPreferredTeam(teams);
  const state = { teamId: preferredTeam?.id || teams[0]?.id || '', status: '', priority: '', assigneeUserId: '', page: 1 };
  let members = [];

  const shell = el('div', { className: 'mtasks' });

  // --- Top band (title + soft summary) ---------------------------------
  const selectedTeamName = teams.find((t) => t.id === state.teamId)?.name || '';
  const summary = el('p', { className: 'mtasks-top__sub' }, selectedTeamName ? `Scope · ${selectedTeamName}` : 'No team selected');
  shell.appendChild(el('section', { className: 'mtasks-top' },
    el('div', { className: 'mtasks-top__heading' },
      el('h2', { className: 'mtasks-top__title' }, 'Team tasks'),
      summary
    )
  ));

  // --- Toolbar (filters + actions) -------------------------------------
  const toolbar = el('section', { className: 'mtasks-toolbar' });
  const filterCluster = el('div', { className: 'mtasks-toolbar__filters' });
  const actionCluster = el('div', { className: 'mtasks-toolbar__actions' });

  let teamSel = null;
  if (teams.length > 1) {
    teamSel = el('select', { className: 'mtasks-select' });
    for (const t of teams) teamSel.appendChild(el('option', { value: t.id }, t.name));
    teamSel.value = state.teamId;
    teamSel.addEventListener('change', async () => {
      state.teamId = teamSel.value;
      state.page = 1;
      members = await loadMembers(state.teamId);
      updateAssigneeSel(assigneeSel, members);
      createBtn.disabled = !state.teamId;
      recurringBtn.disabled = !state.teamId;
      updateSummary();
      await loadTasks();
    });
    filterCluster.appendChild(mtasksFilter('Team', teamSel));
  }

  const statusSel = mtasksSelect([
    ['', 'All statuses'], ['todo', 'To Do'], ['in_progress', 'In Progress'], ['blocked', 'Blocked'], ['completed', 'Completed']
  ], (v) => { state.status = v; state.page = 1; loadTasks(); });
  const prioritySel = mtasksSelect([
    ['', 'All priorities'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']
  ], (v) => { state.priority = v; state.page = 1; loadTasks(); });
  const assigneeSel = el('select', { className: 'mtasks-select' }, el('option', { value: '' }, 'All assignees'));
  assigneeSel.addEventListener('change', () => { state.assigneeUserId = assigneeSel.value; state.page = 1; loadTasks(); });

  filterCluster.append(
    mtasksFilter('Status', statusSel),
    mtasksFilter('Priority', prioritySel),
    mtasksFilter('Assignee', assigneeSel)
  );

  const createBtn = el('button', {
    className: 'mtasks-btn mtasks-btn--primary',
    type: 'button',
    onClick: () => openCreateTaskModal(state.teamId, members, container, loadTasks)
  }, '+ New Task');

  const recurringBtn = el('button', {
    className: 'mtasks-btn mtasks-btn--ghost',
    type: 'button',
    onClick: () => openRecurringTaskModal(state.teamId, members, loadTasks)
  }, 'Recurring');

  createBtn.disabled = !state.teamId;
  recurringBtn.disabled = !state.teamId;
  actionCluster.append(recurringBtn, createBtn);

  toolbar.append(filterCluster, actionCluster);
  shell.appendChild(toolbar);

  // --- Task area -------------------------------------------------------
  const taskArea = el('div', { className: 'mtasks-area' });
  shell.appendChild(taskArea);

  container.appendChild(shell);

  if (state.teamId) {
    members = await loadMembers(state.teamId);
    updateAssigneeSel(assigneeSel, members);
  }

  function updateSummary() {
    const name = teams.find((t) => t.id === state.teamId)?.name || '';
    summary.textContent = name ? `Scope \u00b7 ${name}` : 'No team selected';
  }

  async function loadTasks() {
    clearElement(taskArea);
    showLoading(taskArea);
    try {
      let url = `/tasks?sortBy=urgency&sortOrder=asc&page=${state.page}&limit=${PAGE_LIMIT}&includeCompleted=true`;
      if (state.teamId) url += `&teamId=${state.teamId}`;
      if (state.status) url += `&status=${state.status}`;
      if (state.priority) url += `&priority=${state.priority}`;
      if (state.assigneeUserId) url += `&assigneeUserId=${state.assigneeUserId}`;

      const { data, meta } = await api.get(url);
      clearElement(taskArea);

      const tasks = data.tasks || [];
      if (!tasks.length) {
        taskArea.appendChild(el('div', { className: 'mtasks-empty' },
          el('h3', {}, 'No tasks here'),
          el('p', {}, 'Try adjusting the filters or create a new task.')
        ));
        return;
      }

      const list = el('div', { className: 'mtasks-list' });
      for (const t of tasks) {
        list.appendChild(buildManagerTaskRow(t, state, members, loadTasks));
      }
      taskArea.appendChild(list);

      if (meta && meta.total > PAGE_LIMIT) {
        taskArea.appendChild(buildManagerPagination(meta, (page) => { state.page = page; loadTasks(); }));
      }
    } catch (err) {
      showError(err);
      hideLoading(taskArea);
    }
  }

  await loadTasks();
}

function mtasksFilter(label, selectEl) {
  return el('label', { className: 'mtasks-filter' },
    el('span', { className: 'mtasks-filter__label' }, label),
    selectEl
  );
}

function mtasksSelect(options, onChange) {
  const sel = el('select', { className: 'mtasks-select' });
  for (const [val, text] of options) sel.appendChild(el('option', { value: val }, text));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function buildManagerTaskRow(task, state, members, reload) {
  const priority = task.priority || 'medium';
  const status = task.status || 'todo';

  const rail = el('span', { className: `mtasks-row__rail mtasks-row__rail--${priority}` });

  // Title + team chip
  const titleLine = el('div', { className: 'mtasks-row__title-line' },
    el('h4', { className: 'mtasks-row__title' }, task.title || 'Untitled task')
  );
  const teamName = task.teamName || task.team?.name;
  if (teamName) {
    titleLine.appendChild(el('span', { className: 'mtasks-row__team' }, teamName));
  }

  // Chip line
  const assignee = task.assignment?.assigneeFullName;
  const chipLine = el('div', { className: 'mtasks-row__chips' },
    el('span', { className: `mtasks-chip mtasks-chip--status-${status}` }, statusLabel(status)),
    el('span', { className: `mtasks-chip mtasks-chip--priority-${priority}` }, priorityLabel(priority))
  );
  chipLine.appendChild(el('span', {
    className: `mtasks-chip mtasks-chip--assignee${assignee ? '' : ' is-unassigned'}`
  }, assignee || 'Unassigned'));

  // Meta line
  const metaLine = el('div', { className: 'mtasks-row__meta' });
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    const overdue = task.status !== 'completed' && due.getTime() < Date.now();
    metaLine.appendChild(el('span', { className: 'mtasks-row__due' },
      el('span', { className: 'mtasks-row__due-label' }, 'Due'),
      el('span', {}, formatShortDate(task.dueAt))
    ));
    if (typeof task.secondsUntilDue === 'number' && task.status !== 'completed') {
      metaLine.appendChild(el('span', {
        className: `mtasks-row__time-left${overdue ? ' is-overdue' : ''}`
      }, formatTimeRemaining(task.secondsUntilDue)));
    } else if (overdue) {
      metaLine.appendChild(el('span', { className: 'mtasks-row__time-left is-overdue' }, 'Overdue'));
    }
  } else {
    metaLine.appendChild(el('span', { className: 'mtasks-row__due mtasks-row__due--none' }, 'No due date'));
  }
  if (typeof task.estimatedHours === 'number' && task.estimatedHours > 0) {
    metaLine.appendChild(el('span', { className: 'mtasks-row__est' }, `${task.estimatedHours}h est.`));
  }

  // Progress
  const progressPct = Math.max(0, Math.min(100, Number(task.progressPercent ?? 0)));
  const progressTone = progressPct >= 100 ? 'success' : progressPct >= 60 ? 'info' : progressPct > 0 ? 'warning' : 'neutral';
  const progress = el('div', { className: 'mtasks-row__progress' },
    el('div', { className: 'mtasks-row__progress-bar' },
      el('span', {
        className: `mtasks-row__progress-fill mtasks-row__progress-fill--${progressTone}`,
        style: `width: ${progressPct}%;`
      })
    ),
    el('span', { className: 'mtasks-row__progress-pct' }, `${progressPct}%`)
  );

  const main = el('div', { className: 'mtasks-row__main' }, titleLine, chipLine, metaLine, progress);

  // Actions
  const actions = el('div', { className: 'mtasks-row__actions' });
  const editBtn = el('button', {
    className: 'mtasks-btn mtasks-btn--ghost',
    type: 'button',
    onClick: () => openManagerEditModal(task, reload)
  }, 'Edit');
  const assignBtn = el('button', {
    className: 'mtasks-btn mtasks-btn--ghost',
    type: 'button',
    onClick: () => openAssignModal(task, state.teamId, members, reload)
  }, task.assignment ? 'Reassign' : 'Assign');
  const completeBtn = el('button', {
    className: 'mtasks-btn mtasks-btn--icon',
    type: 'button',
    title: 'Mark complete',
    'aria-label': 'Mark complete',
    onClick: () => quickCompleteTask(task, reload)
  }, '\u2713');
  const deleteBtn = el('button', {
    className: 'mtasks-btn mtasks-btn--icon mtasks-btn--danger',
    type: 'button',
    title: 'Delete task',
    'aria-label': 'Delete task',
    onClick: () => confirmDelete(task, reload)
  }, '\u00d7');

  if (task.status !== 'completed' && task.status !== 'cancelled') {
    actions.append(editBtn, assignBtn, completeBtn, deleteBtn);
  } else {
    actions.append(editBtn, deleteBtn);
  }

  return el('article', {
    className: `mtasks-row mtasks-row--priority-${priority}`,
    'data-task-id': task.id
  }, rail, main, actions);
}

function buildManagerPagination(meta, onPage) {
  const total = meta.total || 0;
  const page = meta.page || 1;
  const limit = meta.limit || PAGE_LIMIT;
  const totalPages = Math.ceil(total / limit);

  const nav = el('div', { className: 'mtasks-pagination' });
  nav.appendChild(el('button', {
    className: 'mtasks-btn mtasks-btn--ghost',
    type: 'button',
    disabled: page <= 1,
    onClick: () => onPage(page - 1)
  }, '\u2039 Prev'));

  nav.appendChild(el('span', { className: 'mtasks-pagination__info' },
    `Page ${page} of ${Math.max(totalPages, 1)} \u00b7 ${total} task${total !== 1 ? 's' : ''}`
  ));

  nav.appendChild(el('button', {
    className: 'mtasks-btn mtasks-btn--ghost',
    type: 'button',
    disabled: page >= totalPages,
    onClick: () => onPage(page + 1)
  }, 'Next \u203a'));

  return nav;
}

async function loadMembers(teamId) {
  if (!teamId) return [];
  try {
    const { data } = await api.get(`/teams/${teamId}/members`);
    return (data.members || []).filter(m => m.appRole === 'employee');
  } catch { return []; }
}

function updateAssigneeSel(sel, members) {
  clearElement(sel);
  sel.appendChild(el('option', { value: '' }, 'All assignees'));
  for (const m of members) {
    sel.appendChild(el('option', { value: m.id }, m.fullName || `${m.firstName} ${m.lastName}`));
  }
}

function openRecurringTaskModal(teamId, members, reload) {
  if (!teamId) {
    showError('Select a team first.');
    return;
  }

  const startDate = localDateInputValue();
  const titleInput = el('input', { className: 'form-input', name: 'title', required: true, placeholder: 'Recurring task title' });
  const descInput = el('textarea', { className: 'form-textarea', name: 'description', placeholder: 'Optional description' });
  const prioritySel = el('select', { className: 'form-select', name: 'priority' },
    ...['medium', 'low', 'high', 'urgent'].map(p => el('option', { value: p }, priorityLabel(p)))
  );
  const assigneeSel = el('select', { className: 'form-select', name: 'defaultAssignee' }, el('option', { value: '' }, 'Unassigned by default'));
  for (const m of members) {
    assigneeSel.appendChild(el('option', { value: m.id }, m.fullName || `${m.firstName} ${m.lastName}`));
  }
  const frequencySel = el('select', { className: 'form-select', name: 'frequency' },
    el('option', { value: 'daily' }, 'Daily'),
    el('option', { value: 'weekly' }, 'Weekly'),
    el('option', { value: 'monthly' }, 'Monthly')
  );
  const dueTimeInput = el('input', { className: 'form-input', name: 'dueTime', type: 'time', value: '09:00', required: true });
  const startsOnInput = el('input', { className: 'form-input', name: 'startsOn', type: 'date', value: startDate, required: true });
  const endsOnInput = el('input', { className: 'form-input', name: 'endsOn', type: 'date' });
  const dayOfMonthInput = el('input', {
    className: 'form-input',
    name: 'dayOfMonth',
    type: 'number',
    min: '1',
    max: '31',
    value: String(new Date(`${startDate}T12:00:00`).getDate())
  });

  const weekdayInputs = WEEKDAY_OPTIONS.map(([label, value]) => {
    const input = el('input', {
      type: 'checkbox',
      value: String(value),
      checked: value === weekdayFromIsoDate(startDate)
    });

    return {
      value,
      input,
      wrapper: el(
        'label',
        { className: 'weekday-option' },
        input,
        el('span', {}, label)
      )
    };
  });

  const weeklyGroup = el(
    'div',
    { className: 'form-group' },
    el('label', { className: 'form-label' }, 'Weekdays'),
    el('div', { className: 'weekday-picker' }, ...weekdayInputs.map((option) => option.wrapper))
  );

  const monthlyGroup = el(
    'div',
    { className: 'form-group' },
    el('label', { className: 'form-label' }, 'Day of Month'),
    dayOfMonthInput
  );

  const form = el('form', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Title'),
      titleInput
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Description'),
      descInput
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Priority'),
        prioritySel
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Default Assignee'),
        assigneeSel
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Frequency'),
        frequencySel
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Due Time'),
        dueTimeInput
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Starts On'),
        startsOnInput
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Ends On'),
        endsOnInput
      )
    ),
    weeklyGroup,
    monthlyGroup
  );

  const syncRecurringFields = () => {
    const frequency = frequencySel.value;
    weeklyGroup.style.display = frequency === 'weekly' ? '' : 'none';
    monthlyGroup.style.display = frequency === 'monthly' ? '' : 'none';

    if (frequency === 'weekly' && !weekdayInputs.some(({ input }) => input.checked)) {
      const defaultWeekday = weekdayFromIsoDate(startsOnInput.value || localDateInputValue());
      const matching = weekdayInputs.find((option) => option.value === defaultWeekday);
      if (matching) matching.input.checked = true;
    }

    if (frequency === 'monthly' && !dayOfMonthInput.value) {
      dayOfMonthInput.value = String(new Date(`${startsOnInput.value || localDateInputValue()}T12:00:00`).getDate());
    }
  };

  frequencySel.addEventListener('change', syncRecurringFields);
  startsOnInput.addEventListener('change', syncRecurringFields);
  syncRecurringFields();

  const saveBtn = el('button', { className: 'btn btn-primary' }, 'Create Rule');
  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      showError('Title is required.');
      return;
    }

    const weekdays = weekdayInputs
      .filter(({ input }) => input.checked)
      .map(({ input }) => Number(input.value));

    if (frequencySel.value === 'weekly' && weekdays.length === 0) {
      showError('Select at least one weekday for a weekly recurring task.');
      return;
    }

    if (frequencySel.value === 'monthly' && !dayOfMonthInput.value) {
      showError('Choose a day of month for a monthly recurring task.');
      return;
    }

    saveBtn.disabled = true;

    const body = {
      teamId,
      title,
      description: descInput.value || undefined,
      priority: prioritySel.value,
      defaultAssigneeUserId: assigneeSel.value || undefined,
      frequency: frequencySel.value,
      dueTime: dueTimeInput.value,
      startsOn: startsOnInput.value
    };

    if (endsOnInput.value) {
      body.endsOn = endsOnInput.value;
    }

    if (frequencySel.value === 'weekly') {
      body.weekdays = weekdays;
    }

    if (frequencySel.value === 'monthly') {
      body.dayOfMonth = Number(dayOfMonthInput.value);
    }

    try {
      await api.post('/recurring-task-rules', body);
      showSuccess('Recurring task rule created.');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal('Create Recurring Task', form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'),
    saveBtn
  ));
}

function openCreateTaskModal(teamId, members, container, reload) {
  const form = el('form', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', name: 'title', required: true, placeholder: 'Task title' })
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Description'),
      el('textarea', { className: 'form-textarea', name: 'description', placeholder: 'Optional description' })
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Priority'),
        el('select', { className: 'form-select', name: 'priority' },
          ...['medium', 'low', 'high', 'urgent'].map(p => el('option', { value: p }, priorityLabel(p)))
        )
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Due Date'),
        el('input', { className: 'form-input', name: 'dueAt', type: 'datetime-local' })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Effort Estimate'),
        el('input', { className: 'form-input', name: 'estimatedHours', type: 'number', min: '0', step: '0.5', placeholder: '0' })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Assign To'),
        (() => {
          const s = el('select', { className: 'form-select', name: 'assignee' }, el('option', { value: '' }, 'Unassigned'));
          for (const m of members) s.appendChild(el('option', { value: m.id }, m.fullName || `${m.firstName} ${m.lastName}`));
          return s;
        })()
      )
    )
  );

  const saveBtn = el('button', { className: 'btn btn-primary' }, 'Create Task');
  saveBtn.addEventListener('click', async () => {
    const title = form.querySelector('[name="title"]').value.trim();
    if (!title) { showError('Title is required.'); return; }
    saveBtn.disabled = true;

    const body = {
      teamId,
      title,
      description: form.querySelector('[name="description"]').value || undefined,
      priority: form.querySelector('[name="priority"]').value,
      weekStartDate: mondayDateString()
    };

    const dueVal = form.querySelector('[name="dueAt"]').value;
    if (dueVal) body.dueAt = new Date(dueVal).toISOString();

    const estH = form.querySelector('[name="estimatedHours"]').value;
    if (estH) body.estimatedHours = parseFloat(estH);

    try {
      const { data } = await api.post('/tasks', body);
      const assigneeId = form.querySelector('[name="assignee"]').value;
      if (assigneeId && data.task?.id) {
        await api.post('/task-assignments', { taskId: data.task.id, assigneeUserId: assigneeId });
      }
      showSuccess('Task created!');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal('Create Task', form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'), saveBtn));
}

function openManagerEditModal(task, reload) {
  const form = el('form', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', name: 'title', value: task.title })
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Description'),
      el('textarea', { className: 'form-textarea', name: 'description' }, task.description || '')
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Status'),
        el('select', { className: 'form-select', name: 'status' },
          ...['todo', 'in_progress', 'blocked', 'completed', 'cancelled'].map(s =>
            el('option', { value: s, selected: task.status === s }, statusLabel(s))
          )
        )
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Priority'),
        el('select', { className: 'form-select', name: 'priority' },
          ...['low', 'medium', 'high', 'urgent'].map(p =>
            el('option', { value: p, selected: task.priority === p }, priorityLabel(p))
          )
        )
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Due Date'),
        el('input', { className: 'form-input', name: 'dueAt', type: 'datetime-local', value: task.dueAt ? task.dueAt.slice(0, 16) : '' })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Progress (%)'),
        el('input', { className: 'form-input', name: 'progressPercent', type: 'number', min: '0', max: '100', value: String(task.progressPercent ?? 0) })
      )
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Notes'),
      el('textarea', { className: 'form-textarea', name: 'notes' }, task.notes || '')
    )
  );

  const saveBtn = el('button', { className: 'btn btn-primary' }, 'Save Changes');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const body = {
      title: form.querySelector('[name="title"]').value.trim(),
      description: form.querySelector('[name="description"]').value || null,
      status: form.querySelector('[name="status"]').value,
      priority: form.querySelector('[name="priority"]').value,
      progressPercent: parseInt(form.querySelector('[name="progressPercent"]').value, 10),
      notes: form.querySelector('[name="notes"]').value || null
    };
    const dueVal = form.querySelector('[name="dueAt"]').value;
    if (dueVal) body.dueAt = new Date(dueVal).toISOString();

    try {
      await api.patch(`/tasks/${task.id}`, body);
      showSuccess('Task updated!');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal(`Edit: ${task.title}`, form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'), saveBtn));
}

function openAssignModal(task, teamId, members, reload) {
  const sel = el('select', { className: 'form-select', name: 'assignee' });
  for (const m of members) {
    sel.appendChild(el('option', { value: m.id }, m.fullName || `${m.firstName} ${m.lastName}`));
  }
  if (task.assignment?.assigneeUserId) {
    sel.value = task.assignment.assigneeUserId;
  }
  const noteInput = el('textarea', { className: 'form-textarea', name: 'note', placeholder: 'Optional assignment note' });

  const form = el('div', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Assign to Employee'), sel),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Note'), noteInput)
  );

  const isReassignment = Boolean(task.assignment);
  const saveBtn = el('button', { className: 'btn btn-primary' }, isReassignment ? 'Reassign' : 'Assign');
  saveBtn.addEventListener('click', async () => {
    if (!sel.value) { showError('Select an employee'); return; }
    saveBtn.disabled = true;
    try {
      await api.post('/task-assignments', {
        taskId: task.id,
        assigneeUserId: sel.value,
        assignmentNote: noteInput.value || undefined
      });
      showSuccess('Task assigned!');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal(`${isReassignment ? 'Reassign' : 'Assign'}: ${task.title}`, form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'), saveBtn));
}

function confirmDelete(task, reload) {
  const msg = el('p', {}, `Are you sure you want to delete "${task.title}"? This cannot be undone.`);
  const delBtn = el('button', { className: 'btn btn-danger' }, 'Delete');
  delBtn.addEventListener('click', async () => {
    delBtn.disabled = true;
    try {
      await api.del(`/tasks/${task.id}`);
      showSuccess('Task deleted.');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      delBtn.disabled = false;
    }
  });

  openModal('Confirm Delete', msg, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'), delBtn));
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

/* ======================== PAGINATION ======================== */

function buildPagination(meta, onPage) {
  const total = meta.total || 0;
  const page = meta.page || 1;
  const limit = meta.limit || PAGE_LIMIT;
  const totalPages = Math.ceil(total / limit);

  const nav = el('div', { className: 'pagination' });
  nav.appendChild(el('button', { disabled: page <= 1, onClick: () => onPage(page - 1) }, '← Prev'));

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) {
    nav.appendChild(el('button', {
      className: i === page ? 'active' : '',
      onClick: () => onPage(i)
    }, String(i)));
  }

  nav.appendChild(el('button', { disabled: page >= totalPages, onClick: () => onPage(page + 1) }, 'Next →'));
  nav.appendChild(el('span', { className: 'pagination-info' }, `${total} task${total !== 1 ? 's' : ''}`));
  return nav;
}
