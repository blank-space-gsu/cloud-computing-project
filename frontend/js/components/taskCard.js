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

export function taskCard(task, { onEdit, onAssign, onDelete, showAssignee = false, variant = 'default' } = {}) {
  const progressValue = Number(task.progressPercent ?? 0);
  const isOverdue = Boolean(task.isOverdue);
  const isDueSoon = Boolean(task.isDueSoon);
  const isCompact = variant === 'compact';

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
    task.teamName ? el('span', { className: 'task-team-pill' }, task.teamName) : null
  );

  const summaryLine = el('div', { className: 'task-summary-line' },
    showAssignee ? el('span', { className: task.assignment ? 'task-assignee' : 'task-unassigned' }, `👤 ${assigneeText}`) : null,
    task.weekStartDate ? el('span', { className: 'task-week' }, `Week of ${formatDate(task.weekStartDate)}`) : null
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
    compactMeta('Estimated', task.estimatedHours != null ? formatHours(task.estimatedHours) : 'Not set')
  );

  const metrics = el('div', { className: 'task-metrics-grid' },
    metaCell('Deadline', task.dueAt ? formatDateTime(task.dueAt) : 'Not scheduled'),
    metaCell('Time left', task.timeRemainingSeconds != null ? formatTimeRemaining(task.timeRemainingSeconds) : 'No deadline'),
    metaCell('Estimated', task.estimatedHours != null ? formatHours(task.estimatedHours) : 'Not set'),
    metaCell('Status', statusLabel(task.status))
  );

  const footer = el('div', { className: 'task-footer' },
    !isCompact
      ? (task.notes ? el('p', { className: 'task-note' }, task.notes) : el('p', { className: 'task-note task-note--muted' }, 'No notes added yet.'))
      : (task.description ? el('p', { className: 'task-note task-note--compact' }, task.description) : null),
    (() => {
      const actions = el('div', { className: 'task-actions' });
      if (onEdit) actions.appendChild(el('button', { className: 'btn btn-sm btn-outline', onClick: () => onEdit(task) }, 'Edit'));
      if (onAssign && !task.assignment) actions.appendChild(el('button', { className: 'btn btn-sm btn-primary', onClick: () => onAssign(task) }, 'Assign'));
      if (onDelete) actions.appendChild(el('button', { className: 'btn btn-sm btn-danger', onClick: () => onDelete(task) }, 'Delete'));
      return actions.childNodes.length ? actions : null;
    })()
  );

  return el('div', { className: `task-card ${isCompact ? 'task-card--compact' : ''} ${isOverdue ? 'overdue' : ''} ${isDueSoon ? 'due-soon' : ''}` },
    header,
    !isCompact && task.description ? el('p', { className: 'task-desc' }, task.description) : null,
    summaryLine,
    progressBlock,
    isCompact ? compactMetrics : metrics,
    footer
  );
}
