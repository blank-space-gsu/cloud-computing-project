export const GOAL_TYPES = {
  SALES_QUOTA: "sales_quota"
};

export const GOAL_TYPE_VALUES = Object.values(GOAL_TYPES);

export const GOAL_SCOPES = {
  USER: "user",
  TEAM: "team"
};

export const GOAL_SCOPE_VALUES = Object.values(GOAL_SCOPES);

export const GOAL_PERIODS = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  YEARLY: "yearly"
};

export const GOAL_PERIOD_VALUES = Object.values(GOAL_PERIODS);

export const GOAL_STATUSES = {
  ACTIVE: "active",
  CANCELLED: "cancelled"
};

export const GOAL_STATUS_VALUES = Object.values(GOAL_STATUSES);

export const GOAL_SORT_FIELDS = {
  END_DATE: "endDate",
  CREATED_AT: "createdAt",
  PROGRESS_PERCENT: "progressPercent",
  TARGET_VALUE: "targetValue",
  TITLE: "title"
};

export const GOAL_SORT_FIELD_VALUES = Object.values(GOAL_SORT_FIELDS);

export const GOAL_DEFAULT_PAGE = 1;
export const GOAL_DEFAULT_LIMIT = 50;
export const GOAL_MAX_LIMIT = 100;
