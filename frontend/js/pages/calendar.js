import * as api from '../api.js';
import { isEmployee } from '../auth.js';
import { el, clearElement } from '../utils/dom.js';
import { renderHeader } from '../components/header.js';
import { emptyState } from '../components/emptyState.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { showError } from '../components/toast.js';
import { closeModal, openModal } from '../components/modal.js';
import {
  formatDate,
  formatDateTime,
  priorityLabel,
  statusLabel
} from '../utils/format.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthPattern = /^\d{4}-\d{2}$/;

const buildCalendarHash = ({ month, teamId = '' }) => {
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (teamId) params.set('teamId', teamId);
  const query = params.toString();
  return `#/calendar${query ? `?${query}` : ''}`;
};

const parseMonthParam = (value) => {
  if (!monthPattern.test(value || '')) {
    return new Date();
  }

  const [year, month] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, 1);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const monthParamFromDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const monthLabel = (value) =>
  value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const startOfCalendarGrid = (value) => {
  const first = new Date(value.getFullYear(), value.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
};

const endOfCalendarGrid = (value) => {
  const start = startOfCalendarGrid(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  end.setHours(23, 59, 59, 999);
  return end;
};

const localDateKey = (iso) => {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateKeyFromDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonths = (value, amount) =>
  new Date(value.getFullYear(), value.getMonth() + amount, 1);

const buildCalendarDays = (monthDate) => {
  const days = [];
  const cursor = startOfCalendarGrid(monthDate);

  for (let index = 0; index < 42; index += 1) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const taskTone = (task) => {
  if (task.status === 'completed') return 'done';
  if (task.status === 'blocked') return 'blocked';
  if (task.isOverdue) return 'overdue';
  if (task.priority === 'urgent') return 'urgent';
  if (task.priority === 'high') return 'high';
  return 'default';
};

const MAX_PILLS_PER_DAY = 3;

export default async function calendarPage(container, params = {}) {
  renderHeader('Calendar', 'Your due-date view');
  clearElement(container);

  if (!isEmployee()) {
    container.appendChild(
      emptyState(
        'Calendar is employee-only',
        'This page is part of the employee work view.'
      )
    );
    return;
  }

  showLoading(container);

  try {
    const monthDate = parseMonthParam(params.month);
    const selectedTeamId = params.teamId || '';
    const rangeStart = startOfCalendarGrid(monthDate);
    const rangeEnd = endOfCalendarGrid(monthDate);

    const teamsRes = await api.get('/teams');

    const teams = (teamsRes.data.teams || []).sort((left, right) =>
      String(left.name || '').localeCompare(String(right.name || ''))
    );
    const validSelectedTeamId = teams.some((team) => team.id === selectedTeamId)
      ? selectedTeamId
      : '';

    const tasksRes = await api.get(
      `/tasks?sortBy=dueAt&sortOrder=asc&includeCompleted=true&limit=100&dateFrom=${dateKeyFromDate(rangeStart)}&dateTo=${dateKeyFromDate(rangeEnd)}${validSelectedTeamId ? `&teamId=${validSelectedTeamId}` : ''}`
    );

    clearElement(container);

    if (!teams.length) {
      const state = emptyState(
        'Join a team first',
        'Your calendar appears once you have active team memberships and due-dated work.'
      );
      state.appendChild(
        el('a', { className: 'btn btn-primary', href: '#/join', style: 'margin-top: 14px;' }, 'Join Team')
      );
      container.appendChild(state);
      return;
    }

    const tasks = (tasksRes.data.tasks || []).filter(
      (task) => task.dueAt && task.status !== 'cancelled'
    );

    container.appendChild(
      renderCalendarView({
        monthDate,
        selectedTeamId: validSelectedTeamId,
        teams,
        tasks
      })
    );
  } catch (err) {
    clearElement(container);
    hideLoading(container);
    showError(err);
    container.appendChild(
      emptyState(
        'Calendar unavailable',
        'We could not load your due-date calendar right now.'
      )
    );
  }
}

function renderCalendarView({ monthDate, selectedTeamId, teams, tasks }) {
  const shell = el('div', { className: 'cal' });
  const monthParam = monthParamFromDate(monthDate);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) || null;
  const tasksByDate = groupTasksByDate(tasks);
  const days = buildCalendarDays(monthDate);
  const todayKey = dateKeyFromDate(new Date());
  const todayMonthParam = monthParamFromDate(new Date());
  const isOnCurrentMonth = monthParam === todayMonthParam;

  // --- Top: title + compact month nav -----------------------------------
  const heading = el('div', { className: 'cal-top__heading' },
    el('h2', { className: 'cal-top__title' }, 'Calendar'),
    el('p', { className: 'cal-top__sub' }, 'See due work across your teams')
  );

  const prevBtn = el('button', {
    type: 'button',
    className: 'cal-nav__btn cal-nav__btn--step',
    'aria-label': 'Previous month',
    onClick: () => {
      window.location.hash = buildCalendarHash({
        month: monthParamFromDate(addMonths(monthDate, -1)),
        teamId: selectedTeamId
      });
    }
  }, '\u2039');

  const nextBtn = el('button', {
    type: 'button',
    className: 'cal-nav__btn cal-nav__btn--step',
    'aria-label': 'Next month',
    onClick: () => {
      window.location.hash = buildCalendarHash({
        month: monthParamFromDate(addMonths(monthDate, 1)),
        teamId: selectedTeamId
      });
    }
  }, '\u203a');

  const todayBtn = el('button', {
    type: 'button',
    className: `cal-nav__btn cal-nav__btn--today${isOnCurrentMonth ? ' is-disabled' : ''}`,
    disabled: isOnCurrentMonth,
    onClick: () => {
      if (isOnCurrentMonth) return;
      window.location.hash = buildCalendarHash({
        month: todayMonthParam,
        teamId: selectedTeamId
      });
    }
  }, 'Today');

  const nav = el('div', { className: 'cal-nav' },
    prevBtn,
    el('span', { className: 'cal-nav__label' }, monthLabel(monthDate)),
    nextBtn,
    todayBtn
  );

  shell.appendChild(el('section', { className: 'cal-top' }, heading, nav));

  // --- Team chips -------------------------------------------------------
  const chips = el('div', { className: 'cal-teams' },
    teamChip({
      label: 'All',
      active: !selectedTeamId,
      onClick: () => {
        window.location.hash = buildCalendarHash({ month: monthParam });
      }
    }),
    ...teams.map((team) =>
      teamChip({
        label: team.name,
        active: team.id === selectedTeamId,
        onClick: () => {
          window.location.hash = buildCalendarHash({
            month: monthParam,
            teamId: team.id
          });
        }
      })
    )
  );
  shell.appendChild(chips);

  // --- Quiet meta -------------------------------------------------------
  const scope = selectedTeam ? selectedTeam.name : 'All teams';
  shell.appendChild(el('p', { className: 'cal-meta' },
    `${tasks.length} task${tasks.length === 1 ? '' : 's'} \u00b7 ${scope}`
  ));

  if (!tasks.length) {
    shell.appendChild(el('p', { className: 'cal-empty' },
      'No due-dated tasks fall inside this month.'
    ));
  }

  // --- Month grid -------------------------------------------------------
  const grid = el('section', { className: 'cal-grid' });

  for (const dayName of DAY_NAMES) {
    grid.appendChild(el('div', { className: 'cal-weekday' }, dayName));
  }

  for (const day of days) {
    const dayKey = dateKeyFromDate(day);
    const dayTasks = tasksByDate.get(dayKey) || [];
    const isCurrentMonth = day.getMonth() === monthDate.getMonth();
    const isToday = dayKey === todayKey;
    const hasTasks = dayTasks.length > 0;

    const cellClasses = [
      'cal-day',
      !isCurrentMonth ? 'is-outside' : '',
      isToday ? 'is-today' : '',
      hasTasks ? 'has-tasks' : ''
    ].filter(Boolean).join(' ');

    const header = el('div', { className: 'cal-day__header' },
      el('span', { className: 'cal-day__num' }, String(day.getDate()))
    );
    if (hasTasks && isCurrentMonth) {
      header.appendChild(el('span', { className: 'cal-day__dot', 'aria-hidden': 'true' }));
    }

    const events = el('div', { className: 'cal-day__events' });
    if (isCurrentMonth) {
      const visible = dayTasks.slice(0, MAX_PILLS_PER_DAY);
      for (const task of visible) {
        events.appendChild(buildTaskPill(task));
      }
      const overflow = dayTasks.length - visible.length;
      if (overflow > 0) {
        events.appendChild(el('button', {
          type: 'button',
          className: 'cal-more',
          onClick: () => openDayListModal(day, dayTasks)
        }, `+${overflow} more`));
      }
    }

    grid.appendChild(el('div', { className: cellClasses }, header, events));
  }

  shell.appendChild(grid);
  return shell;
}

function teamChip({ label, active, onClick }) {
  return el('button', {
    type: 'button',
    className: `cal-chip${active ? ' is-active' : ''}`,
    onClick
  }, label);
}

function buildTaskPill(task) {
  const tone = taskTone(task);
  const teamName = task.teamName || '';

  const pill = el('button', {
    type: 'button',
    className: `cal-pill cal-pill--${tone}`,
    onClick: () => openTaskCalendarModal(task)
  },
    el('span', { className: 'cal-pill__rail', 'aria-hidden': 'true' }),
    el('span', { className: 'cal-pill__body' },
      el('span', { className: 'cal-pill__title' }, task.title || 'Untitled'),
      teamName
        ? el('span', { className: 'cal-pill__team' }, teamName)
        : null
    )
  );

  return pill;
}

function groupTasksByDate(tasks) {
  const grouped = new Map();

  for (const task of tasks) {
    const key = localDateKey(task.dueAt);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(task);
  }

  for (const [key, items] of grouped.entries()) {
    grouped.set(
      key,
      items.sort((left, right) => {
        const leftTime = left.dueAt ? Date.parse(left.dueAt) : 0;
        const rightTime = right.dueAt ? Date.parse(right.dueAt) : 0;
        return leftTime - rightTime;
      })
    );
  }

  return grouped;
}

function openDayListModal(day, tasks) {
  const list = el('div', { className: 'cal-daylist' });
  for (const task of tasks) {
    list.appendChild(buildTaskPill(task));
  }

  openModal(
    formatDate(day.toISOString(), { month: 'long', day: 'numeric', year: 'numeric' }),
    list,
    el('div', { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Close')
    )
  );
}

function openTaskCalendarModal(task) {
  const tone = taskTone(task);
  const progressPct = Math.max(0, Math.min(100, Number(task.progressPercent || 0)));
  const progressTone = progressPct >= 100 ? 'success' : progressPct >= 60 ? 'info' : progressPct > 0 ? 'warning' : 'neutral';

  const chipRow = el('div', { className: 'cal-modal__chips' },
    el('span', { className: `cal-modal__chip cal-modal__chip--status-${task.status || 'todo'}` }, statusLabel(task.status)),
    el('span', { className: `cal-modal__chip cal-modal__chip--priority-${task.priority || 'medium'}` }, priorityLabel(task.priority))
  );
  if (task.teamName) {
    chipRow.appendChild(el('span', { className: 'cal-modal__chip cal-modal__chip--team' }, task.teamName));
  }

  const dueLine = el('div', { className: `cal-modal__due cal-modal__due--${tone}` },
    el('span', { className: 'cal-modal__due-label' }, 'Due'),
    el('span', { className: 'cal-modal__due-value' }, formatDateTime(task.dueAt))
  );

  const progress = el('div', { className: 'cal-modal__progress' },
    el('div', { className: 'cal-modal__progress-head' },
      el('span', { className: 'cal-modal__progress-label' }, 'Progress'),
      el('span', { className: 'cal-modal__progress-pct' }, `${progressPct}%`)
    ),
    el('div', { className: 'cal-modal__progress-bar' },
      el('span', { className: `cal-modal__progress-fill cal-modal__progress-fill--${progressTone}`, style: `width: ${progressPct}%;` })
    )
  );

  const body = el('div', { className: 'cal-modal' },
    chipRow,
    dueLine,
    progress
  );

  if (task.description && task.description.trim()) {
    body.appendChild(el('p', { className: 'cal-modal__text' }, task.description.trim()));
  }
  if (task.notes && task.notes.trim()) {
    body.appendChild(el('p', { className: 'cal-modal__note' }, task.notes.trim()));
  }

  const assignee = task.assignment?.assigneeFullName;
  if (assignee) {
    body.appendChild(el('p', { className: 'cal-modal__assignee' }, `Assigned to ${assignee}`));
  }

  openModal(
    task.title || 'Task',
    body,
    el('div', { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Close'),
      el('a', {
        className: 'btn btn-primary',
        href: '#/tasks',
        onClick: () => closeModal()
      }, 'Open My Tasks')
    )
  );
}
