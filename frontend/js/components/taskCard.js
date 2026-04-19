import { el } from '../utils/dom.js';
import {
  statusLabel,
  priorityLabel,
  formatDate,
  formatDateTime,
  formatHours,
  formatPercent,
  formatTimeRemaining
} from '../utils/format.js';

const PRIORITY_CLASS = { low: 'low', medium: 'medium', high: 'high', urgent: 'urgent' };
const STATUS_CLASS = {
  todo: 'default',
  in_progress: 'primary',
  blocked: 'warning',
  completed: 'success',
  cancelled: 'danger'
};

function metaCell(label, value) {
  return el('div', { className: 'task-meta-chip' },
    el('span', { className: 'task-meta-label' }, label),
    el('strong', { className: 'task-meta-value' }, value || '—')
  );
}

function compactMeta(label, value, tone = '') {
  return el('div', { className: `task-inline-chip${tone ? ` task-inline-chip--${tone}` : ''}` },
    el('span', { className: 'task-inline-chip__label' }, label),
    el('strong', { className: 'task-inline-chip__value' }, value || '—')
  );
}

export function taskCard(task, { onEdit, onAssign, onDelete, onComplete, showAssignee = false, variant = 'default' } = {}) {
  const progressValue = Number(task.progressPercent ?? 0);
  const isOverdue = Boolean(task.isOverdue);
  const isDueSoon = Boolean(task.isDueSoon);
  const isCompact = variant === 'compact';
  const isManager = variant === 'manager';

  const badges = el('div', { className: 'task-badges' },
    el('span', { className: `badge badge-${STATUS_CLASS[task.status] || 'default'}` }, statusLabel(task.status)),
    el('span', { className: `badge badge-priority-${PRIORITY_CLASS[task.priority] || 'medium'}` }, priorityLabel(task.priority)),
    isOverdue ? el('span', { className: 'badge badge-danger' }, 'Overdue') : null,
    (!isOverdue && isDueSoon) ? el('span', { className: 'badge badge-warning' }, 'Due Soon') : null
  );

  const assigneeText = task.assignment
    ? task.assignment.assigneeFullName || 'Assigned'
    : 'Unassigned';

  const header = el('div', { className: 'task-card-header' },
    el('div', { className: 'task-card-title-wrap' },
      el('h3', { className: 'task-title' }, task.title),
      badges
    ),
    !isManager && task.teamName ? el('span', { className: 'task-team-pill' }, task.teamName) : null
  );

  const summaryLine = el('div', { className: `task-summary-line${isManager ? ' task-summary-line--manager' : ''}` },
    showAssignee ? el('span', { className: task.assignment ? 'task-assignee' : 'task-unassigned' }, `👤 ${assigneeText}`) : null,
    task.weekStartDate ? el('span', { className: 'task-week' }, `Week of ${formatDate(task.weekStartDate)}`) : null
  );

  const managerSummaryLine = el('div', { className: 'task-summary-line task-summary-line--manager' },
    showAssignee
      ? el('span', { className: `task-summary-token${task.assignment ? '' : ' task-summary-token--warning'}` }, task.assignment ? assigneeText : 'Unassigned')
      : null,
    el('span', {
      className: `task-summary-token${isOverdue ? ' task-summary-token--danger' : isDueSoon ? ' task-summary-token--warning' : ''}`
    }, task.dueAt
      ? `Due ${formatDate(task.dueAt)}${task.timeRemainingSeconds != null ? ` · ${formatTimeRemaining(task.timeRemainingSeconds)}` : ''}`
      : 'No due date'),
    el('span', { className: 'task-summary-token' }, `Progress ${formatPercent(progressValue)}`)
  );

  const progressBlock = el('div', { className: 'task-progress-block' },
    el('div', { className: 'task-progress-row' },
      el('span', { className: 'task-progress-title' }, 'Progress'),
      el('span', { className: 'task-progress-value' }, formatPercent(progressValue))
    ),
    el('div', { className: 'progress-bar-container progress-bar-container--lg' },
      el('div', { className: 'progress-bar', style: `width:${Math.max(0, Math.min(progressValue, 100))}%` })
    )
  );

  const compactMetrics = el('div', { className: 'task-inline-metrics' },
    compactMeta('Due', task.dueAt ? formatDateTime(task.dueAt) : 'Not scheduled'),
    compactMeta('Time left', task.timeRemainingSeconds != null ? formatTimeRemaining(task.timeRemainingSeconds) : 'No deadline', isOverdue ? 'danger' : isDueSoon ? 'warning' : ''),
    compactMeta('Effort', task.estimatedHours != null ? formatHours(task.estimatedHours) : 'Not set')
  );

  const metrics = el('div', { className: 'task-metrics-grid' },
    metaCell('Deadline', task.dueAt ? formatDateTime(task.dueAt) : 'Not scheduled'),
    metaCell('Time left', task.timeRemainingSeconds != null ? formatTimeRemaining(task.timeRemainingSeconds) : 'No deadline'),
    metaCell('Effort', task.estimatedHours != null ? formatHours(task.estimatedHours) : 'Not set'),
    metaCell('Status', statusLabel(task.status))
  );

  const managerPrimaryActions = (() => {
    const actions = el('div', { className: 'task-actions task-actions--manager' });
    const hasAssignment = Boolean(task.assignment);
    const editButtonClass = onAssign ? 'btn btn-sm btn-outline' : 'btn btn-sm btn-primary';

    if (onAssign) {
      actions.appendChild(el(
        'button',
        {
          className: hasAssignment ? 'btn btn-sm btn-outline' : 'btn btn-sm btn-primary',
          onClick: () => onAssign(task)
        },
        hasAssignment ? 'Reassign' : 'Assign'
      ));
    }
    if (onEdit) {
      actions.appendChild(el('button', { className: editButtonClass, onClick: () => onEdit(task) }, 'Edit'));
    }
    if (onComplete && task.status !== 'completed' && task.status !== 'cancelled') {
      actions.appendChild(el('button', { className: 'btn btn-sm btn-outline', onClick: () => onComplete(task) }, 'Complete'));
    }

    return actions.childNodes.length ? actions : null;
  })();

  const managerFooter = el('div', { className: 'task-footer task-footer--manager' },
    managerPrimaryActions,
    onDelete
      ? el('button', {
          className: 'task-action-link task-action-link--danger',
          type: 'button',
          onClick: () => onDelete(task)
        }, 'Delete')
      : null
  );

  const footer = el('div', { className: 'task-footer' },
    !isCompact
      ? (task.notes ? el('p', { className: 'task-note' }, task.notes) : el('p', { className: 'task-note task-note--muted' }, 'No notes added yet.'))
      : (task.description ? el('p', { className: 'task-note task-note--compact' }, task.description) : null),
    (() => {
      const actions = el('div', { className: 'task-actions' });
      if (onComplete && task.status !== 'completed' && task.status !== 'cancelled') {
        actions.appendChild(el('button', { className: 'btn btn-sm btn-primary', onClick: () => onComplete(task) }, 'Complete'));
      }
      if (onEdit) actions.appendChild(el('button', { className: 'btn btn-sm btn-outline', onClick: () => onEdit(task) }, 'Edit'));
      if (onAssign && !task.assignment) actions.appendChild(el('button', { className: 'btn btn-sm btn-primary', onClick: () => onAssign(task) }, 'Assign'));
      if (onDelete) actions.appendChild(el('button', { className: 'btn btn-sm btn-danger', onClick: () => onDelete(task) }, 'Delete'));
      return actions.childNodes.length ? actions : null;
    })()
  );

  return el('div', { className: `task-card ${isCompact ? 'task-card--compact' : ''} ${isManager ? 'task-card--manager' : ''} ${isOverdue ? 'overdue' : ''} ${isDueSoon ? 'due-soon' : ''}` },
    header,
    isManager ? managerSummaryLine : summaryLine,
    isManager
      ? (task.description ? el('p', { className: 'task-desc task-desc--compact' }, task.description) : null)
      : (!isCompact && task.description ? el('p', { className: 'task-desc' }, task.description) : null),
    isManager ? null : progressBlock,
    isManager ? null : (isCompact ? compactMetrics : metrics),
    isManager ? managerFooter : footer
  );
}
