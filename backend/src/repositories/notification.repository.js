import { randomUUID } from "node:crypto";
import { getPool } from "../db/pool.js";

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const mapNotification = (row) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  taskId: row.task_id,
  teamId: row.team_id,
  createdAt: normalizeTimestamp(row.created_at),
  readAt: normalizeTimestamp(row.read_at),
  dismissedAt: normalizeTimestamp(row.dismissed_at)
});

export const createNotification = async (
  notification,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.notifications (
        id,
        user_id,
        type,
        title,
        message,
        task_id,
        team_id,
        dedupe_key,
        read_at,
        dismissed_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict do nothing
      returning
        id,
        user_id,
        type,
        title,
        message,
        task_id,
        team_id,
        created_at,
        read_at,
        dismissed_at
    `,
    [
      notification.id ?? randomUUID(),
      notification.userId,
      notification.type,
      notification.title,
      notification.message,
      notification.taskId ?? null,
      notification.teamId ?? null,
      notification.dedupeKey ?? null,
      notification.readAt ?? null,
      notification.dismissedAt ?? null
    ]
  );

  return result.rows[0] ? mapNotification(result.rows[0]) : null;
};

export const listNotificationsForUser = async (
  { userId, includeDismissed = true, page = 1, limit = 50 },
  { pool = getPool() } = {}
) => {
  const values = [userId];
  const whereClauses = ["user_id = $1"];

  if (!includeDismissed) {
    whereClauses.push("dismissed_at is null");
  }

  const whereSql = `where ${whereClauses.join(" and ")}`;
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `
      select count(*) as total
      from public.notifications
      ${whereSql}
    `,
    values
  );

  const unreadResult = await pool.query(
    `
      select count(*) as unread_count
      from public.notifications
      where user_id = $1
        and dismissed_at is null
        and read_at is null
    `,
    [userId]
  );

  const listValues = [...values, limit, offset];
  const listResult = await pool.query(
    `
      select
        id,
        user_id,
        type,
        title,
        message,
        task_id,
        team_id,
        created_at,
        read_at,
        dismissed_at
      from public.notifications
      ${whereSql}
      order by created_at desc
      limit $${listValues.length - 1}
      offset $${listValues.length}
    `,
    listValues
  );

  return {
    notifications: listResult.rows.map(mapNotification),
    total: Number(countResult.rows[0]?.total ?? 0),
    unreadCount: Number(unreadResult.rows[0]?.unread_count ?? 0)
  };
};

export const markNotificationReadById = async (
  { notificationId, userId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      update public.notifications
      set
        read_at = coalesce(read_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
      where id = $1
        and user_id = $2
      returning
        id,
        user_id,
        type,
        title,
        message,
        task_id,
        team_id,
        created_at,
        read_at,
        dismissed_at
    `,
    [notificationId, userId]
  );

  return result.rows[0] ? mapNotification(result.rows[0]) : null;
};

export const dismissNotificationById = async (
  { notificationId, userId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      update public.notifications
      set
        dismissed_at = coalesce(dismissed_at, timezone('utc', now())),
        read_at = coalesce(read_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
      where id = $1
        and user_id = $2
      returning
        id,
        user_id,
        type,
        title,
        message,
        task_id,
        team_id,
        created_at,
        read_at,
        dismissed_at
    `,
    [notificationId, userId]
  );

  return result.rows[0] ? mapNotification(result.rows[0]) : null;
};
