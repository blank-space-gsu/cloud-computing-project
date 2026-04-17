export const TEAM_MEMBERSHIP_STATUSES = {
  ACTIVE: "active",
  LEFT: "left",
  REMOVED: "removed"
};

export const TEAM_MEMBERSHIP_ROLES = {
  MEMBER: "member",
  MANAGER: "manager"
};

export const TEAM_MEMBERSHIP_STATUS_VALUES = Object.values(
  TEAM_MEMBERSHIP_STATUSES
);

export const TEAM_MEMBERSHIP_EVENT_TYPES = {
  ADDED: "added",
  JOINED: "joined",
  LEFT: "left",
  REJOINED: "rejoined",
  REMOVED: "removed"
};

export const TEAM_MEMBERSHIP_EVENT_TYPE_VALUES = Object.values(
  TEAM_MEMBERSHIP_EVENT_TYPES
);

export const TEAM_ACCESS_TOKEN_TYPES = {
  JOIN_CODE: "join_code",
  INVITE_LINK: "invite_link"
};

export const TEAM_ACCESS_TOKEN_TYPE_VALUES = Object.values(
  TEAM_ACCESS_TOKEN_TYPES
);

export const TEAM_ACCESS_GRANTED_MEMBERSHIP_ROLE_VALUES = Object.values(
  TEAM_MEMBERSHIP_ROLES
);
