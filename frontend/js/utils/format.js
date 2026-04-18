export function formatDate(iso, options = {}) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  });
}

export function formatShortDate(iso) {
  return formatDate(iso, { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatDateRange(startIso, endIso) {
  if (!startIso && !endIso) return '—';
  if (!startIso) return `Until ${formatShortDate(endIso)}`;
  if (!endIso) return `From ${formatShortDate(startIso)}`;
  return `${formatShortDate(startIso)} - ${formatShortDate(endIso)}`;
}

export function formatTrendLabel(startIso, endIso) {
  if (!startIso) return '—';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;

  if (Number.isNaN(start.getTime())) return '—';
  if (!end || Number.isNaN(end.getTime())) return formatShortDate(startIso);

  // Use a compact x-axis label and keep the full range for tooltips.
  if (start.getMonth() === end.getMonth()) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function formatTrendTooltip(startIso, endIso) {
  if (!startIso) return '—';
  if (!endIso) return formatShortDate(startIso);
  return `${formatShortDate(startIso)} - ${formatShortDate(endIso)}`;
}

export function formatTimeRemaining(seconds) {
  if (seconds == null) return '';

  const totalSeconds = Number(seconds);
  if (totalSeconds <= 0) {
    const overdueSeconds = Math.abs(totalSeconds);
    const days = Math.floor(overdueSeconds / 86400);
    const hours = Math.floor((overdueSeconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h overdue`;
    const mins = Math.floor((overdueSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m overdue`;
    return `${Math.max(mins, 1)}m overdue`;
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${Math.max(mins, 1)}m left`;
}

export function formatHours(hours, digits = 1) {
  if (hours == null || Number.isNaN(Number(hours))) return '0h';
  const value = Number(hours);
  const text = Number.isInteger(value) && digits > 0 ? value.toFixed(0) : value.toFixed(digits);
  return `${text}h`;
}

export function formatPercent(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '0%';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

export function formatCurrency(value, unit = 'USD') {
  if (value == null || Number.isNaN(Number(value))) {
    return unit === 'USD' ? '$0' : `0 ${unit}`;
  }

  const numericValue = Number(value);
  if (String(unit).toUpperCase() === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(numericValue);
  }

  return `${formatNumber(numericValue)} ${unit}`;
}

export function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value ?? 0));
}

export function capitalize(str) {
  if (!str) return '';
  return str
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusLabel(status) {
  const map = {
    todo: 'To Do',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    completed: 'Completed',
    cancelled: 'Cancelled',
    active: 'Active'
  };
  return map[status] || capitalize(status);
}

export function priorityLabel(priority) {
  return capitalize(priority);
}

function formatLocalDateParts(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mondayDateString(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return formatLocalDateParts(monday);
}

export function todayDateString() {
  return formatLocalDateParts(new Date());
}

export function firstDayOfCurrentMonth(date = new Date()) {
  const value = new Date(date);
  return formatLocalDateParts(new Date(value.getFullYear(), value.getMonth(), 1));
}

export function lastDayOfCurrentMonth(date = new Date()) {
  const value = new Date(date);
  return formatLocalDateParts(new Date(value.getFullYear(), value.getMonth() + 1, 0));
}
