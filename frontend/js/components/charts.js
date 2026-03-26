const chartInstances = new Map();

const PALETTE = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b'
];

const STATUS_COLORS = {
  todo: '#94a3b8', in_progress: '#6366f1', blocked: '#f59e0b',
  completed: '#22c55e', cancelled: '#ef4444'
};

const PRIORITY_COLORS = {
  low: '#94a3b8', medium: '#6366f1', high: '#f59e0b', urgent: '#ef4444'
};

export function destroyChart(canvasId) {
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
    chartInstances.delete(canvasId);
  }
}

export function doughnutChart(canvasId, labels, values, colorMap) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const colors = labels.map((l, i) => (colorMap && colorMap[l]) || PALETTE[i % PALETTE.length]);
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => l.replace(/_/g, ' ')),
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } } }
    }
  });
  chartInstances.set(canvasId, chart);
  return chart;
}

export function barChart(canvasId, labels, datasets, horizontal = false) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const ds = datasets.map((d, i) => ({
    label: d.label,
    data: d.data,
    backgroundColor: d.color || PALETTE[i % PALETTE.length],
    borderRadius: 4,
    barThickness: 28
  }));
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: datasets.length > 1, position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
  chartInstances.set(canvasId, chart);
  return chart;
}

export function lineChart(canvasId, labels, datasets) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const ds = datasets.map((d, i) => ({
    label: d.label,
    data: d.data,
    borderColor: d.color || PALETTE[i % PALETTE.length],
    backgroundColor: (d.color || PALETTE[i % PALETTE.length]) + '20',
    fill: true,
    tension: 0.3,
    pointRadius: 3
  }));
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
  chartInstances.set(canvasId, chart);
  return chart;
}

export { STATUS_COLORS, PRIORITY_COLORS, PALETTE };
