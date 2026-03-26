export const TASK_STATUSES = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  BLOCKED: "blocked",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

export const TASK_STATUS_VALUES = Object.values(TASK_STATUSES);

export const TASK_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent"
};

export const TASK_PRIORITY_VALUES = Object.values(TASK_PRIORITIES);

export const TASK_SORT_FIELDS = {
  URGENCY: "urgency",
  DUE_AT: "dueAt",
  PRIORITY: "priority",
  CREATED_AT: "createdAt",
  WEEK_START_DATE: "weekStartDate"
};

export const TASK_SORT_FIELD_VALUES = Object.values(TASK_SORT_FIELDS);

export const TASK_DEFAULT_PAGE = 1;
export const TASK_DEFAULT_LIMIT = 50;
export const TASK_MAX_LIMIT = 100;
