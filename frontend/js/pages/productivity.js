import { el, clearElement } from '../utils/dom.js';
import { isManager, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError } from '../components/toast.js';
import { lineChart, barChart } from '../components/charts.js';
import { formatPercent, formatHours } from '../utils/format.js';

export default async function productivityPage(container) {
  renderHeader('Productivity', isManager() ? 'Team performance metrics' : 'Your performance metrics');
  clearElement(container);

  if (isManager()) {
    await renderManagerProductivity(container);
  } else {
    await renderEmployeeProductivity(container);
  }
}

async function renderEmployeeProductivity(container) {
  showLoading(container);
  try {
    const { data } = await api.get('/productivity-metrics');
    clearElement(container);

    const rollups = data.rollups || {};
    const cards = el('div', { className: 'card-grid' });

    for (const [period, label] of [['weekly', 'This Week'], ['monthly', 'This Month'], ['yearly', 'This Year']]) {
      const r = rollups[period] || {};
      cards.appendChild(rollupCard(label, r));
    }
    container.appendChild(cards);

    const charts = data.charts || {};
    const chartSection = el('div', { className: 'chart-grid' });

    if (charts.weeklyTrend?.length) {
      const c = el('div', { className: 'chart-card' },
        el('h3', {}, 'Weekly Trend'),
        el('div', { className: 'chart-container' }, el('canvas', { id: 'chart-weekly-trend' }))
      );
      chartSection.appendChild(c);
      setTimeout(() => renderTrendChart('chart-weekly-trend', charts.weeklyTrend), 0);
    }

    if (charts.monthlyTrend?.length) {
      const c = el('div', { className: 'chart-card' },
        el('h3', {}, 'Monthly Trend'),
        el('div', { className: 'chart-container' }, el('canvas', { id: 'chart-monthly-trend' }))
      );
      chartSection.appendChild(c);
      setTimeout(() => renderTrendChart('chart-monthly-trend', charts.monthlyTrend), 0);
    }

    container.appendChild(chartSection);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

async function renderManagerProductivity(container) {
  let teams = [];
  try { const r = await api.get('/teams'); teams = r.data.teams || []; } catch {}

  const state = { teamId: teams[0]?.id || '', scope: 'team', userId: '' };

  const filtersBar = el('div', { className: 'filters-bar' });

  if (teams.length) {
    const teamSel = el('select', { className: 'form-select' });
    for (const t of teams) teamSel.appendChild(el('option', { value: t.id }, t.name));
    teamSel.addEventListener('change', () => { state.teamId = teamSel.value; loadData(); });
    filtersBar.appendChild(el('div', { className: 'filter-group' }, el('label', {}, 'Team'), teamSel));
  }

  const scopeSel = el('select', { className: 'form-select' },
    el('option', { value: 'team' }, 'Team Overview'),
    el('option', { value: 'individual' }, 'Individual')
  );
  scopeSel.addEventListener('change', () => {
    state.scope = scopeSel.value;
    memberGroup.style.display = state.scope === 'individual' ? '' : 'none';
    loadData();
  });
  filtersBar.appendChild(el('div', { className: 'filter-group' }, el('label', {}, 'Scope'), scopeSel));

  const memberSel = el('select', { className: 'form-select' });
  const memberGroup = el('div', { className: 'filter-group', style: 'display:none' }, el('label', {}, 'Employee'), memberSel);
  memberSel.addEventListener('change', () => { state.userId = memberSel.value; loadData(); });
  filtersBar.appendChild(memberGroup);

  const dataArea = el('div');
  container.append(filtersBar, dataArea);

  async function loadMembers() {
    if (!state.teamId) return;
    try {
      const { data } = await api.get(`/teams/${state.teamId}/members`);
      const members = (data.members || []).filter(m => m.appRole === 'employee');
      clearElement(memberSel);
      for (const m of members) {
        memberSel.appendChild(el('option', { value: m.id }, m.fullName || `${m.firstName} ${m.lastName}`));
      }
      if (members.length) state.userId = members[0].id;
    } catch {}
  }

  async function loadData() {
    clearElement(dataArea);
    showLoading(dataArea);

    try {
      let url = `/productivity-metrics?scope=${state.scope}`;
      if (state.teamId) url += `&teamId=${state.teamId}`;
      if (state.scope === 'individual' && state.userId) url += `&userId=${state.userId}`;

      const { data } = await api.get(url);
      clearElement(dataArea);

      const rollups = data.rollups || {};
      const cards = el('div', { className: 'card-grid' });
      for (const [period, label] of [['weekly', 'This Week'], ['monthly', 'This Month'], ['yearly', 'This Year']]) {
        const r = rollups[period] || {};
        cards.appendChild(rollupCard(label, r));
      }
      dataArea.appendChild(cards);

      const charts = data.charts || {};
      const chartSection = el('div', { className: 'chart-grid' });

      if (charts.weeklyTrend?.length) {
        const c = el('div', { className: 'chart-card' },
          el('h3', {}, 'Weekly Trend'),
          el('div', { className: 'chart-container' }, el('canvas', { id: 'chart-mgr-weekly' }))
        );
        chartSection.appendChild(c);
        setTimeout(() => renderTrendChart('chart-mgr-weekly', charts.weeklyTrend), 0);
      }

      if (charts.monthlyTrend?.length) {
        const c = el('div', { className: 'chart-card' },
          el('h3', {}, 'Monthly Trend'),
          el('div', { className: 'chart-container' }, el('canvas', { id: 'chart-mgr-monthly' }))
        );
        chartSection.appendChild(c);
        setTimeout(() => renderTrendChart('chart-mgr-monthly', charts.monthlyTrend), 0);
      }

      dataArea.appendChild(chartSection);

      const breakdown = data.breakdown?.members || [];
      if (state.scope === 'team' && breakdown.length) {
        const section = el('div', { className: 'section' },
          el('h3', { className: 'section-title' }, 'Team Member Comparison')
        );

        const labels = breakdown.map(m => m.fullName || m.name || 'Employee');
        const completed = breakdown.map(m => m.completedTasks ?? m.completed ?? 0);
        const hours = breakdown.map(m => m.loggedHours ?? m.hoursLogged ?? 0);

        const c = el('div', { className: 'chart-card' },
          el('h3', {}, 'Completed Tasks & Hours by Member'),
          el('div', { className: 'chart-container', style: 'height:320px' }, el('canvas', { id: 'chart-comparison' }))
        );
        section.appendChild(c);
        setTimeout(() => barChart('chart-comparison', labels, [
          { label: 'Completed Tasks', data: completed, color: '#22c55e' },
          { label: 'Hours Logged', data: hours, color: '#6366f1' }
        ]), 0);

        const table = el('table', {},
          el('thead', {}, el('tr', {},
            el('th', {}, 'Employee'),
            el('th', {}, 'Total Tasks'),
            el('th', {}, 'Completed'),
            el('th', {}, 'Hours Logged'),
            el('th', {}, 'Completion Rate')
          ))
        );
        const tbody = el('tbody');
        for (const m of breakdown) {
          tbody.appendChild(el('tr', {},
            el('td', {}, m.fullName || m.name || '—'),
            el('td', {}, String(m.totalTasks ?? m.total ?? 0)),
            el('td', {}, String(m.completedTasks ?? m.completed ?? 0)),
            el('td', {}, formatHours(m.loggedHours ?? m.hoursLogged)),
            el('td', {}, formatPercent(m.completionRate))
          ));
        }
        table.appendChild(tbody);
        section.appendChild(el('div', { className: 'table-wrapper', style: 'margin-top:16px' }, table));
        dataArea.appendChild(section);
      }
    } catch (err) {
      showError(err);
      hideLoading(dataArea);
    }
  }

  await loadMembers();
  await loadData();
}

function rollupCard(label, r) {
  return el('div', { className: 'card' },
    el('div', { className: 'card-title' }, label),
    el('div', { style: 'display:flex;gap:20px;flex-wrap:wrap;margin-top:6px' },
      miniStat('Tasks', r.totalTasks ?? r.taskCount ?? 0),
      miniStat('Done', r.completedTasks ?? r.completed ?? 0),
      miniStat('Hours', formatHours(r.loggedHours ?? r.hoursLogged)),
      miniStat('Rate', formatPercent(r.completionRate))
    )
  );
}

function miniStat(label, value) {
  return el('div', {},
    el('div', { style: 'font-size:0.72rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.04em' }, label),
    el('div', { style: 'font-size:1.1rem;font-weight:700' }, String(value))
  );
}

function renderTrendChart(canvasId, trend) {
  const labels = trend.map(t => t.label || t.period || t.weekStart || '');
  const completed = trend.map(t => t.completedTasks ?? t.completed ?? 0);
  const hours = trend.map(t => t.loggedHours ?? t.hoursLogged ?? 0);
  lineChart(canvasId, labels, [
    { label: 'Completed Tasks', data: completed, color: '#22c55e' },
    { label: 'Hours Logged', data: hours, color: '#6366f1' }
  ]);
}
