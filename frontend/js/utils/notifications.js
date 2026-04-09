import * as api from '../api.js';
import { getUser, isManager } from '../auth.js';
import { getVisibleTeams, selectPreferredTeam } from './teams.js';
import { getTeamEventsForUser } from './localTeams.js';

const STORAGE_KEY = 'taskflow-notification-state-v1';
const DUE_SOON_SECONDS = 2 * 24 * 60 * 60;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getUserBucket(userId) {
  const state = readState();
  return state[userId] || [];
}

function saveUserBucket(userId, items) {
  const state = readState();
  state[userId] = items;
  writeState(state);
}

async function loadDueTaskNotifications(user) {
  try {
    let url = '/tasks?sortBy=urgency&sortOrder=asc&includeCompleted=false&page=1&limit=20';

    if (isManager()) {
      const { data } = await api.get('/teams');
      const teams = getVisibleTeams((data.teams || []).filter((team) => team.canManageTeam));
      const team = selectPreferredTeam(teams);
      if (team?.id) {
        url += `&teamId=${team.id}`;
      }
    }

    const { data } = await api.get(url);
    const tasks = data.tasks || [];

    return tasks
      .filter((task) => {
        const seconds = Number(task.timeRemainingSeconds);
        return !Number.isNaN(seconds) && seconds <= DUE_SOON_SECONDS && task.status !== 'completed' && task.status !== 'cancelled';
      })
      .map((task) => ({
        id: `task-due:${task.id}`,
        type: 'task_due',
        title: task.isOverdue ? `Overdue task: ${task.title}` : `Task due soon: ${task.title}`,
        body: task.isOverdue
          ? 'This task is overdue and still needs attention.'
          : 'This task is within two days of its due date.',
        createdAt: task.dueAt || new Date().toISOString(),
        link: '#/tasks',
        meta: {
          taskId: task.id,
          dueAt: task.dueAt || '',
          timeRemainingSeconds: task.timeRemainingSeconds,
          assignee: task.assignment?.assigneeFullName || '',
          teamName: task.teamName || ''
        }
      }));
  } catch {
    return [];
  }
}

function buildTeamNotifications(userId) {
  return getTeamEventsForUser(userId).map((event) => ({
    id: `team-event:${event.id}`,
    type: event.type,
    title: event.teamName ? `Team update: ${event.teamName}` : 'Team update',
    body: event.message,
    createdAt: event.createdAt,
    link: '#/teams',
    meta: {
      teamId: event.teamId,
      teamName: event.teamName || ''
    }
  }));
}

function mergeNotifications(existing, generated) {
  const byId = new Map(existing.map((item) => [item.id, item]));

  generated.forEach((item) => {
    const previous = byId.get(item.id);
    byId.set(item.id, {
      ...item,
      readAt: previous?.readAt || null,
      dismissedAt: previous?.dismissedAt || null
    });
  });

  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function syncNotifications() {
  const user = getUser();
  if (!user) {
    return { active: [], past: [], all: [] };
  }

  const existing = getUserBucket(user.id);
  const dueTasks = await loadDueTaskNotifications(user);
  const teamEvents = buildTeamNotifications(user.id);
  const all = mergeNotifications(existing, [...dueTasks, ...teamEvents]);
  saveUserBucket(user.id, all);

  return {
    active: all.filter((item) => !item.dismissedAt),
    past: all.filter((item) => item.readAt || item.dismissedAt),
    all
  };
}

export function markNotificationRead(notificationId) {
  const user = getUser();
  if (!user) return;

  const bucket = getUserBucket(user.id).map((item) => (
    item.id === notificationId && !item.readAt
      ? { ...item, readAt: new Date().toISOString() }
      : item
  ));
  saveUserBucket(user.id, bucket);
}

export function dismissNotification(notificationId) {
  const user = getUser();
  if (!user) return;

  const bucket = getUserBucket(user.id).map((item) => (
    item.id === notificationId
      ? { ...item, dismissedAt: new Date().toISOString(), readAt: item.readAt || new Date().toISOString() }
      : item
  ));
  saveUserBucket(user.id, bucket);
}
