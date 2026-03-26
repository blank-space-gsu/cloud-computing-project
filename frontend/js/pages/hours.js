import { el, clearElement } from '../utils/dom.js';
import { isManager, getUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { emptyState } from '../components/emptyState.js';
import { showError, showSuccess } from '../components/toast.js';
import { barChart } from '../components/charts.js';
import { formatDate, formatHours, todayDateString } from '../utils/format.js';

export default async function hoursPage(container) {
  renderHeader('Hours Logged', isManager() ? 'Team time tracking' : 'Your work hours');
  clearElement(container);

  let teams = [];
  try { const r = await api.get('/teams'); teams = r.data.teams || []; } catch {}

  const state = { teamId: teams[0]?.id || '', dateFrom: '', dateTo: '', page: 1 };

  const wrapper = el('div');
  container.appendChild(wrapper);

  if (!isManager()) {
    const formSection = buildLogForm(teams, async () => { await loadHours(); });
    container.insertBefore(formSection, wrapper);
  }

  const filtersBar = el('div', { className: 'filters-bar' });

  if (isManager() && teams.length) {
    const teamSel = el('select', { className: 'form-select' });
    for (const t of teams) teamSel.appendChild(el('option', { value: t.id }, t.name));
    teamSel.addEventListener('change', () => { state.teamId = teamSel.value; state.page = 1; loadHours(); });
    filtersBar.appendChild(el('div', { className: 'filter-group' }, el('label', {}, 'Team'), teamSel));
  }

  const fromInput = el('input', { className: 'form-input', type: 'date' });
  const toInput = el('input', { className: 'form-input', type: 'date' });
  fromInput.addEventListener('change', () => { state.dateFrom = fromInput.value; state.page = 1; loadHours(); });
  toInput.addEventListener('change', () => { state.dateTo = toInput.value; state.page = 1; loadHours(); });

  filtersBar.append(
    el('div', { className: 'filter-group' }, el('label', {}, 'From'), fromInput),
    el('div', { className: 'filter-group' }, el('label', {}, 'To'), toInput)
  );

  wrapper.append(filtersBar);

  const summaryArea = el('div');
  const chartArea = el('div');
  const tableArea = el('div');
  wrapper.append(summaryArea, chartArea, tableArea);

  async function loadHours() {
    clearElement(summaryArea);
    clearElement(chartArea);
    clearElement(tableArea);
    showLoading(tableArea);

    try {
      let url = `/hours-logged?sortBy=workDate&sortOrder=desc&page=${state.page}&limit=20`;
      if (state.teamId && isManager()) url += `&teamId=${state.teamId}`;
      if (state.dateFrom) url += `&dateFrom=${state.dateFrom}`;
      if (state.dateTo) url += `&dateTo=${state.dateTo}`;

      const { data } = await api.get(url);
      clearElement(tableArea);

      const s = data.summary || {};
      summaryArea.appendChild(el('div', { className: 'summary-strip' },
        summaryItem('Total Hours', formatHours(s.totalHours)),
        summaryItem('This Week', formatHours(s.currentWeekHours)),
        summaryItem('This Month', formatHours(s.currentMonthHours))
      ));

      const byDate = data.charts?.byDate || [];
      if (byDate.length) {
        const c = el('div', { className: 'chart-card', style: 'margin-bottom:20px' },
          el('h3', {}, 'Daily Hours'),
          el('div', { className: 'chart-container' }, el('canvas', { id: 'chart-hours-daily' }))
        );
        chartArea.appendChild(c);
        setTimeout(() => barChart('chart-hours-daily',
          byDate.map(d => d.date || d.workDate),
          [{ label: 'Hours', data: byDate.map(d => d.totalHours ?? d.hours), color: '#6366f1' }]
        ), 0);
      }

      const logs = data.hoursLogs || [];
      if (!logs.length) {
        tableArea.appendChild(emptyState('No hours logged', 'No time entries found for the selected range.'));
        return;
      }

      const table = el('table', {},
        el('thead', {},
          el('tr', {},
            el('th', {}, 'Date'),
            el('th', {}, 'Hours'),
            el('th', {}, 'Task'),
            el('th', {}, 'Note'),
            isManager() ? el('th', {}, 'Employee') : null
          )
        )
      );
      const tbody = el('tbody');
      for (const log of logs) {
        tbody.appendChild(el('tr', {},
          el('td', {}, formatDate(log.workDate)),
          el('td', {}, formatHours(log.hours)),
          el('td', {}, log.taskTitle || log.task?.title || '—'),
          el('td', {}, log.note || '—'),
          isManager() ? el('td', {}, log.userFullName || log.user?.fullName || '—') : null
        ));
      }
      table.appendChild(tbody);
      tableArea.appendChild(el('div', { className: 'table-wrapper' }, table));
    } catch (err) {
      showError(err);
      hideLoading(tableArea);
    }
  }

  await loadHours();
}

function buildLogForm(teams, onSuccess) {
  const section = el('div', { className: 'card', style: 'margin-bottom:24px' });
  section.appendChild(el('h3', { className: 'section-title' }, '🕐 Log Hours'));

  const form = el('form', {},
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Team'),
        (() => {
          const s = el('select', { className: 'form-select', name: 'teamId' });
          for (const t of teams) s.appendChild(el('option', { value: t.id }, t.name));
          return s;
        })()
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Date'),
        el('input', { className: 'form-input', name: 'workDate', type: 'date', value: todayDateString() })
      )
    ),
    el('div', { className: 'form-row' },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Hours'),
        el('input', { className: 'form-input', name: 'hours', type: 'number', min: '0.25', max: '24', step: '0.25', placeholder: '0', required: true })
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label' }, 'Note'),
        el('input', { className: 'form-input', name: 'note', placeholder: 'What did you work on?' })
      )
    )
  );

  const submitBtn = el('button', { className: 'btn btn-primary', type: 'submit', style: 'margin-top:8px' }, 'Log Hours');
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    try {
      const body = {
        teamId: form.querySelector('[name="teamId"]').value,
        workDate: form.querySelector('[name="workDate"]').value,
        hours: parseFloat(form.querySelector('[name="hours"]').value),
        note: form.querySelector('[name="note"]').value || undefined
      };
      await api.post('/hours-logged', body);
      showSuccess('Hours logged!');
      form.querySelector('[name="hours"]').value = '';
      form.querySelector('[name="note"]').value = '';
      await onSuccess();
    } catch (err) {
      showError(err);
    }
    submitBtn.disabled = false;
  });

  section.appendChild(form);
  return section;
}

function summaryItem(label, value) {
  return el('div', { className: 'summary-item' },
    el('span', { className: 'label' }, label),
    el('span', { className: 'value' }, value)
  );
}
