export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

export function formatTimeRemaining(seconds) {
  if (seconds == null) return '';
  if (seconds <= 0) return 'Overdue';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function formatHours(h) {
  if (h == null) return '0h';
  return `${Number(h).toFixed(1)}h`;
}

export function formatPercent(value) {
  if (value == null) return '0%';
  return `${Math.round(value)}%`;
}

export function formatCurrency(value, unit = 'USD') {
  if (value == null) return `0 ${unit}`;
  if (unit === 'USD') return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return `${Number(value).toLocaleString()} ${unit}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

export function statusLabel(status) {
  const map = { todo: 'To Do', in_progress: 'In Progress', blocked: 'Blocked', completed: 'Completed', cancelled: 'Cancelled' };
  return map[status] || capitalize(status);
}

export function priorityLabel(priority) {
  return capitalize(priority);
}

export function mondayDateString(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function todayDateString() {
  return new Date().toISOString().split('T')[0];
}
