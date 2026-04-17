import { el, clearElement } from '../utils/dom.js';
import { isManager, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { taskCard } from '../components/taskCard.js';
import { statusLabel, priorityLabel, formatDate, mondayDateString } from '../utils/format.js';

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

async function renderEmployeeTasks(container) {
  clearElement(container);
  showLoading(container);

  try {
    const { data, meta } = await api.get(`/tasks?sortBy=urgency&sortOrder=asc&page=${currentPage}&limit=${PAGE_LIMIT}`);
    clearElement(container);

    const tasks = data.tasks || [];
    if (!tasks.length) {
      container.appendChild(emptyState('No tasks assigned', 'You have no tasks right now. Check back later!'));
      return;
    }

    const list = el('div', { className: 'task-list' });
    for (const t of tasks) {
      list.appendChild(taskCard(t, {
        onEdit: (task) => openEmployeeEditModal(task, container),
        onComplete: (task) => quickCompleteTask(task, () => renderEmployeeTasks(container))
      }));
    }
    container.appendChild(list);

    if (meta && meta.total > PAGE_LIMIT) {
      container.appendChild(buildPagination(meta, (page) => {
        currentPage = page;
        renderEmployeeTasks(container);
      }));
    }
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
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

  const state = { teamId: teams[0]?.id || '', status: '', priority: '', assigneeUserId: '', page: 1 };
  let members = [];

  const filtersBar = el('div', { className: 'filters-bar' });

  if (teams.length > 1) {
    const teamSel = el('select', { className: 'form-select' });
    for (const t of teams) teamSel.appendChild(el('option', { value: t.id }, t.name));
    teamSel.value = state.teamId;
    teamSel.addEventListener('change', async () => {
      state.teamId = teamSel.value;
      state.page = 1;
      members = await loadMembers(state.teamId);
      updateAssigneeSel(assigneeSel, members);
      createBtn.disabled = !state.teamId;
      recurringBtn.disabled = !state.teamId;
      await loadTasks();
    });
    filtersBar.appendChild(el('div', { className: 'filter-group' }, el('label', {}, 'Team'), teamSel));
  }

  const statusSel = filterSelect('Status', [['', 'All'], ['todo', 'To Do'], ['in_progress', 'In Progress'], ['blocked', 'Blocked'], ['completed', 'Completed']], (v) => { state.status = v; state.page = 1; loadTasks(); });
  const prioritySel = filterSelect('Priority', [['', 'All'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']], (v) => { state.priority = v; state.page = 1; loadTasks(); });
  const assigneeSel = el('select', { className: 'form-select' }, el('option', { value: '' }, 'All'));
  assigneeSel.addEventListener('change', () => { state.assigneeUserId = assigneeSel.value; state.page = 1; loadTasks(); });

  filtersBar.append(statusSel, prioritySel,
    el('div', { className: 'filter-group' }, el('label', {}, 'Assignee'), assigneeSel)
  );

  const createBtn = el('button', { className: 'btn btn-primary', onClick: () => openCreateTaskModal(state.teamId, members, container, loadTasks) }, '+ New Task');
  const recurringBtn = el(
    'button',
    { className: 'btn btn-outline', onClick: () => openRecurringTaskModal(state.teamId, members, loadTasks) },
    '+ Recurring Task'
  );
  createBtn.disabled = !state.teamId;
  recurringBtn.disabled = !state.teamId;
  filtersBar.appendChild(el('div', { className: 'filters-bar__actions btn-group' }, createBtn, recurringBtn));

  const taskArea = el('div');
  container.append(filtersBar, taskArea);

  if (state.teamId) {
    members = await loadMembers(state.teamId);
    updateAssigneeSel(assigneeSel, members);
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
        taskArea.appendChild(emptyState('No tasks found', 'Try adjusting the filters or create a new task.'));
        return;
      }

      const list = el('div', { className: 'task-list' });
      for (const t of tasks) {
        list.appendChild(taskCard(t, {
          variant: 'manager',
          showAssignee: true,
          onComplete: (task) => quickCompleteTask(task, loadTasks),
          onEdit: (task) => openManagerEditModal(task, loadTasks),
          onAssign: (task) => openAssignModal(task, state.teamId, members, loadTasks),
          onDelete: (task) => confirmDelete(task, loadTasks)
        }));
      }
      taskArea.appendChild(list);

      if (meta && meta.total > PAGE_LIMIT) {
        taskArea.appendChild(buildPagination(meta, (page) => { state.page = page; loadTasks(); }));
      }
    } catch (err) {
      showError(err);
      hideLoading(taskArea);
    }
  }

  await loadTasks();
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
  sel.appendChild(el('option', { value: '' }, 'All'));
  for (const m of members) {
    sel.appendChild(el('option', { value: m.id }, m.fullName || `${m.firstName} ${m.lastName}`));
  }
}

function filterSelect(label, options, onChange) {
  const sel = el('select', { className: 'form-select' });
  for (const [val, text] of options) sel.appendChild(el('option', { value: val }, text));
  sel.addEventListener('change', () => onChange(sel.value));
  return el('div', { className: 'filter-group' }, el('label', {}, label), sel);
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
