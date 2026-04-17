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
  formatPercent,
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
  value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

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

const taskEventClass = (task) => {
  if (task.status === 'completed') return 'calendar-event calendar-event--completed';
  if (task.status === 'blocked') return 'calendar-event calendar-event--blocked';
  if (task.isOverdue) return 'calendar-event calendar-event--overdue';
  if (task.priority === 'urgent') return 'calendar-event calendar-event--urgent';
  if (task.priority === 'high') return 'calendar-event calendar-event--high';
  return 'calendar-event';
};

export default async function calendarPage(container, params = {}) {
  renderHeader('Calendar', 'See what is due when across your teams.');
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
  const shell = el('div', { className: 'calendar-shell' });
  const monthParam = monthParamFromDate(monthDate);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) || null;
  const tasksByDate = groupTasksByDate(tasks);
  const days = buildCalendarDays(monthDate);
  const todayKey = dateKeyFromDate(new Date());

  shell.appendChild(
    el(
      'section',
      { className: 'card calendar-toolbar' },
      el(
        'div',
        { className: 'calendar-toolbar__top' },
        el(
          'div',
          { className: 'calendar-month-nav' },
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-outline btn-sm',
              onClick: () => {
                window.location.hash = buildCalendarHash({
                  month: monthParamFromDate(addMonths(monthDate, -1)),
                  teamId: selectedTeamId
                });
              }
            },
            '← Prev'
          ),
          el('h2', { className: 'calendar-month-label' }, monthLabel(monthDate)),
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-outline btn-sm',
              onClick: () => {
                window.location.hash = buildCalendarHash({
                  month: monthParamFromDate(addMonths(monthDate, 1)),
                  teamId: selectedTeamId
                });
              }
            },
            'Next →'
          )
        ),
        el(
          'div',
          { className: 'calendar-team-toggles' },
          teamToggle({
            label: 'All Teams',
            active: !selectedTeamId,
            onClick: () => {
              window.location.hash = buildCalendarHash({ month: monthParam });
            }
          }),
          ...teams.map((team) =>
            teamToggle({
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
        )
      ),
      el(
        'p',
        { className: 'calendar-toolbar__summary' },
        `${tasks.length} due-dated task${tasks.length === 1 ? '' : 's'} in view${selectedTeam ? ` · ${selectedTeam.name}` : ' · All active teams'}`
      )
    )
  );

  if (!tasks.length) {
    shell.appendChild(
      el(
        'p',
        { className: 'calendar-empty-note' },
        'No due-dated tasks fall inside this calendar view.'
      )
    );
  }

  const gridWrap = el('div', { className: 'calendar-grid-wrap' });
  const grid = el('section', { className: 'calendar-grid' });

  for (const dayName of DAY_NAMES) {
    grid.appendChild(el('div', { className: 'calendar-weekday' }, dayName));
  }

  for (const day of days) {
    const dayKey = dateKeyFromDate(day);
    const dayTasks = tasksByDate.get(dayKey) || [];
    const isCurrentMonth = day.getMonth() === monthDate.getMonth();
    const isToday = dayKey === todayKey;

    grid.appendChild(
      el(
        'div',
        {
          className: `calendar-day${isCurrentMonth ? '' : ' calendar-day--outside'}${isToday ? ' calendar-day--today' : ''}`
        },
        el(
          'div',
          { className: 'calendar-day__header' },
          el('span', { className: 'calendar-day__number' }, String(day.getDate()))
        ),
        el(
          'div',
          { className: 'calendar-day__events' },
          ...dayTasks.map((task) =>
            el(
              'button',
              {
                type: 'button',
                className: taskEventClass(task),
                onClick: () => openTaskCalendarModal(task)
              },
              el('strong', { className: 'calendar-event__title' }, task.title),
              el(
                'span',
                { className: 'calendar-event__meta' },
                `${task.teamName || 'Team'} · ${statusLabel(task.status)}`
              )
            )
          )
        )
      )
    );
  }

  gridWrap.appendChild(grid);
  shell.appendChild(gridWrap);
  return shell;
}

function teamToggle({ label, active, onClick }) {
  return el(
    'button',
    {
      type: 'button',
      className: `calendar-team-toggle${active ? ' is-active' : ''}`,
      onClick
    },
    label
  );
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

function openTaskCalendarModal(task) {
  const body = el(
    'div',
    { className: 'calendar-task-modal' },
    el(
      'div',
      { className: 'calendar-task-modal__top' },
      el('h3', { className: 'calendar-task-modal__title' }, task.title),
      el(
        'div',
        { className: 'task-badges' },
        el('span', { className: 'badge badge-default' }, statusLabel(task.status)),
        el('span', { className: `badge badge-priority-${task.priority || 'medium'}` }, priorityLabel(task.priority))
      )
    ),
    el(
      'div',
      { className: 'calendar-task-modal__meta' },
      modalStat('Team', task.teamName || '—'),
      modalStat('Due', formatDateTime(task.dueAt)),
      modalStat('Progress', formatPercent(task.progressPercent || 0)),
      modalStat('Assignee', task.assignment?.assigneeFullName || 'You')
    ),
    task.description
      ? el('p', { className: 'calendar-task-modal__text' }, task.description)
      : null,
    task.notes
      ? el('p', { className: 'calendar-task-modal__text calendar-task-modal__text--muted' }, task.notes)
      : null
  );

  openModal(
    `Due ${formatDate(task.dueAt, { month: 'short', day: 'numeric' })}`,
    body,
    el(
      'div',
      { className: 'btn-group' },
      el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Close'),
      el(
        'a',
        {
          className: 'btn btn-primary',
          href: '#/tasks',
          onClick: () => closeModal()
        },
        'Open My Tasks'
      )
    )
  );
}

function modalStat(label, value) {
  return el(
    'div',
    { className: 'calendar-task-modal__stat' },
    el('span', { className: 'calendar-task-modal__stat-label' }, label),
    el('strong', { className: 'calendar-task-modal__stat-value' }, value)
  );
}
