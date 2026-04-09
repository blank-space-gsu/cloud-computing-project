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

function categoryScaleOptions({ horizontal = false, maxTicksLimit = 6 } = {}) {
  return {
    ticks: horizontal
      ? {
          color: '#64748b',
          font: { size: 11 }
        }
      : {
          color: '#64748b',
          font: { size: 11 },
          autoSkip: true,
          maxTicksLimit,
          maxRotation: 0,
          minRotation: 0,
          padding: 8
        },
    grid: {
      display: false,
      drawBorder: false
    }
  };
}

function valueScaleOptions() {
  return {
    beginAtZero: true,
    ticks: {
      color: '#64748b',
      precision: 0
    },
    grid: {
      color: 'rgba(148, 163, 184, 0.16)',
      drawBorder: false
    }
  };
}

function buildTooltipOptions(tooltipTitles = []) {
  return {
    callbacks: {
      title(items) {
        const index = items?.[0]?.dataIndex ?? 0;
        return tooltipTitles[index] || items?.[0]?.label || '';
      }
    }
  };
}

export function barChart(canvasId, labels, datasets, horizontal = false, options = {}) {
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
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, boxWidth: 12 }
        },
        tooltip: buildTooltipOptions(options.tooltipTitles)
      },
      scales: horizontal
        ? {
            x: valueScaleOptions(),
            y: categoryScaleOptions({ horizontal: true, maxTicksLimit: options.maxTicksLimit })
          }
        : {
            x: categoryScaleOptions({ maxTicksLimit: options.maxTicksLimit }),
            y: valueScaleOptions()
          }
    }
  });
  chartInstances.set(canvasId, chart);
  return chart;
}

export function lineChart(canvasId, labels, datasets, options = {}) {
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
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, boxWidth: 12 }
        },
        tooltip: buildTooltipOptions(options.tooltipTitles)
      },
      scales: {
        x: categoryScaleOptions({ maxTicksLimit: options.maxTicksLimit }),
        y: valueScaleOptions()
      }
    }
  });
  chartInstances.set(canvasId, chart);
  return chart;
}

export { STATUS_COLORS, PRIORITY_COLORS, PALETTE };
