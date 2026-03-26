import { el, clearElement } from '../utils/dom.js';
import { isManager, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { doughnutChart } from '../components/charts.js';
import { formatCurrency, formatPercent, formatDate, capitalize } from '../utils/format.js';

export default async function goalsPage(container) {
  renderHeader('Goals & Quotas', isManager() ? 'Team goals and quota tracking' : 'Your goals and quotas');
  clearElement(container);

  let teams = [];
  try { const r = await api.get('/teams'); teams = r.data.teams || []; } catch {}

  const state = { teamId: teams[0]?.id || '', page: 1 };

  const filtersBar = el('div', { className: 'filters-bar' });

  if (isManager() && teams.length) {
    const teamSel = el('select', { className: 'form-select' });
    for (const t of teams) teamSel.appendChild(el('option', { value: t.id }, t.name));
    teamSel.addEventListener('change', () => { state.teamId = teamSel.value; state.page = 1; loadGoals(); });
    filtersBar.appendChild(el('div', { className: 'filter-group' }, el('label', {}, 'Team'), teamSel));
  }

  if (isManager()) {
    const createBtn = el('button', { className: 'btn btn-primary', onClick: () => openCreateGoalModal(state.teamId, teams, loadGoals) }, '+ New Goal');
    filtersBar.appendChild(createBtn);
  }

  const summaryArea = el('div');
  const chartArea = el('div');
  const goalListArea = el('div');

  container.append(filtersBar, summaryArea, chartArea, goalListArea);

  async function loadGoals() {
    clearElement(summaryArea);
    clearElement(chartArea);
    clearElement(goalListArea);
    showLoading(goalListArea);

    try {
      let url = `/goals?sortBy=endDate&sortOrder=asc&page=${state.page}&limit=20`;
      if (state.teamId && isManager()) url += `&teamId=${state.teamId}`;

      const { data } = await api.get(url);
      clearElement(goalListArea);

      const summary = data.summary || {};
      summaryArea.appendChild(buildSummary(summary));

      const charts = data.charts || {};
      const chartSection = el('div', { className: 'chart-grid' });

      if (charts.byStatus?.length) {
        chartSection.appendChild(chartCardEl('Goals by Status', 'chart-goal-status'));
        setTimeout(() => doughnutChart('chart-goal-status',
          charts.byStatus.map(c => c.status || c.label),
          charts.byStatus.map(c => c.count || c.value)
        ), 0);
      }

      if (charts.byPeriod?.length) {
        chartSection.appendChild(chartCardEl('Goals by Period', 'chart-goal-period'));
        setTimeout(() => doughnutChart('chart-goal-period',
          charts.byPeriod.map(c => c.period || c.label),
          charts.byPeriod.map(c => c.count || c.value)
        ), 0);
      }

      if (charts.byScope?.length) {
        chartSection.appendChild(chartCardEl('Goals by Scope', 'chart-goal-scope'));
        setTimeout(() => doughnutChart('chart-goal-scope',
          charts.byScope.map(c => c.scope || c.label),
          charts.byScope.map(c => c.count || c.value)
        ), 0);
      }

      chartArea.appendChild(chartSection);

      const goals = data.goals || [];
      if (!goals.length) {
        goalListArea.appendChild(emptyState('No goals found', 'No goals or quotas have been created yet.'));
        return;
      }

      const list = el('div', { className: 'goal-list' });
      for (const g of goals) {
        list.appendChild(goalCard(g, isManager() ? () => openUpdateGoalModal(g, loadGoals) : null));
      }
      goalListArea.appendChild(list);
    } catch (err) {
      showError(err);
      hideLoading(goalListArea);
    }
  }

  await loadGoals();
}

function buildSummary(summary) {
  const strip = el('div', { className: 'summary-strip' });

  strip.appendChild(summaryItem('Total Goals', String(summary.totalGoals ?? summary.totalCount ?? 0)));

  if (summary.hasMixedUnits && summary.totalsByUnit) {
    for (const unitGroup of summary.totalsByUnit) {
      strip.appendChild(summaryItem(`Target (${unitGroup.unit})`, formatCurrency(unitGroup.totalTargetValue, unitGroup.unit)));
      strip.appendChild(summaryItem(`Actual (${unitGroup.unit})`, formatCurrency(unitGroup.totalActualValue, unitGroup.unit)));
    }
  } else {
    const unit = summary.primaryUnit || 'USD';
    if (summary.totalTargetValue != null) {
      strip.appendChild(summaryItem('Total Target', formatCurrency(summary.totalTargetValue, unit)));
    }
    if (summary.totalActualValue != null) {
      strip.appendChild(summaryItem('Total Actual', formatCurrency(summary.totalActualValue, unit)));
    }
  }

  return strip;
}

function goalCard(goal, onEdit) {
  const pct = goal.progressPercent ?? 0;
  const isMet = goal.isTargetMet;
  const unit = goal.unit || 'USD';

  const header = el('div', { className: 'goal-card-header' },
    el('h3', {}, goal.title),
    el('div', { className: 'task-badges' },
      el('span', { className: `badge badge-${goal.status === 'active' ? 'success' : 'default'}` }, capitalize(goal.status)),
      el('span', { className: `badge badge-${goal.scope === 'team' ? 'primary' : 'info'}` }, capitalize(goal.scope)),
      isMet ? el('span', { className: 'badge badge-success' }, 'Target Met') : null
    )
  );

  const values = el('div', { className: 'goal-values' },
    el('span', {}, `Target: ${formatCurrency(goal.targetValue, unit)}`),
    el('span', {}, `Actual: ${formatCurrency(goal.actualValue, unit)}`),
    goal.remainingValue > 0 ? el('span', {}, `Remaining: ${formatCurrency(goal.remainingValue, unit)}`) : null
  );

  const bar = el('div', { className: 'goal-progress-bar' },
    el('div', { className: `goal-progress-fill ${isMet ? 'met' : 'on-track'}`, style: `width:${Math.min(pct, 100)}%` })
  );

  const meta = el('div', { className: 'goal-meta' },
    el('span', {}, `${formatPercent(pct)} complete`),
    el('span', {}, `${capitalize(goal.period || '')}`),
    el('span', {}, `${formatDate(goal.startDate)} → ${formatDate(goal.endDate)}`),
    goal.targetUser ? el('span', {}, `👤 ${goal.targetUser.fullName}`) : el('span', {}, '👥 Team goal')
  );

  const card = el('div', { className: 'goal-card' }, header, values, bar, meta);

  if (onEdit) {
    const editBtn = el('button', { className: 'btn btn-sm btn-outline', style: 'margin-top:8px', onClick: () => onEdit(goal) }, 'Edit');
    card.appendChild(editBtn);
  }

  return card;
}

function openCreateGoalModal(teamId, teams, reload) {
  const form = el('form', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', name: 'title', required: true, placeholder: 'e.g. March sales quota' })
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Description'),
      el('textarea', { className: 'form-textarea', name: 'description', placeholder: 'Optional details' })
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Scope'),
        el('select', { className: 'form-select', name: 'scope', id: 'goal-scope' },
          el('option', { value: 'user' }, 'Individual (User)'),
          el('option', { value: 'team' }, 'Team')
        )
      ),
      el('div', { className: 'form-group', id: 'target-user-group' },
        el('label', { className: 'form-label' }, 'Target Employee'),
        el('select', { className: 'form-select', name: 'targetUserId', id: 'target-user-sel' })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Period'),
        el('select', { className: 'form-select', name: 'period' },
          ...['monthly', 'weekly', 'quarterly', 'yearly'].map(p => el('option', { value: p }, capitalize(p)))
        )
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Unit'),
        el('input', { className: 'form-input', name: 'unit', value: 'USD', placeholder: 'USD, deals, etc.' })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Target Value'),
        el('input', { className: 'form-input', name: 'targetValue', type: 'number', min: '1', step: '0.01', required: true })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Starting Actual'),
        el('input', { className: 'form-input', name: 'actualValue', type: 'number', min: '0', step: '0.01', value: '0' })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Start Date'),
        el('input', { className: 'form-input', name: 'startDate', type: 'date', required: true })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'End Date'),
        el('input', { className: 'form-input', name: 'endDate', type: 'date', required: true })
      )
    )
  );

  const scopeSel = form.querySelector('#goal-scope');
  const targetGroup = form.querySelector('#target-user-group');
  scopeSel.addEventListener('change', () => {
    targetGroup.style.display = scopeSel.value === 'user' ? '' : 'none';
  });

  (async () => {
    if (teamId) {
      try {
        const { data } = await api.get(`/teams/${teamId}/members`);
        const members = (data.members || []).filter(m => m.appRole === 'employee');
        const sel = form.querySelector('#target-user-sel');
        for (const m of members) sel.appendChild(el('option', { value: m.id }, m.fullName || `${m.firstName} ${m.lastName}`));
      } catch {}
    }
  })();

  const saveBtn = el('button', { className: 'btn btn-primary' }, 'Create Goal');
  saveBtn.addEventListener('click', async () => {
    const title = form.querySelector('[name="title"]').value.trim();
    if (!title) { showError('Title is required.'); return; }
    saveBtn.disabled = true;

    const scope = form.querySelector('[name="scope"]').value;
    const body = {
      teamId,
      title,
      description: form.querySelector('[name="description"]').value || undefined,
      goalType: 'sales_quota',
      scope,
      period: form.querySelector('[name="period"]').value,
      startDate: form.querySelector('[name="startDate"]').value,
      endDate: form.querySelector('[name="endDate"]').value,
      targetValue: parseFloat(form.querySelector('[name="targetValue"]').value),
      actualValue: parseFloat(form.querySelector('[name="actualValue"]').value) || 0,
      unit: form.querySelector('[name="unit"]').value.trim() || 'USD'
    };
    if (scope === 'user') body.targetUserId = form.querySelector('[name="targetUserId"]').value;

    try {
      await api.post('/goals', body);
      showSuccess('Goal created!');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal('Create Goal', form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'), saveBtn));
}

function openUpdateGoalModal(goal, reload) {
  const form = el('form', {},
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', name: 'title', value: goal.title })
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Target Value'),
        el('input', { className: 'form-input', name: 'targetValue', type: 'number', min: '1', step: '0.01', value: String(goal.targetValue ?? '') })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Actual Value'),
        el('input', { className: 'form-input', name: 'actualValue', type: 'number', min: '0', step: '0.01', value: String(goal.actualValue ?? 0) })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Status'),
        el('select', { className: 'form-select', name: 'status' },
          el('option', { value: 'active', selected: goal.status === 'active' }, 'Active'),
          el('option', { value: 'cancelled', selected: goal.status === 'cancelled' }, 'Cancelled')
        )
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'End Date'),
        el('input', { className: 'form-input', name: 'endDate', type: 'date', value: goal.endDate ? goal.endDate.split('T')[0] : '' })
      )
    )
  );

  const saveBtn = el('button', { className: 'btn btn-primary' }, 'Save Changes');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const body = {
      title: form.querySelector('[name="title"]').value.trim() || undefined,
      targetValue: parseFloat(form.querySelector('[name="targetValue"]').value) || undefined,
      actualValue: parseFloat(form.querySelector('[name="actualValue"]').value),
      status: form.querySelector('[name="status"]').value,
      endDate: form.querySelector('[name="endDate"]').value || undefined
    };
    try {
      await api.patch(`/goals/${goal.id}`, body);
      showSuccess('Goal updated!');
      closeModal();
      await reload();
    } catch (err) {
      showError(err);
      saveBtn.disabled = false;
    }
  });

  openModal(`Edit: ${goal.title}`, form, el('div', { className: 'btn-group' },
    el('button', { className: 'btn btn-outline', onClick: closeModal }, 'Cancel'), saveBtn));
}

function chartCardEl(title, canvasId) {
  return el('div', { className: 'chart-card' },
    el('h3', {}, title),
    el('div', { className: 'chart-container' }, el('canvas', { id: canvasId }))
  );
}

function summaryItem(label, value) {
  return el('div', { className: 'summary-item' },
    el('span', { className: 'label' }, label),
    el('span', { className: 'value' }, value)
  );
}
