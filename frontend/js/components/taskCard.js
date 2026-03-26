import { el } from '../utils/dom.js';
import { statusLabel, priorityLabel, formatDate, formatTimeRemaining } from '../utils/format.js';

const PRIORITY_CLASS = { low: 'low', medium: 'medium', high: 'high', urgent: 'urgent' };
const STATUS_CLASS = { todo: 'default', in_progress: 'primary', blocked: 'warning', completed: 'success', cancelled: 'danger' };

export function taskCard(task, { onEdit, onAssign, onDelete, showAssignee = false } = {}) {
  const badges = el('div', { className: 'task-badges' },
    el('span', { className: `badge badge-${STATUS_CLASS[task.status] || 'default'}` }, statusLabel(task.status)),
    el('span', { className: `badge badge-priority-${PRIORITY_CLASS[task.priority] || 'medium'}` }, priorityLabel(task.priority)),
    task.isOverdue ? el('span', { className: 'badge badge-danger' }, 'Overdue') : null,
    (!task.isOverdue && task.isDueSoon) ? el('span', { className: 'badge badge-warning' }, 'Due Soon') : null
  );

  const assignee = task.assignment
    ? el('span', { className: 'task-assignee' }, `👤 ${task.assignment.assigneeFullName || task.assignment.assigneeName || 'Assigned'}`)
    : el('span', { className: 'task-unassigned' }, 'Unassigned');

  const progress = el('div', { className: 'progress-bar-container' },
    el('div', { className: 'progress-bar', style: `width:${task.progressPercent || 0}%` }),
    el('span', { className: 'progress-label' }, `${task.progressPercent || 0}%`)
  );

  const meta = el('div', { className: 'task-meta' },
    task.dueAt ? el('span', {}, `Due: ${formatDate(task.dueAt)}`) : null,
    task.timeRemainingSeconds != null && !task.isOverdue ? el('span', { className: 'time-remaining' }, formatTimeRemaining(task.timeRemainingSeconds)) : null
  );

  const actions = el('div', { className: 'task-actions' });
  if (onEdit) actions.appendChild(el('button', { className: 'btn btn-sm btn-outline', onClick: () => onEdit(task) }, 'Edit'));
  if (onAssign && !task.assignment) actions.appendChild(el('button', { className: 'btn btn-sm btn-primary', onClick: () => onAssign(task) }, 'Assign'));
  if (onDelete) actions.appendChild(el('button', { className: 'btn btn-sm btn-danger', onClick: () => onDelete(task) }, 'Delete'));

  const card = el('div', { className: `task-card ${task.isOverdue ? 'overdue' : ''} ${task.isDueSoon ? 'due-soon' : ''}` },
    el('div', { className: 'task-card-header' },
      el('h3', { className: 'task-title' }, task.title),
      badges
    ),
    task.description ? el('p', { className: 'task-desc' }, task.description) : null,
    showAssignee ? assignee : null,
    progress,
    meta,
    actions.childNodes.length ? actions : null
  );

  return card;
}
