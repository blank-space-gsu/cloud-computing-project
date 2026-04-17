import { el, clearElement } from '../utils/dom.js';
import { isEmployee, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError } from '../components/toast.js';
import {
  capitalize,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatTimeRemaining
} from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam } from '../utils/teams.js';

/* ============================================================
 * Manager Dashboard — calm, attention-first landing page.
 *
 *   Greeting band
 *   Attention strip        (Overdue · Blocked · Unassigned · Completion)
 *   Attention queue        (urgent tasks + worker follow-up items)
 *   Team health            (lightweight rows, leads into Worker Tracker)
 *   Quiet next-step links
 *
 * Backend contract unchanged: still calls
 *   GET /teams
 *   GET /dashboards/manager?teamId=
 *   GET /tasks?teamId=...&sortBy=urgency&...
 *   GET /teams/{id}/members
 * ========================================================== */

export default async function dashboardPage(container) {
  if (isEmployee()) {
    window.location.hash = '#/tasks';
    return;
  }

  const user = getUser();
  renderHeader('Dashboard', 'Your manager overview');
  clearElement(container);
  showLoading(container);

  try {
    await renderManagerDashboard(container, user);
  } catch (err) {
    if (!isDashboardViewActive()) return;
    showError(err);
    hideLoading(container);
    clearElement(container);
    container.appendChild(
      emptyState(
        'Unable to load dashboard',
        err?.message || 'The dashboard could not be rendered right now.'
      )
    );
  }
}

function isDashboardViewActive() {
  return (window.location.hash || '#/dashboard').startsWith('#/dashboard');
}

async function renderManagerDashboard(container, user) {
  const teamResponse = await api.get('/teams');
  if (!isDashboardViewActive()) return;

  const teams = getVisibleTeams(
    (teamResponse.data.teams || []).filter((team) => team.canManageTeam)
  );

  clearElement(container);

  if (!teams.length) {
    container.appendChild(
      emptyState(
        'No manageable teams',
        'This manager account does not currently have a team to manage.'
      )
    );
    return;
  }

  let selectedTeamId = selectPreferredTeam(teams)?.id || teams[0].id;

  const shell = el('div', { className: 'dash-page' });
  const content = el('div', { className: 'dash-content' });
  shell.appendChild(content);
  container.appendChild(shell);

  async function loadManagerData(teamId) {
    clearElement(content);
    showLoading(content);

    try {
      const [dashboardRes, tasksRes, teamMembersRes] = await Promise.all([
        api.get(`/dashboards/manager?teamId=${teamId}`),
        api.get(
          `/tasks?teamId=${teamId}&sortBy=urgency&sortOrder=asc&includeCompleted=false&page=1&limit=8`
        ),
        api.get(`/teams/${teamId}/members`)
      ]);

      if (!isDashboardViewActive()) return;
      clearElement(content);

      const dashboard = dashboardRes.data;
      const tasks = tasksRes.data.tasks || [];
      const teamInfo = teamMembersRes.data.team || teams.find((t) => t.id === teamId);
      const mergedMembers = mergeMemberMetrics(
        teamMembersRes.data.members || [],
        dashboard.charts?.workloadByEmployee || []
      );
      const employeeRows = mergedMembers.filter((m) => m.appRole === 'employee');
      const summary = dashboard.summary || {};
      const blockedTaskCount = tasks.filter((t) => t.status === 'blocked').length;

      const attentionItems = computeAttentionItems({
        tasks,
        upcomingDeadlines: dashboard.tasks?.upcomingDeadlines || [],
        members: employeeRows,
        teamId
      });

      const strip = buildAttentionStrip({
        overdue: summary.overdueTaskCount || 0,
        blocked: blockedTaskCount,
        unassigned: summary.unassignedTaskCount || 0,
        completion: summary.completionRate || 0
      });

      content.appendChild(
        buildGreetingBand({
          user,
          teams,
          selectedTeamId: teamId,
          onTeamChange: async (id) => {
            selectedTeamId = id;
            await loadManagerData(id);
          },
          pendingCount: attentionItems.length
        })
      );
      content.appendChild(strip);
      content.appendChild(buildAttentionQueue(attentionItems, teamId));
      content.appendChild(buildTeamHealth(teams, summary, teamId));
      content.appendChild(buildQuietActions(teamId));
      void teamInfo; // kept for potential future use; intentionally not rendered
    } catch (err) {
      if (!isDashboardViewActive()) return;
      showError(err);
      hideLoading(content);
      clearElement(content);
      content.appendChild(
        emptyState(
          'Unable to load team dashboard',
          err?.message || 'This dashboard could not be loaded right now.'
        )
      );
    }
  }

  await loadManagerData(selectedTeamId);
}

/* ---------- Greeting band ---------- */

function buildGreetingBand({ user, teams, selectedTeamId, onTeamChange, pendingCount }) {
  const band = el('header', { className: 'dash-greet' });

  const left = el('div', { className: 'dash-greet__left' });
  left.appendChild(el('span', { className: 'dash-greet__eyebrow' }, currentDateLabel()));

  const line = el('h2', { className: 'dash-greet__line' });
  line.appendChild(document.createTextNode(`${timeOfDayGreeting()}, `));
  line.appendChild(el('span', { className: 'dash-greet__name' }, user?.firstName || 'there'));
  line.appendChild(document.createTextNode('.'));
  left.appendChild(line);

  if (teams.length > 1) {
    const row = el('div', { className: 'dash-greet__teamline' });
    row.appendChild(el('span', { className: 'dash-greet__teamline-label' }, 'Viewing'));
    const sel = el('select', { className: 'dash-inline-select', 'aria-label': 'Team' });
    for (const t of teams) {
      sel.appendChild(el('option', { value: t.id, selected: t.id === selectedTeamId }, t.name));
    }
    sel.addEventListener('change', () => onTeamChange(sel.value));
    row.appendChild(sel);
    left.appendChild(row);
  } else {
    const team = teams[0];
    if (team?.name) {
      const row = el('div', { className: 'dash-greet__teamline' });
      row.appendChild(el('span', { className: 'dash-greet__teamline-label' }, 'Viewing'));
      row.appendChild(el('span', { className: 'dash-greet__teamline-value' }, team.name));
      left.appendChild(row);
    }
  }

  band.appendChild(left);

  const right = el('div', { className: 'dash-greet__right' });
  const count = Number(pendingCount) || 0;
  right.appendChild(
    el(
      'div',
      { className: `dash-greet__callout${count > 0 ? ' is-active' : ''}` },
      el('span', { className: 'dash-greet__callout-num' }, String(count)),
      el(
        'span',
        { className: 'dash-greet__callout-text' },
        count === 0
          ? 'Nothing urgent. Take the lead.'
          : `${count === 1 ? 'item needs' : 'items need'} you today`
      )
    )
  );
  band.appendChild(right);

  return band;
}

/* ---------- Attention strip ---------- */

function buildAttentionStrip({ overdue, blocked, unassigned, completion }) {
  const wrap = el('div', { className: 'dash-strip', role: 'group', 'aria-label': 'Team health' });
  wrap.appendChild(buildIndicator({
    label: 'Overdue',
    value: overdue,
    tone: overdue > 0 ? 'danger' : 'calm',
    sub: overdue > 0 ? 'Needs triage' : 'None today'
  }));
  wrap.appendChild(buildIndicator({
    label: 'Blocked',
    value: blocked,
    tone: blocked > 0 ? 'warning' : 'calm',
    sub: blocked > 0 ? 'Awaiting unblock' : 'Flowing'
  }));
  wrap.appendChild(buildIndicator({
    label: 'Unassigned',
    value: unassigned,
    tone: unassigned > 0 ? 'info' : 'calm',
    sub: unassigned > 0 ? 'Needs owners' : 'All owned'
  }));
  const pct = Number(completion || 0);
  wrap.appendChild(buildIndicator({
    label: 'Completion',
    value: formatPercent(pct, 0),
    tone: pct >= 80 ? 'good' : pct >= 50 ? 'calm' : 'warning',
    sub: pct >= 80 ? 'On pace' : pct >= 50 ? 'Steady' : 'Behind'
  }));
  return wrap;
}

function buildIndicator({ label, value, tone, sub }) {
  return el(
    'div',
    { className: `dash-ind dash-ind--${tone}` },
    el(
      'div',
      { className: 'dash-ind__head' },
      el('span', { className: 'dash-ind__dot', 'aria-hidden': 'true' }),
      el('span', { className: 'dash-ind__label' }, label)
    ),
    el('div', { className: 'dash-ind__value' }, String(value)),
    el('div', { className: 'dash-ind__sub' }, sub)
  );
}

/* ---------- Attention queue ---------- */

function buildAttentionQueue(items, teamId) {
  const section = el('section', { className: 'dash-queue' });
  section.appendChild(
    el(
      'div',
      { className: 'dash-sec__head' },
      el('h3', { className: 'dash-sec__title' }, 'Attention queue'),
      el(
        'span',
        { className: `dash-sec__count${items.length ? ' is-active' : ''}` },
        String(items.length)
      ),
      el(
        'span',
        { className: 'dash-sec__hint' },
        items.length
          ? 'Highest-priority things to look at right now.'
          : 'Nothing is on fire. Use this time to plan.'
      )
    )
  );

  if (!items.length) {
    section.appendChild(
      el('div', { className: 'dash-queue__empty' }, 'You are clear. No overdue, blocked, or unassigned items.')
    );
    return section;
  }

  const list = el('ol', { className: 'dash-queue__list' });
  items.slice(0, 7).forEach((item, idx) => list.appendChild(buildQueueRow(item, idx + 1, teamId)));
  section.appendChild(list);

  if (items.length > 7) {
    section.appendChild(
      el(
        'a',
        { className: 'dash-queue__more', href: '#/tasks' },
        `View ${items.length - 7} more in Tasks →`
      )
    );
  }
  return section;
}

function buildQueueRow(item, rank, teamId) {
  const row = el('li', { className: `dash-qrow dash-qrow--${item.reason.tone}` });

  row.appendChild(el('span', { className: 'dash-qrow__rank' }, String(rank).padStart(2, '0')));
  row.appendChild(
    el('span', { className: `dash-qrow__rail dash-qrow__rail--${item.reason.tone}`, 'aria-hidden': 'true' })
  );

  const main = el('div', { className: 'dash-qrow__main' });
  main.appendChild(
    el(
      'div',
      { className: 'dash-qrow__line1' },
      el('span', { className: `dash-qrow__reason dash-qrow__reason--${item.reason.tone}` }, item.reason.label),
      el('span', { className: 'dash-qrow__title' }, item.title)
    )
  );
  main.appendChild(
    el('div', { className: 'dash-qrow__line2' }, buildMetaLine(item.meta))
  );
  row.appendChild(main);

  const href = item.href || (item.kind === 'member' ? `#/worker-tracker?teamId=${teamId}&memberUserId=${item.memberUserId}` : '#/tasks');
  row.appendChild(
    el(
      'a',
      { className: 'dash-qrow__go', href, 'aria-label': 'Open' },
      el('span', { className: 'dash-qrow__go-label' }, item.kind === 'member' ? 'Open in Tracker' : 'Open'),
      el('span', { className: 'dash-qrow__chev', 'aria-hidden': 'true' }, '→')
    )
  );

  return row;
}

function buildMetaLine(parts) {
  const frag = document.createDocumentFragment();
  parts.filter(Boolean).forEach((p, i) => {
    if (i > 0) frag.appendChild(el('span', { className: 'dash-sep', 'aria-hidden': 'true' }, '·'));
    if (p.tone) {
      frag.appendChild(el('span', { className: `dash-meta dash-meta--${p.tone}` }, p.text));
    } else {
      frag.appendChild(el('span', { className: 'dash-meta' }, p.text));
    }
  });
  return frag;
}

/* ---------- Team health ---------- */

function buildTeamHealth(teams, summary, selectedTeamId) {
  const section = el('section', { className: 'dash-teams' });
  section.appendChild(
    el(
      'div',
      { className: 'dash-sec__head' },
      el('h3', { className: 'dash-sec__title' }, 'Team health'),
      el('span', { className: 'dash-sec__hint' }, 'Where to go next.')
    )
  );

  if (!teams.length) {
    section.appendChild(el('div', { className: 'dash-teams__empty' }, 'No teams to show.'));
    return section;
  }

  const list = el('div', { className: 'dash-teams__list' });
  for (const team of teams) {
    // Only the selected team has loaded metrics (cheap: single payload). Others
    // show a quiet placeholder row — keeps backend contract unchanged.
    const metrics = team.id === selectedTeamId ? summary : null;
    list.appendChild(buildTeamHealthRow(team, metrics));
  }
  section.appendChild(list);
  return section;
}

function buildTeamHealthRow(team, summary) {
  const tone = deriveTeamHealthTone(summary);
  const row = el('a', {
    className: `dash-trow dash-trow--${tone}`,
    href: `#/worker-tracker?teamId=${team.id}`,
    'aria-label': `Open ${team.name} in Worker Tracker`
  });

  row.appendChild(el('span', { className: `dash-trow__dot dash-trow__dot--${tone}`, 'aria-hidden': 'true' }));
  row.appendChild(
    el(
      'div',
      { className: 'dash-trow__identity' },
      el('span', { className: 'dash-trow__name' }, team.name),
      el(
        'span',
        { className: 'dash-trow__sub' },
        team.memberCount != null
          ? `${team.memberCount} member${team.memberCount === 1 ? '' : 's'}`
          : 'Team'
      )
    )
  );

  const metrics = el('div', { className: 'dash-trow__metrics' });
  if (summary) {
    metrics.appendChild(tinyMetric('Open', summary.openTaskCount));
    metrics.appendChild(tinyMetric('Overdue', summary.overdueTaskCount, summary.overdueTaskCount > 0 ? 'danger' : null));
    metrics.appendChild(tinyMetric('Blocked', summary.blockedTaskCount, summary.blockedTaskCount > 0 ? 'warning' : null));
  } else {
    metrics.appendChild(el('span', { className: 'dash-trow__hint' }, 'Open in Tracker to load'));
  }
  row.appendChild(metrics);

  if (summary) {
    const pct = Number(summary.completionRate || 0);
    row.appendChild(
      el(
        'div',
        { className: 'dash-trow__completion' },
        el('span', { className: 'dash-trow__bar' }, el('span', {
          className: `dash-trow__barfill dash-trow__barfill--${tone}`,
          style: `width:${Math.max(0, Math.min(100, pct))}%`
        })),
        el('span', { className: 'dash-trow__pct' }, formatPercent(pct, 0))
      )
    );
  } else {
    row.appendChild(el('span', { className: 'dash-trow__completion dash-trow__completion--muted' }, '—'));
  }

  row.appendChild(el('span', { className: 'dash-trow__go', 'aria-hidden': 'true' }, 'Open in Tracker →'));
  return row;
}

function tinyMetric(label, value, tone) {
  const v = Number(value || 0);
  return el(
    'span',
    { className: `dash-tm${tone ? ` dash-tm--${tone}` : ''}` },
    el('span', { className: 'dash-tm__label' }, label),
    el('span', { className: 'dash-tm__value' }, String(v))
  );
}

function deriveTeamHealthTone(summary) {
  if (!summary) return 'neutral';
  const overdue = Number(summary.overdueTaskCount || 0);
  const blocked = Number(summary.blockedTaskCount || 0);
  const unassigned = Number(summary.unassignedTaskCount || 0);
  const pct = Number(summary.completionRate || 0);
  if (overdue > 0 || blocked >= 3) return 'danger';
  if (blocked > 0 || unassigned > 0) return 'warning';
  if (pct >= 80) return 'good';
  return 'calm';
}

/* ---------- Quiet next-step actions ---------- */

function buildQuietActions(teamId) {
  const row = el('nav', { className: 'dash-nav', 'aria-label': 'Navigate' });
  row.appendChild(el('span', { className: 'dash-nav__label' }, 'Go to'));
  row.appendChild(el('a', { className: 'dash-nav__link', href: `#/worker-tracker?teamId=${teamId}` }, 'Worker Tracker'));
  row.appendChild(el('span', { className: 'dash-nav__sep', 'aria-hidden': 'true' }, '·'));
  row.appendChild(el('a', { className: 'dash-nav__link', href: '#/tasks' }, 'Tasks'));
  row.appendChild(el('span', { className: 'dash-nav__sep', 'aria-hidden': 'true' }, '·'));
  row.appendChild(el('a', { className: 'dash-nav__link', href: '#/teams' }, 'Teams'));
  return row;
}

/* ---------- Attention queue: data shaping ----------
 * Produce the mixed attention queue (tasks + worker follow-up) sorted by urgency.
 * Uses ONLY data already returned by the existing endpoints.
 */
function computeAttentionItems({ tasks, upcomingDeadlines, members, teamId }) {
  const seen = new Set();
  const items = [];

  const pushTask = (task) => {
    if (!task?.id || task.status === 'completed' || task.status === 'cancelled') return;
    const key = `task:${task.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const reason = taskReason(task);
    if (!reason) return;
    items.push({
      kind: 'task',
      id: task.id,
      title: task.title,
      reason,
      href: '#/tasks',
      meta: taskMeta(task),
      score: taskScore(task)
    });
  };

  for (const t of tasks || []) pushTask(t);
  for (const t of upcomingDeadlines || []) pushTask(t);

  for (const m of members || []) {
    const signal = memberSignal(m);
    if (!signal) continue;
    items.push({
      kind: 'member',
      id: m.id || m.userId,
      memberUserId: m.id || m.userId,
      title: m.fullName || 'Unnamed employee',
      reason: { label: 'Worker follow-up', tone: signal.tone },
      href: `#/worker-tracker?teamId=${teamId}&memberUserId=${m.id || m.userId}`,
      meta: [
        { text: m.jobTitle || 'Team member' },
        { text: signal.label, tone: signal.tone },
        { text: `${formatNumber(m.openTaskCount || 0)} open` }
      ],
      score: signal.score
    });
  }

  return items.sort((a, b) => b.score - a.score);
}

function taskReason(task) {
  if (task.isOverdue) return { label: 'Overdue', tone: 'danger' };
  if (task.status === 'blocked') return { label: 'Blocked', tone: 'warning' };
  if (!task.assignment?.assigneeFullName) return { label: 'Unassigned', tone: 'info' };
  if (task.isDueSoon) return { label: 'Due soon', tone: 'warning' };
  if (task.priority === 'urgent') return { label: 'Urgent', tone: 'danger' };
  return null;
}

function taskMeta(task) {
  const dueText = task.dueAt
    ? `${formatShortDate(task.dueAt)}${task.timeRemainingSeconds != null ? ` · ${formatTimeRemaining(task.timeRemainingSeconds)}` : ''}`
    : 'No due date';
  return [
    { text: task.assignment?.assigneeFullName || 'Unassigned' },
    { text: dueText, tone: task.isOverdue ? 'danger' : null },
    { text: capitalize(task.priority || 'medium') }
  ];
}

function taskScore(task) {
  const pri = { urgent: 40, high: 28, medium: 16, low: 8 }[task.priority] || 0;
  let s = pri;
  if (task.isOverdue) s += 120;
  else if (task.isDueSoon) s += 72;
  if (task.status === 'blocked') s += 52;
  if (!task.assignment?.assigneeFullName) s += 40;
  return s;
}

function memberSignal(m) {
  const blocked = Number(m.blockedTaskCount || 0);
  const open = Number(m.openTaskCount || 0);
  const completion = Number(m.completionRate || 0);
  const total = Number(m.taskCount || 0);

  if (blocked > 0) return { label: 'Blocked work', tone: 'danger', score: 60 + blocked };
  if (open >= 5) return { label: 'High load', tone: 'warning', score: 45 + Math.min(open, 20) };
  if (total > 0 && completion < 0.5) return { label: 'Needs follow-up', tone: 'info', score: 30 };
  return null; // on track → keep off the queue
}

/* ---------- Misc helpers ---------- */

function currentDateLabel() {
  try {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  } catch (_) {
    return '';
  }
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Working late';
}

function mergeMemberMetrics(members, breakdown) {
  const byId = new Map((breakdown || []).map((m) => [m.userId, m]));
  return (members || []).map((m) => ({ ...m, ...(byId.get(m.id) || {}) }));
}
