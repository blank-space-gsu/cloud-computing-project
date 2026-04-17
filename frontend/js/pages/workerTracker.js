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

/* ============================================================
 * Worker Tracker — hierarchical drilldown
 *   Team  →  Worker  →  Tasks     (+ separate Unassigned panel)
 *
 * Frontend-only redesign. Backend contract unchanged: uses
 * GET /worker-tracker?teamId=&memberUserId= and
 * POST /task-assignments exactly as before.
 * ========================================================== */

const state = {
  container: null,
  availableTeams: [],
  teamCache: new Map(),       // teamId -> { team, summary, members, unassignedTasks, memberIndex }
  workerTasks: new Map(),     // `${teamId}:${userId}` -> tasks[]
  expandedTeams: new Set(),   // teamIds
  expandedWorker: new Map(),  // teamId -> userId (single-open accordion per team)
  initialTeamId: null,
  loadingTeams: new Set(),    // teamIds currently fetching
  loadingWorkerKeys: new Set()
};

function resetState() {
  state.container = null;
  state.availableTeams = [];
  state.teamCache = new Map();
  state.workerTasks = new Map();
  state.expandedTeams = new Set();
  state.expandedWorker = new Map();
  state.initialTeamId = null;
  state.loadingTeams = new Set();
  state.loadingWorkerKeys = new Set();
}

/* ---------- URL hash ---------- */

function parseHashState() {
  const raw = window.location.hash || '';
  const queryIndex = raw.indexOf('?');
  const qs = queryIndex === -1 ? '' : raw.slice(queryIndex + 1);
  const params = new URLSearchParams(qs);
  return {
    teamId: params.get('teamId') || null,
    memberUserId: params.get('memberUserId') || null,
    openTeams: (params.get('openTeams') || '').split(',').filter(Boolean)
  };
}

function writeHash() {
  const params = new URLSearchParams();
  if (state.initialTeamId) params.set('teamId', state.initialTeamId);
  const openWorker = [...state.expandedWorker.entries()].find(([tid]) => tid === state.initialTeamId);
  if (openWorker && openWorker[1]) params.set('memberUserId', openWorker[1]);
  const openTeams = [...state.expandedTeams].join(',');
  if (openTeams) params.set('openTeams', openTeams);
  const q = params.toString();
  const next = `#/worker-tracker${q ? `?${q}` : ''}`;
  if (window.location.hash !== next) {
    // replaceState avoids re-entering the router (no hashchange event)
    window.history.replaceState(null, '', next);
  }
}

/* ---------- API ---------- */

async function fetchTeam(teamId, memberUserId = null) {
  const q = new URLSearchParams();
  if (teamId) q.set('teamId', teamId);
  if (memberUserId) q.set('memberUserId', memberUserId);
  const { data } = await api.get(`/worker-tracker${q.toString() ? `?${q.toString()}` : ''}`);
  return data;
}

function cacheTeamData(teamId, data) {
  const memberIndex = new Map();
  for (const m of (data.members || [])) memberIndex.set(m.userId, m);
  state.teamCache.set(teamId, {
    team: data.team,
    summary: data.summary || {},
    members: data.members || [],
    unassignedTasks: data.unassignedTasks || [],
    memberIndex
  });
}

/* ---------- Page entry ---------- */

export default async function workerTrackerPage(container, params = {}) {
  renderHeader('Worker Tracker', 'Teams, workers, and their tasks');
  clearElement(container);
  resetState();
  state.container = container;

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
    const initial = await fetchTeam(params.teamId || null, params.memberUserId || null);
    state.availableTeams = initial.availableTeams || [];

    clearElement(container);

    if (!state.availableTeams.length) {
      container.appendChild(
        emptyState(
          'No manageable teams',
          'Create or manage a team first before using Worker Tracker.'
        )
      );
      return;
    }

    state.initialTeamId = initial.selectedTeamId;
    cacheTeamData(state.initialTeamId, initial);

    // Default: the focused team is expanded. Also honor any `openTeams` from the hash.
    const hash = parseHashState();
    const wanted = new Set([state.initialTeamId, ...hash.openTeams]);
    for (const id of wanted) {
      if (state.availableTeams.some((t) => t.id === id)) {
        state.expandedTeams.add(id);
      }
    }

    if (params.memberUserId) {
      const m = (initial.members || []).find((x) => x.userId === params.memberUserId);
      if (m) {
        state.expandedWorker.set(state.initialTeamId, m.userId);
        state.workerTasks.set(`${state.initialTeamId}:${m.userId}`, initial.tasks || []);
      }
    }

    // Kick off lazy background loads for any additional expanded teams.
    for (const id of state.expandedTeams) {
      if (id !== state.initialTeamId && !state.teamCache.has(id)) {
        loadTeam(id);
      }
    }

    render();
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

/* ---------- Render root ---------- */

function render() {
  const c = state.container;
  if (!c) return;
  clearElement(c);
  const root = el('div', { className: 'wt-page' });
  root.appendChild(buildTopBar());
  root.appendChild(buildTeamsStack());
  root.appendChild(buildUnassignedPanel());
  c.appendChild(root);
  writeHash();
}

/* ---------- Top bar ---------- */

function buildTopBar() {
  const bar = el('div', { className: 'wt-topbar' });

  bar.appendChild(
    el(
      'div',
      { className: 'wt-topbar__title' },
      el('h2', { className: 'wt-topbar__heading' }, 'Team operations'),
      el(
        'p',
        { className: 'wt-topbar__sub' },
        'Expand a team to see workers. Expand a worker to see their tasks.'
      )
    )
  );

  const actions = el('div', { className: 'wt-topbar__actions' });

  if (state.availableTeams.length > 1) {
    const sel = el('select', {
      className: 'form-select wt-topbar__select',
      'aria-label': 'Jump to team'
    });
    sel.appendChild(el('option', { value: '' }, 'Jump to team…'));
    for (const t of state.availableTeams) {
      sel.appendChild(el('option', { value: t.id }, t.name));
    }
    sel.addEventListener('change', async () => {
      const id = sel.value;
      sel.value = '';
      if (!id) return;
      state.expandedTeams.add(id);
      if (!state.teamCache.has(id)) {
        await loadTeam(id);
      } else {
        render();
      }
      const node = document.getElementById(`wt-team-${id}`);
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    actions.appendChild(sel);
  }

  actions.appendChild(
    el(
      'a',
      { className: 'btn btn-outline wt-topbar__open-tasks', href: '#/tasks' },
      'Open Tasks'
    )
  );

  bar.appendChild(actions);
  return bar;
}

/* ---------- Teams stack ---------- */

function buildTeamsStack() {
  const stack = el('div', { className: 'wt-stack' });
  stack.appendChild(
    el(
      'div',
      { className: 'wt-stack__caption' },
      el('span', { className: 'wt-stack__label' }, 'Teams'),
      el(
        'span',
        { className: 'wt-stack__hint' },
        `${state.availableTeams.length} team${state.availableTeams.length === 1 ? '' : 's'}`
      )
    )
  );
  for (const team of state.availableTeams) {
    stack.appendChild(buildTeamRow(team));
  }
  return stack;
}

function buildTeamRow(team) {
  const isOpen = state.expandedTeams.has(team.id);
  const cached = state.teamCache.get(team.id);
  const summary = cached?.summary;
  const health = deriveTeamHealth(summary);

  const row = el('section', {
    id: `wt-team-${team.id}`,
    className: `wt-team wt-team--${health}${isOpen ? ' is-open' : ''}`
  });

  const header = el('button', {
    type: 'button',
    className: 'wt-team__header',
    'aria-expanded': isOpen ? 'true' : 'false',
    onClick: () => toggleTeam(team.id)
  });

  header.appendChild(el('span', { className: 'wt-chev', 'aria-hidden': 'true' }, isOpen ? '▾' : '▸'));

  const ident = el('div', { className: 'wt-team__identity' });
  ident.appendChild(el('span', { className: 'wt-team__name' }, team.name));
  const subParts = [];
  const mc = team.memberCount ?? cached?.members?.length;
  if (mc != null) subParts.push(`${mc} member${mc === 1 ? '' : 's'}`);
  if (team.description) subParts.push(team.description);
  ident.appendChild(el('span', { className: 'wt-team__sub' }, subParts.join(' · ') || 'Team'));
  header.appendChild(ident);

  // Completion cluster (bar + pct)
  const pct = summary ? Number(summary.completionPercent || 0) : null;
  header.appendChild(
    el(
      'div',
      { className: 'wt-progress' },
      buildBar(pct),
      el('span', { className: 'wt-pct' }, pct == null ? '—' : formatPercent(pct, 0))
    )
  );

  header.appendChild(
    buildMetricCluster([
      ['Open', summary?.openTaskCount],
      ['Overdue', summary?.overdueTaskCount, 'danger'],
      ['Blocked', summary?.blockedTaskCount, 'warning'],
      ['Unassigned', summary?.unassignedTaskCount, 'info']
    ])
  );

  row.appendChild(header);

  if (isOpen) {
    row.appendChild(buildTeamBody(team));
  }
  return row;
}

function buildTeamBody(team) {
  const body = el('div', { className: 'wt-team__body' });
  const cached = state.teamCache.get(team.id);

  if (!cached) {
    body.appendChild(el('div', { className: 'wt-loading' }, 'Loading team…'));
    if (!state.loadingTeams.has(team.id)) loadTeam(team.id);
    return body;
  }

  if (!cached.members.length) {
    body.appendChild(el('div', { className: 'wt-empty' }, 'No active employees on this team.'));
    return body;
  }

  for (const member of cached.members) {
    body.appendChild(buildWorkerRow(team, member));
  }
  return body;
}

/* ---------- Worker row ---------- */

function buildWorkerRow(team, member) {
  const openUserId = state.expandedWorker.get(team.id);
  const isOpen = openUserId === member.userId;
  const pill = deriveWorkerPill(member);
  const completionPct = member.totalTaskCount
    ? Math.round(
        (Number(member.completedTaskCount || 0) / Number(member.totalTaskCount)) * 100
      )
    : 0;

  const row = el('div', {
    className: `wt-worker${isOpen ? ' is-open' : ''}`
  });

  const header = el('button', {
    type: 'button',
    className: 'wt-worker__header',
    'aria-expanded': isOpen ? 'true' : 'false',
    onClick: () => toggleWorker(team.id, member.userId)
  });

  header.appendChild(el('span', { className: 'wt-chev', 'aria-hidden': 'true' }, isOpen ? '▾' : '▸'));
  header.appendChild(el('span', { className: 'wt-avatar' }, initialsOf(member.fullName)));

  const ident = el('div', { className: 'wt-worker__identity' });
  ident.appendChild(
    el('span', { className: 'wt-worker__name' }, member.fullName || 'Unnamed employee')
  );
  ident.appendChild(el('span', { className: 'wt-worker__title' }, member.jobTitle || 'Team member'));
  header.appendChild(ident);

  header.appendChild(
    el(
      'div',
      { className: 'wt-progress' },
      buildBar(completionPct),
      el('span', { className: 'wt-pct' }, `${completionPct}%`)
    )
  );

  header.appendChild(
    buildMetricCluster([
      ['Open', member.openTaskCount],
      ['Overdue', member.overdueTaskCount, 'danger'],
      ['Blocked', member.blockedTaskCount, 'warning']
    ])
  );

  header.appendChild(el('span', { className: `wt-pill wt-pill--${pill.tone}` }, pill.label));

  row.appendChild(header);

  if (isOpen) {
    row.appendChild(buildWorkerBody(team, member));
  }
  return row;
}

function buildWorkerBody(team, member) {
  const wrap = el('div', { className: 'wt-worker__body' });
  const key = `${team.id}:${member.userId}`;
  const tasks = state.workerTasks.get(key);

  if (!tasks) {
    wrap.appendChild(el('div', { className: 'wt-loading' }, 'Loading tasks…'));
    if (!state.loadingWorkerKeys.has(key)) loadWorkerTasks(team.id, member.userId);
    return wrap;
  }

  if (!tasks.length) {
    wrap.appendChild(el('div', { className: 'wt-empty' }, 'No active task assignments.'));
    return wrap;
  }

  const list = el('div', { className: 'wt-tasks' });
  for (const task of tasks) {
    list.appendChild(buildTaskRow(team, member, task));
  }
  wrap.appendChild(list);
  return wrap;
}

/* ---------- Task row ---------- */

function buildTaskRow(team, member, task) {
  const latestNote = task.latestUpdate?.note || task.notes || '';
  const overdue =
    task.timeRemainingSeconds != null &&
    task.timeRemainingSeconds <= 0 &&
    task.status !== 'completed';
  const dueText = task.dueAt
    ? `${formatDate(task.dueAt)}${
        task.timeRemainingSeconds != null ? ` · ${formatTimeRemaining(task.timeRemainingSeconds)}` : ''
      }`
    : 'No due date';
  const pct = Number(task.progressPercent || 0);

  const row = el('div', { className: `wt-task${overdue ? ' is-overdue' : ''}` });

  row.appendChild(
    el('span', {
      className: `wt-task__prio wt-task__prio--${task.priority || 'medium'}`,
      title: `Priority: ${priorityLabel(task.priority)}`,
      'aria-hidden': 'true'
    })
  );

  const main = el('div', { className: 'wt-task__main' });

  main.appendChild(
    el(
      'div',
      { className: 'wt-task__titleline' },
      el('span', { className: 'wt-task__title' }, task.title),
      el(
        'span',
        { className: `wt-chip wt-chip--status wt-chip--status-${task.status || 'todo'}` },
        statusLabel(task.status)
      ),
      el(
        'span',
        { className: `wt-chip wt-chip--prio wt-chip--prio-${task.priority || 'medium'}` },
        priorityLabel(task.priority)
      )
    )
  );

  const meta = el('div', { className: 'wt-task__meta' });
  meta.appendChild(
    el('span', { className: `wt-task__due${overdue ? ' is-overdue' : ''}` }, dueText)
  );
  meta.appendChild(
    el(
      'span',
      { className: 'wt-task__progress', title: `${Math.round(pct)}% progress` },
      buildInlineBar(pct),
      el('span', { className: 'wt-task__progress-pct' }, `${Math.round(pct)}%`)
    )
  );
  if (latestNote) {
    const trimmed = latestNote.length > 90 ? `${latestNote.slice(0, 90)}…` : latestNote;
    meta.appendChild(
      el(
        'span',
        { className: 'wt-task__note', title: latestNote },
        el('span', { className: 'wt-task__note-label' }, 'Note'),
        el('span', { className: 'wt-task__note-text' }, trimmed)
      )
    );
  }
  main.appendChild(meta);

  row.appendChild(main);

  const actions = el('div', { className: 'wt-task__actions' });
  actions.appendChild(
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-sm btn-outline',
        onClick: () =>
          openAssignModal(task, team, async () => {
            await refreshTeam(team.id, member.userId);
          })
      },
      task.assignment ? 'Reassign' : 'Assign'
    )
  );
  actions.appendChild(
    el('a', { className: 'btn btn-sm btn-outline', href: '#/tasks' }, 'Open in Tasks')
  );
  row.appendChild(actions);

  return row;
}

/* ---------- Unassigned panel ---------- */

function buildUnassignedPanel() {
  const tasks = aggregateUnassigned();
  const panel = el('section', { className: 'wt-unassigned' });

  panel.appendChild(
    el(
      'div',
      { className: 'wt-unassigned__head' },
      el(
        'div',
        { className: 'wt-unassigned__title' },
        el('span', { className: 'wt-unassigned__label' }, 'Unassigned tasks'),
        el('span', { className: 'wt-unassigned__count' }, String(tasks.length))
      ),
      el(
        'span',
        { className: 'wt-unassigned__hint' },
        tasks.length
          ? 'These tasks still need an owner.'
          : 'Everything loaded is assigned.'
      )
    )
  );

  if (!tasks.length) return panel;

  const list = el('div', { className: 'wt-unassigned__list' });
  for (const { task, team } of tasks) {
    list.appendChild(buildUnassignedRow(task, team));
  }
  panel.appendChild(list);
  return panel;
}

function buildUnassignedRow(task, team) {
  const dueText = task.dueAt
    ? `${formatDate(task.dueAt)}${
        task.timeRemainingSeconds != null ? ` · ${formatTimeRemaining(task.timeRemainingSeconds)}` : ''
      }`
    : 'No due date';

  const row = el('div', { className: 'wt-u-task' });

  row.appendChild(
    el('span', {
      className: `wt-task__prio wt-task__prio--${task.priority || 'medium'}`,
      'aria-hidden': 'true'
    })
  );

  const main = el('div', { className: 'wt-u-task__main' });
  main.appendChild(
    el(
      'div',
      { className: 'wt-u-task__titleline' },
      el('span', { className: 'wt-u-task__title' }, task.title),
      el(
        'span',
        { className: `wt-chip wt-chip--status wt-chip--status-${task.status || 'todo'}` },
        statusLabel(task.status)
      ),
      el(
        'span',
        { className: `wt-chip wt-chip--prio wt-chip--prio-${task.priority || 'medium'}` },
        priorityLabel(task.priority)
      ),
      team ? el('span', { className: 'wt-chip wt-chip--team' }, team.name) : null
    )
  );
  main.appendChild(el('div', { className: 'wt-u-task__meta' }, el('span', {}, dueText)));
  row.appendChild(main);

  const actions = el('div', { className: 'wt-u-task__actions' });
  actions.appendChild(
    el(
      'button',
      {
        type: 'button',
        className: 'btn btn-sm btn-primary',
        onClick: () =>
          openAssignModal(task, team, async () => {
            await refreshTeam(team?.id);
          })
      },
      'Assign'
    )
  );
  row.appendChild(actions);
  return row;
}

/* ---------- Helpers ---------- */

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const init = parts.map((p) => p[0]).join('').toUpperCase();
  return init || '?';
}

function buildBar(pct) {
  const wrap = el('span', { className: 'wt-bar' });
  if (pct == null) {
    wrap.classList.add('wt-bar--empty');
    return wrap;
  }
  const fill = el('span', { className: 'wt-bar__fill' });
  fill.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
  wrap.appendChild(fill);
  return wrap;
}

function buildInlineBar(pct) {
  const wrap = el('span', { className: 'wt-ibar' });
  const fill = el('span', { className: 'wt-ibar__fill' });
  fill.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
  wrap.appendChild(fill);
  return wrap;
}

function buildMetricCluster(items) {
  const cluster = el('div', { className: 'wt-metrics' });
  for (const [label, value, tone] of items) {
    const v = value == null ? 0 : Number(value);
    const active = v > 0 && tone;
    cluster.appendChild(
      el(
        'div',
        { className: `wt-metric${active ? ` wt-metric--${tone}` : ''}` },
        el('span', { className: 'wt-metric__label' }, label),
        el('span', { className: 'wt-metric__value' }, String(v))
      )
    );
  }
  return cluster;
}

function deriveTeamHealth(summary) {
  if (!summary) return 'unknown';
  const overdue = Number(summary.overdueTaskCount || 0);
  const blocked = Number(summary.blockedTaskCount || 0);
  const unassigned = Number(summary.unassignedTaskCount || 0);
  const completion = Number(summary.completionPercent || 0);
  if (overdue > 0 || blocked >= 3) return 'danger';
  if (blocked > 0 || unassigned > 0) return 'warning';
  if (completion >= 80) return 'good';
  return 'neutral';
}

function deriveWorkerPill(m) {
  const blocked = Number(m.blockedTaskCount || 0);
  const overdue = Number(m.overdueTaskCount || 0);
  const open = Number(m.openTaskCount || 0);
  if (blocked > 0) return { label: 'Blocked work', tone: 'danger' };
  if (overdue > 0) return { label: 'Needs follow-up', tone: 'warning' };
  if (open >= 8) return { label: 'High load', tone: 'info' };
  return { label: 'On track', tone: 'good' };
}

function aggregateUnassigned() {
  const seen = new Set();
  const out = [];
  for (const team of state.availableTeams) {
    const cached = state.teamCache.get(team.id);
    if (!cached) continue;
    for (const t of cached.unassignedTasks || []) {
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push({ task: t, team });
    }
  }
  return out;
}

/* ---------- State transitions ---------- */

function toggleTeam(teamId) {
  if (state.expandedTeams.has(teamId)) {
    state.expandedTeams.delete(teamId);
  } else {
    state.expandedTeams.add(teamId);
    if (!state.teamCache.has(teamId) && !state.loadingTeams.has(teamId)) {
      loadTeam(teamId);
    }
  }
  render();
}

function toggleWorker(teamId, userId) {
  const current = state.expandedWorker.get(teamId);
  if (current === userId) {
    state.expandedWorker.delete(teamId);
  } else {
    state.expandedWorker.set(teamId, userId);
    const key = `${teamId}:${userId}`;
    if (!state.workerTasks.has(key) && !state.loadingWorkerKeys.has(key)) {
      loadWorkerTasks(teamId, userId);
    }
  }
  render();
}

async function loadTeam(teamId) {
  state.loadingTeams.add(teamId);
  try {
    const data = await fetchTeam(teamId);
    cacheTeamData(teamId, data);
  } catch (err) {
    showError(err);
  } finally {
    state.loadingTeams.delete(teamId);
    render();
  }
}

async function loadWorkerTasks(teamId, userId) {
  const key = `${teamId}:${userId}`;
  state.loadingWorkerKeys.add(key);
  try {
    const data = await fetchTeam(teamId, userId);
    // Freshen the team cache in the process (summary/members may have updated).
    cacheTeamData(teamId, data);
    state.workerTasks.set(key, data.tasks || []);
  } catch (err) {
    showError(err);
  } finally {
    state.loadingWorkerKeys.delete(key);
    render();
  }
}

async function refreshTeam(teamId, memberUserId = null) {
  if (!teamId) return;
  try {
    const data = await fetchTeam(teamId, memberUserId);
    cacheTeamData(teamId, data);
    if (memberUserId) {
      state.workerTasks.set(`${teamId}:${memberUserId}`, data.tasks || []);
    }
    render();
  } catch (err) {
    showError(err);
  }
}

/* ---------- Assign modal (contract unchanged) ---------- */

function openAssignModal(task, team, onAssigned) {
  const members = (team && state.teamCache.get(team.id)?.members) || [];

  const sel = el('select', { className: 'form-select', name: 'assignee' });
  sel.appendChild(el('option', { value: '' }, 'Select employee…'));
  for (const m of members) {
    sel.appendChild(
      el('option', { value: m.userId }, m.fullName || m.firstName || 'Team member')
    );
  }
  if (task.assignment?.assigneeUserId) sel.value = task.assignment.assigneeUserId;

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
