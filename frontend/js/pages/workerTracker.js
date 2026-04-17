import * as api from '../api.js';
import { isManager } from '../auth.js';
import { el, clearElement } from '../utils/dom.js';
import { renderHeader } from '../components/header.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import {
  formatDate,
  formatPercent,
  formatTimeRemaining,
  priorityLabel,
  statusLabel
} from '../utils/format.js';

const buildTrackerHash = ({ teamId = '', memberUserId = '' } = {}) => {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (memberUserId) params.set('memberUserId', memberUserId);
  const query = params.toString();
  return `#/worker-tracker${query ? `?${query}` : ''}`;
};

export default async function workerTrackerPage(container, params = {}) {
  renderHeader('Worker Tracker', 'Track team completion and drill into employee work.');
  clearElement(container);

  if (!isManager()) {
    container.appendChild(
      emptyState(
        'Worker Tracker is manager-only',
        'This page is available to managers and admins.'
      )
    );
    return;
  }

  showLoading(container);

  try {
    const query = new URLSearchParams();
    if (params.teamId) query.set('teamId', params.teamId);
    if (params.memberUserId) query.set('memberUserId', params.memberUserId);

    const { data } = await api.get(
      `/worker-tracker${query.toString() ? `?${query.toString()}` : ''}`
    );

    clearElement(container);
    container.appendChild(renderWorkerTracker(data));
  } catch (err) {
    clearElement(container);
    hideLoading(container);
    showError(err);
    container.appendChild(
      emptyState(
        'Worker Tracker unavailable',
        'We could not load the team tracker right now.'
      )
    );
  }
}

function renderWorkerTracker(data) {
  const shell = el('div', { className: 'worker-tracker-shell' });
  shell.appendChild(buildTrackerHeader(data));

  if (!data.availableTeams?.length) {
    shell.appendChild(
      emptyState(
        'No manageable teams',
        'Create or manage a team first before using Worker Tracker.'
      )
    );
    return shell;
  }

  if (data.unassignedTasks?.length) {
    shell.appendChild(buildUnassignedSection(data));
  }

  shell.appendChild(buildTrackerGrid(data));
  return shell;
}

function buildTrackerHeader(data) {
  const wrapper = el('section', { className: 'card worker-tracker-summary' });

  wrapper.appendChild(
    el(
      'div',
      { className: 'worker-tracker-summary__heading' },
      el(
        'div',
        {},
        el('h2', { className: 'section-title' }, data.team?.name || 'Worker Tracker'),
        el(
          'p',
          { className: 'section-subtitle' },
          data.team?.description || 'Start from a team, then drill into employees and their work.'
        )
      ),
      el(
        'div',
        { className: 'worker-tracker-summary__actions' },
        el('a', { className: 'btn btn-outline', href: '#/tasks' }, 'Open Tasks')
      )
    )
  );

  if ((data.availableTeams || []).length > 1) {
    const teamSelect = el('select', { className: 'form-select worker-tracker-team-select' });
    for (const team of data.availableTeams) {
      teamSelect.appendChild(
        el('option', { value: team.id, selected: team.id === data.selectedTeamId }, team.name)
      );
    }
    teamSelect.addEventListener('change', () => {
      window.location.hash = buildTrackerHash({ teamId: teamSelect.value });
    });

    wrapper.appendChild(
      el(
        'div',
        { className: 'worker-tracker-summary__controls' },
        el('label', { className: 'form-label' }, 'Team'),
        teamSelect
      )
    );
  }

  wrapper.appendChild(
    el(
      'div',
      { className: 'worker-tracker-summary__stats' },
      trackerStat('Completion', formatPercent(data.summary?.completionPercent || 0, 0)),
      trackerStat('Total', String(data.summary?.totalTaskCount || 0)),
      trackerStat('Open', String(data.summary?.openTaskCount || 0)),
      trackerStat('Completed', String(data.summary?.completedTaskCount || 0)),
      trackerStat('Overdue', String(data.summary?.overdueTaskCount || 0), (data.summary?.overdueTaskCount || 0) > 0 ? 'danger' : ''),
      trackerStat('Blocked', String(data.summary?.blockedTaskCount || 0), (data.summary?.blockedTaskCount || 0) > 0 ? 'warning' : ''),
      trackerStat('Unassigned', String(data.summary?.unassignedTaskCount || 0), (data.summary?.unassignedTaskCount || 0) > 0 ? 'info' : '')
    )
  );

  if ((data.summary?.unassignedTaskCount || 0) > 0) {
    wrapper.appendChild(
      el(
        'p',
        { className: 'worker-tracker-summary__hint' },
        `${data.summary.unassignedTaskCount} task${data.summary.unassignedTaskCount === 1 ? '' : 's'} still need an owner.`
      )
    );
  }

  return wrapper;
}

function trackerStat(label, value, tone = '') {
  return el(
    'div',
    { className: `worker-tracker-stat${tone ? ` worker-tracker-stat--${tone}` : ''}` },
    el('span', { className: 'worker-tracker-stat__label' }, label),
    el('strong', { className: 'worker-tracker-stat__value' }, value)
  );
}

function buildUnassignedSection(data) {
  const members = data.members || [];
  const section = el(
    'section',
    { className: 'card worker-tracker-section' },
    el(
      'div',
      { className: 'section-heading' },
      el('div', {}, el('h3', { className: 'section-title' }, 'Needs assignment')),
      el(
        'p',
        { className: 'section-subtitle' },
        'A short list of open work without an assignee.'
      )
    )
  );

  const list = el('div', { className: 'worker-tracker-task-list' });
  for (const task of data.unassignedTasks) {
    list.appendChild(
      buildTaskRow(task, {
        onAssign: members.length
          ? () =>
              openAssignModal(task, members, async () => {
                window.location.hash = buildTrackerHash({ teamId: data.selectedTeamId });
              })
          : null
      })
    );
  }

  section.appendChild(list);
  return section;
}

function buildTrackerGrid(data) {
  const grid = el('div', { className: 'worker-tracker-grid' });
  grid.appendChild(buildMemberSection(data));
  grid.appendChild(buildTaskDrilldownSection(data));
  return grid;
}

function buildMemberSection(data) {
  const section = el(
    'section',
    { className: 'card worker-tracker-section' },
    el(
      'div',
      { className: 'section-heading' },
      el('div', {}, el('h3', { className: 'section-title' }, 'Employees')),
      el(
        'p',
        { className: 'section-subtitle' },
        'Scan who is overloaded, stuck, or already moving work forward.'
      )
    )
  );

  const members = data.members || [];
  if (!members.length) {
    section.appendChild(
      emptyState(
        'No active employees',
        'Add or reactivate team members to start assigning work.'
      )
    );
    return section;
  }

  const list = el('div', { className: 'worker-tracker-member-list' });
  for (const member of members) {
    const selected = member.userId === data.selectedMemberUserId;
    list.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: `worker-tracker-member-row${selected ? ' is-active' : ''}`,
          onClick: () => {
            window.location.hash = buildTrackerHash({
              teamId: data.selectedTeamId,
              memberUserId: selected ? '' : member.userId
            });
          }
        },
        el(
          'div',
          { className: 'worker-tracker-member-row__identity' },
          el('strong', { className: 'worker-tracker-member-row__name' }, member.fullName || 'Unnamed employee'),
          el('span', { className: 'worker-tracker-member-row__meta' }, member.jobTitle || 'Team member')
        ),
        el(
          'div',
          { className: 'worker-tracker-member-metrics' },
          memberMetric('Completion', member.totalTaskCount ? `${member.completedTaskCount}/${member.totalTaskCount}` : '0'),
          memberMetric('Open', String(member.openTaskCount || 0)),
          memberMetric('Overdue', String(member.overdueTaskCount || 0), (member.overdueTaskCount || 0) > 0 ? 'danger' : ''),
          memberMetric('Blocked', String(member.blockedTaskCount || 0), (member.blockedTaskCount || 0) > 0 ? 'warning' : '')
        )
      )
    );
  }

  section.appendChild(list);
  return section;
}

function memberMetric(label, value, tone = '') {
  return el(
    'div',
    { className: `worker-tracker-member-metric${tone ? ` worker-tracker-member-metric--${tone}` : ''}` },
    el('span', { className: 'worker-tracker-member-metric__label' }, label),
    el('strong', { className: 'worker-tracker-member-metric__value' }, value)
  );
}

function buildTaskDrilldownSection(data) {
  const section = el(
    'section',
    { className: 'card worker-tracker-section worker-tracker-section--detail' },
    el(
      'div',
      { className: 'section-heading' },
      el(
        'div',
        {},
        el(
          'h3',
          { className: 'section-title' },
          data.selectedMember
            ? `Tasks for ${data.selectedMember.fullName}`
            : 'Employee tasks'
        ),
        el(
          'p',
          { className: 'section-subtitle' },
          data.selectedMember
            ? 'A focused view of this employee’s current workload.'
            : 'Select an employee to drill into their tasks.'
        )
      )
    )
  );

  if (!data.selectedMember) {
    section.appendChild(
      emptyState(
        'Select an employee',
        'Choose a row on the left to drill into that person’s tasks.'
      )
    );
    return section;
  }

  if (!(data.tasks || []).length) {
    section.appendChild(
      emptyState(
        'No assigned tasks',
        'This employee does not currently own any active task assignments.'
      )
    );
    return section;
  }

  const list = el('div', { className: 'worker-tracker-task-list' });
  const members = data.members || [];
  for (const task of data.tasks) {
    list.appendChild(
      buildTaskRow(task, {
        onAssign: () =>
          openAssignModal(task, members, async () => {
            window.location.hash = buildTrackerHash({
              teamId: data.selectedTeamId,
              memberUserId: data.selectedMemberUserId
            });
          }),
        editHref: '#/tasks'
      })
    );
  }

  section.appendChild(list);
  return section;
}

function buildTaskRow(task, { onAssign, editHref } = {}) {
  const latestNote = task.latestUpdate?.note || task.notes || '';
  const dueText = task.dueAt
    ? `${formatDate(task.dueAt)}${task.timeRemainingSeconds != null ? ` · ${formatTimeRemaining(task.timeRemainingSeconds)}` : ''}`
    : 'No due date';

  return el(
    'div',
    { className: 'worker-tracker-task-row' },
    el(
      'div',
      { className: 'worker-tracker-task-row__main' },
      el(
        'div',
        { className: 'worker-tracker-task-row__titleline' },
        el('strong', { className: 'worker-tracker-task-row__title' }, task.title),
        el('span', { className: 'badge badge-default' }, statusLabel(task.status)),
        el('span', { className: `badge badge-priority-${task.priority || 'medium'}` }, priorityLabel(task.priority))
      ),
      el(
        'div',
        { className: 'worker-tracker-task-row__meta' },
        el('span', {}, task.assignment?.assigneeFullName || 'Unassigned'),
        el('span', {}, dueText),
        el('span', {}, `Progress ${formatPercent(task.progressPercent || 0)}`)
      ),
      latestNote
        ? el('p', { className: 'worker-tracker-task-row__update' }, latestNote)
        : null
    ),
    el(
      'div',
      { className: 'worker-tracker-task-row__actions' },
      onAssign
        ? el(
            'button',
            { type: 'button', className: 'btn btn-sm btn-outline', onClick: onAssign },
            task.assignment ? 'Reassign' : 'Assign'
          )
        : null,
      editHref
        ? el('a', { className: 'btn btn-sm btn-outline', href: editHref }, 'Open in Tasks')
        : null
    )
  );
}

function openAssignModal(task, members, onAssigned) {
  const sel = el('select', { className: 'form-select', name: 'assignee' });
  for (const member of members) {
    sel.appendChild(
      el('option', { value: member.userId }, member.fullName || member.firstName || 'Team member')
    );
  }

  if (task.assignment?.assigneeUserId) {
    sel.value = task.assignment.assigneeUserId;
  }

  const noteInput = el('textarea', {
    className: 'form-textarea',
    name: 'assignmentNote',
    placeholder: 'Optional assignment note'
  });

  const form = el(
    'div',
    {},
    el(
      'div',
      { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Assign to employee'),
      sel
    ),
    el(
      'div',
      { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Note'),
      noteInput
    )
  );

  const saveBtn = el(
    'button',
    { className: 'btn btn-primary', type: 'button' },
    task.assignment ? 'Reassign' : 'Assign'
  );

  saveBtn.addEventListener('click', async () => {
    if (!sel.value) {
      showError('Select an employee.');
      return;
    }

    saveBtn.disabled = true;
    try {
      await api.post('/task-assignments', {
        taskId: task.id,
        assigneeUserId: sel.value,
        assignmentNote: noteInput.value || undefined
      });
      showSuccess(task.assignment ? 'Task reassigned.' : 'Task assigned.');
      closeModal();
      await onAssigned?.();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal(
    `${task.assignment ? 'Reassign' : 'Assign'}: ${task.title}`,
    form,
    el(
      'div',
      { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'),
      saveBtn
    )
  );
}
