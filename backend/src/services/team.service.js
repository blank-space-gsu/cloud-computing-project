import crypto from "node:crypto";
import { env } from "../config/env.js";
import { APP_ROLES, PRIVILEGED_ROLES } from "../constants/roles.js";
import {
  TEAM_ACCESS_TOKEN_TYPES,
  TEAM_MEMBERSHIP_EVENT_TYPES,
  TEAM_MEMBERSHIP_STATUSES
} from "../constants/teamMemberships.js";
import { getPool } from "../db/pool.js";
import {
  createTeamAccessToken,
  createTeamMember,
  createTeamRecord,
  findAccessibleTeamById,
  findTeamAccessTokenByValue,
  findTeamMemberUserById,
  findTeamRecordById,
  insertTeamMembershipEvent,
  listAccessibleTeams,
  listActiveTeamAccessTokens,
  listMembersForAccessibleTeam,
  markTeamMemberLeft,
  markTeamMemberRemoved,
  reactivateTeamMember,
  revokeActiveTeamAccessTokens,
  updateTeamById,
  upsertTeamMember
} from "../repositories/team.repository.js";
import { countOpenActiveAssignmentsForAssigneeInTeam } from "../repositories/task.repository.js";
import { findUserAccessProfileById } from "../repositories/user.repository.js";
import { createAppError } from "../utils/appError.js";
import { createTeamAddedNotification } from "./notification.service.js";

const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;
const isPrivilegedUser = (authUser) => PRIVILEGED_ROLES.includes(authUser.appRole);
const isEmployeeUser = (authUser) => authUser.appRole === APP_ROLES.EMPLOYEE;

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const decorateTeam = (team, authUser) => ({
  ...team,
  canManageTeam:
    isAdminUser(authUser) || team.membershipRole === "manager"
});

const ensurePrivilegedUser = (authUser, code, message) => {
  if (!isPrivilegedUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code,
      message
    });
  }
};

const ensureEmployeeUser = (authUser, code, message) => {
  if (!isEmployeeUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code,
      message
    });
  }
};

const ensureTeamManageable = async (
  authUser,
  teamId,
  { findTeam = findAccessibleTeamById } = {}
) => {
  const team = await findTeam({
    teamId,
    requestingUserId: authUser.id,
    isAdmin: isAdminUser(authUser)
  });

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found or not accessible."
    });
  }

  if (!isAdminUser(authUser) && team.membershipRole !== "manager") {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_MANAGEMENT_FORBIDDEN",
      message: "You do not have permission to manage this team."
    });
  }

  return team;
};

const buildInviteUrl = (inviteToken) => {
  const baseOrigin =
    env.frontendOrigins?.[0]
      ?? env.FRONTEND_APP_ORIGIN.split(",").map((value) => value.trim()).find(Boolean)
      ?? "http://localhost:5500";

  return `${baseOrigin}/#/join?inviteToken=${encodeURIComponent(inviteToken)}`;
};

const generateJoinCode = (length = 8) =>
  Array.from(crypto.randomBytes(length))
    .map((value) => JOIN_CODE_ALPHABET[value % JOIN_CODE_ALPHABET.length])
    .join("");

const generateInviteToken = () => crypto.randomBytes(24).toString("base64url");

const runInTransaction = async (
  work,
  { pool = getPool() } = {}
) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const shapeJoinAccess = (team, tokens) => {
  const joinCodeToken = tokens.find(
    (token) => token.tokenType === TEAM_ACCESS_TOKEN_TYPES.JOIN_CODE
  );
  const inviteLinkToken = tokens.find(
    (token) => token.tokenType === TEAM_ACCESS_TOKEN_TYPES.INVITE_LINK
  );

  return {
    teamId: team.id,
    teamName: team.name,
    joinCode: joinCodeToken?.tokenValue ?? null,
    inviteToken: inviteLinkToken?.tokenValue ?? null,
    inviteUrl: inviteLinkToken
      ? buildInviteUrl(inviteLinkToken.tokenValue)
      : null
  };
};

const createJoinAccessPairInTransaction = async (
  teamId,
  createdByUserId,
  {
    revokeTokens = revokeActiveTeamAccessTokens,
    insertToken = createTeamAccessToken
  },
  client
) => {
  await revokeTokens(
    { teamId },
    { pool: client }
  );

  const joinCodeToken = await insertToken(
    {
      teamId,
      tokenType: TEAM_ACCESS_TOKEN_TYPES.JOIN_CODE,
      tokenValue: generateJoinCode(),
      createdByUserId
    },
    { pool: client }
  );

  const inviteLinkToken = await insertToken(
    {
      teamId,
      tokenType: TEAM_ACCESS_TOKEN_TYPES.INVITE_LINK,
      tokenValue: generateInviteToken(),
      createdByUserId
    },
    { pool: client }
  );

  return [joinCodeToken, inviteLinkToken];
};

const ensureCurrentJoinAccess = async (
  team,
  authUser,
  {
    listTokens = listActiveTeamAccessTokens,
    runTransaction = runInTransaction,
    revokeTokens = revokeActiveTeamAccessTokens,
    insertToken = createTeamAccessToken
  } = {}
) => {
  const currentTokens = await listTokens({
    teamId: team.id
  });

  const hasJoinCode = currentTokens.some(
    (token) => token.tokenType === TEAM_ACCESS_TOKEN_TYPES.JOIN_CODE
  );
  const hasInviteLink = currentTokens.some(
    (token) => token.tokenType === TEAM_ACCESS_TOKEN_TYPES.INVITE_LINK
  );

  if (hasJoinCode && hasInviteLink) {
    return currentTokens;
  }

  return runTransaction(
    (client) =>
      createJoinAccessPairInTransaction(
        team.id,
        authUser.id,
        {
          revokeTokens,
          insertToken
        },
        client
      )
  );
};

const ensureValidJoinAccessToken = (token) => {
  if (!token) {
    throw createAppError({
      statusCode: 400,
      code: "TEAM_JOIN_ACCESS_INVALID",
      message: "Join access is invalid or has expired."
    });
  }

  if (!token.isActive || token.revokedAt) {
    throw createAppError({
      statusCode: 400,
      code: "TEAM_JOIN_ACCESS_REVOKED",
      message: "This join access has been revoked."
    });
  }

  if (token.expiresAt && Date.parse(token.expiresAt) <= Date.now()) {
    throw createAppError({
      statusCode: 400,
      code: "TEAM_JOIN_ACCESS_EXPIRED",
      message: "This join access has expired."
    });
  }
};

const ensureNoOpenAssignments = async (
  teamId,
  userId,
  {
    countOpenAssignments = countOpenActiveAssignmentsForAssigneeInTeam,
    code,
    message
  }
) => {
  const openAssignmentCount = await countOpenAssignments({
    teamId,
    userId
  });

  if (openAssignmentCount > 0) {
    throw createAppError({
      statusCode: 400,
      code,
      message
    });
  }
};

export const listTeamsForUser = async (
  authUser,
  { listTeams = listAccessibleTeams } = {}
) => {
  const teams = await listTeams({
    requestingUserId: authUser.id,
    isAdmin: isAdminUser(authUser)
  });

  return teams.map((team) => decorateTeam(team, authUser));
};

export const getTeamByIdForUser = async (
  authUser,
  teamId,
  { findTeam = findAccessibleTeamById } = {}
) => {
  const team = await findTeam({
    teamId,
    requestingUserId: authUser.id,
    isAdmin: isAdminUser(authUser)
  });

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found or not accessible."
    });
  }

  return decorateTeam(team, authUser);
};

export const listTeamMembersForUser = async (
  authUser,
  teamId,
  {
    findTeam = findAccessibleTeamById,
    listMembers = listMembersForAccessibleTeam
  } = {}
) => {
  const team = await findTeam({
    teamId,
    requestingUserId: authUser.id,
    isAdmin: isAdminUser(authUser)
  });

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found or not accessible."
    });
  }

  return {
    team: decorateTeam(team, authUser),
    members: await listMembers({
      teamId,
      membershipStatus: TEAM_MEMBERSHIP_STATUSES.ACTIVE
    })
  };
};

export const createTeamForUser = async (
  authUser,
  input,
  {
    insertTeam = createTeamRecord,
    addCreatorMembership = upsertTeamMember,
    findTeam = findAccessibleTeamById
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_CREATION_FORBIDDEN",
    "Only managers and admins can create teams."
  );

  const teamId = await insertTeam({
    name: input.name,
    description: input.description
  });

  await addCreatorMembership({
    teamId,
    userId: authUser.id,
    membershipRole: "manager"
  });

  return getTeamByIdForUser(authUser, teamId, { findTeam });
};

export const updateTeamForUser = async (
  authUser,
  teamId,
  patch,
  {
    findTeam = findAccessibleTeamById,
    updateTeam = updateTeamById
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_UPDATE_FORBIDDEN",
    "Only managers and admins can update teams."
  );

  await ensureTeamManageable(authUser, teamId, { findTeam });
  await updateTeam(teamId, patch);

  return getTeamByIdForUser(authUser, teamId, { findTeam });
};

export const getTeamJoinAccessForUser = async (
  authUser,
  teamId,
  {
    findTeam = findAccessibleTeamById,
    listTokens = listActiveTeamAccessTokens,
    runTransaction = runInTransaction,
    revokeTokens = revokeActiveTeamAccessTokens,
    insertToken = createTeamAccessToken
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_JOIN_ACCESS_FORBIDDEN",
    "Only managers and admins can view team join access."
  );

  const team = await ensureTeamManageable(authUser, teamId, { findTeam });
  const tokens = await ensureCurrentJoinAccess(
    team,
    authUser,
    {
      listTokens,
      runTransaction,
      revokeTokens,
      insertToken
    }
  );

  return {
    team: decorateTeam(team, authUser),
    joinAccess: shapeJoinAccess(team, tokens)
  };
};

export const regenerateTeamJoinAccessForUser = async (
  authUser,
  teamId,
  {
    findTeam = findAccessibleTeamById,
    runTransaction = runInTransaction,
    revokeTokens = revokeActiveTeamAccessTokens,
    insertToken = createTeamAccessToken
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_JOIN_ACCESS_FORBIDDEN",
    "Only managers and admins can regenerate team join access."
  );

  const team = await ensureTeamManageable(authUser, teamId, { findTeam });
  const tokens = await runTransaction((client) =>
    createJoinAccessPairInTransaction(
      team.id,
      authUser.id,
      {
        revokeTokens,
        insertToken
      },
      client
    )
  );

  return {
    team: decorateTeam(team, authUser),
    joinAccess: shapeJoinAccess(team, tokens)
  };
};

export const addTeamMemberForUser = async (
  authUser,
  teamId,
  input,
  {
    findTeam = findAccessibleTeamById,
    findMember = findTeamMemberUserById,
    findUser = findUserAccessProfileById,
    insertTeamMember = createTeamMember,
    reactivateMember = reactivateTeamMember,
    recordMembershipEvent = insertTeamMembershipEvent,
    notifyTeamAdded = createTeamAddedNotification,
    runTransaction = runInTransaction
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_MEMBER_ADD_FORBIDDEN",
    "Only managers and admins can add team members."
  );

  await ensureTeamManageable(authUser, teamId, { findTeam });

  if (!isAdminUser(authUser) && input.membershipRole === "manager") {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_MANAGER_MUTATION_FORBIDDEN",
      message: "Only admins can assign manager team memberships."
    });
  }

  const existingMembership = await findMember({
    teamId,
    userId: input.userId
  });

  if (existingMembership?.membershipStatus === TEAM_MEMBERSHIP_STATUSES.ACTIVE) {
    throw createAppError({
      statusCode: 409,
      code: "TEAM_MEMBERSHIP_EXISTS",
      message: "This user is already an active member of the team."
    });
  }

  const user = await findUser(input.userId);

  if (!user || !user.isActive) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  await runTransaction(async (client) => {
    if (existingMembership) {
      await reactivateMember(
        {
          teamId,
          userId: input.userId,
          membershipRole: input.membershipRole
        },
        { pool: client }
      );
    } else {
      await insertTeamMember(
        {
          teamId,
          userId: input.userId,
          membershipRole: input.membershipRole
        },
        { pool: client }
      );
    }

    await recordMembershipEvent(
      {
        teamId,
        userId: input.userId,
        eventType: TEAM_MEMBERSHIP_EVENT_TYPES.ADDED,
        membershipRole: input.membershipRole,
        actedByUserId: authUser.id
      },
      { pool: client }
    );
  });

  const member = await findMember({
    teamId,
    userId: input.userId
  });
  const team = await getTeamByIdForUser(authUser, teamId, { findTeam });

  await notifyTeamAdded({
    userId: input.userId,
    teamId,
    teamName: team.name
  });

  return {
    team,
    member
  };
};

export const removeTeamMemberForUser = async (
  authUser,
  teamId,
  userId,
  {
    findTeam = findAccessibleTeamById,
    findMember = findTeamMemberUserById,
    removeTeamMember = markTeamMemberRemoved,
    recordMembershipEvent = insertTeamMembershipEvent,
    countOpenAssignments = countOpenActiveAssignmentsForAssigneeInTeam,
    runTransaction = runInTransaction
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_MEMBER_REMOVE_FORBIDDEN",
    "Only managers and admins can remove team members."
  );

  const team = await ensureTeamManageable(authUser, teamId, { findTeam });
  const member = await findMember({
    teamId,
    userId
  });

  if (!member || member.membershipStatus !== TEAM_MEMBERSHIP_STATUSES.ACTIVE) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_MEMBER_NOT_FOUND",
      message: "Active team member not found."
    });
  }

  if (member.membershipRole === "manager") {
    if (!isAdminUser(authUser)) {
      throw createAppError({
        statusCode: 403,
        code: "TEAM_MANAGER_MUTATION_FORBIDDEN",
        message: "Only admins can remove manager team memberships."
      });
    }

    if (Number(team.managerCount ?? 0) <= 1) {
      throw createAppError({
        statusCode: 400,
        code: "LAST_TEAM_MANAGER_REQUIRED",
        message: "A team must keep at least one manager."
      });
    }
  }

  await ensureNoOpenAssignments(teamId, userId, {
    countOpenAssignments,
    code: "TEAM_MEMBER_REMOVE_BLOCKED_OPEN_ASSIGNMENTS",
    message:
      "This member still has active open assignments in the team and cannot be removed yet."
  });

  const removedMembership = await runTransaction(async (client) => {
    const removedRecord = await removeTeamMember(
      {
        teamId,
        userId
      },
      { pool: client }
    );

    if (!removedRecord) {
      return null;
    }

    await recordMembershipEvent(
      {
        teamId,
        userId,
        eventType: TEAM_MEMBERSHIP_EVENT_TYPES.REMOVED,
        membershipRole: removedRecord.membershipRole,
        actedByUserId: authUser.id
      },
      { pool: client }
    );

    return removedRecord;
  });

  if (!removedMembership) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_MEMBER_NOT_FOUND",
      message: "Active team member not found."
    });
  }

  return {
    teamId,
    userId,
    membershipRole: removedMembership.membershipRole,
    membershipStatus: removedMembership.membershipStatus
  };
};

export const joinTeamForUser = async (
  authUser,
  input,
  {
    findAccessToken = findTeamAccessTokenByValue,
    findMember = findTeamMemberUserById,
    findTeam = findTeamRecordById,
    insertTeamMember = createTeamMember,
    reactivateMember = reactivateTeamMember,
    recordMembershipEvent = insertTeamMembershipEvent,
    runTransaction = runInTransaction
  } = {}
) => {
  ensureEmployeeUser(
    authUser,
    "TEAM_JOIN_FORBIDDEN",
    "Only employees can join teams through join access."
  );

  const tokenType = input.joinCode
    ? TEAM_ACCESS_TOKEN_TYPES.JOIN_CODE
    : TEAM_ACCESS_TOKEN_TYPES.INVITE_LINK;
  const tokenValue = input.joinCode ?? input.inviteToken;

  const accessToken = await findAccessToken({
    tokenType,
    tokenValue
  });

  ensureValidJoinAccessToken(accessToken);

  const team = await findTeam(accessToken.teamId);

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "The target team no longer exists."
    });
  }

  const existingMembership = await findMember({
    teamId: team.id,
    userId: authUser.id
  });

  if (existingMembership?.membershipStatus === TEAM_MEMBERSHIP_STATUSES.ACTIVE) {
    throw createAppError({
      statusCode: 409,
      code: "TEAM_MEMBERSHIP_EXISTS",
      message: "You are already an active member of this team."
    });
  }

  if (existingMembership?.membershipStatus === TEAM_MEMBERSHIP_STATUSES.REMOVED) {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_REJOIN_FORBIDDEN",
      message:
        "This membership cannot be reactivated through join access. Ask a manager to add you back."
    });
  }

  if (existingMembership?.membershipRole === "manager") {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_REJOIN_FORBIDDEN",
      message:
        "Manager memberships cannot be restored through employee join access."
    });
  }

  const membership = await runTransaction(async (client) => {
    if (existingMembership?.membershipStatus === TEAM_MEMBERSHIP_STATUSES.LEFT) {
      const reactivatedMembership = await reactivateMember(
        {
          teamId: team.id,
          userId: authUser.id,
          membershipRole: "member"
        },
        { pool: client }
      );

      await recordMembershipEvent(
        {
          teamId: team.id,
          userId: authUser.id,
          eventType: TEAM_MEMBERSHIP_EVENT_TYPES.REJOINED,
          membershipRole: reactivatedMembership.membershipRole,
          actedByUserId: authUser.id,
          teamAccessTokenId: accessToken.id
        },
        { pool: client }
      );

      return {
        ...reactivatedMembership,
        rejoined: true
      };
    }

    const createdMembership = await insertTeamMember(
      {
        teamId: team.id,
        userId: authUser.id,
        membershipRole: "member"
      },
      { pool: client }
    );

    await recordMembershipEvent(
      {
        teamId: team.id,
        userId: authUser.id,
        eventType: TEAM_MEMBERSHIP_EVENT_TYPES.JOINED,
        membershipRole: createdMembership.membershipRole,
        actedByUserId: authUser.id,
        teamAccessTokenId: accessToken.id
      },
      { pool: client }
    );

    return {
      ...createdMembership,
      rejoined: false
    };
  });

  return {
    team,
    membership,
    rejoined: membership.rejoined
  };
};

export const leaveTeamForUser = async (
  authUser,
  teamId,
  {
    findMember = findTeamMemberUserById,
    findTeam = findTeamRecordById,
    leaveMember = markTeamMemberLeft,
    recordMembershipEvent = insertTeamMembershipEvent,
    countOpenAssignments = countOpenActiveAssignmentsForAssigneeInTeam,
    runTransaction = runInTransaction
  } = {}
) => {
  ensureEmployeeUser(
    authUser,
    "TEAM_LEAVE_FORBIDDEN",
    "Only employees can leave teams through this action."
  );

  const member = await findMember({
    teamId,
    userId: authUser.id
  });

  if (!member || member.membershipStatus !== TEAM_MEMBERSHIP_STATUSES.ACTIVE) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_MEMBERSHIP_NOT_FOUND",
      message: "Active team membership not found."
    });
  }

  if (member.membershipRole === "manager") {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_LEAVE_FORBIDDEN",
      message: "Manager memberships cannot be left through the employee leave flow."
    });
  }

  await ensureNoOpenAssignments(teamId, authUser.id, {
    countOpenAssignments,
    code: "TEAM_LEAVE_BLOCKED_OPEN_ASSIGNMENTS",
    message:
      "You still have active open assignments in this team and cannot leave it yet."
  });

  const team = await findTeam(teamId);

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found."
    });
  }

  const membership = await runTransaction(async (client) => {
    const leftMembership = await leaveMember(
      {
        teamId,
        userId: authUser.id
      },
      { pool: client }
    );

    if (!leftMembership) {
      return null;
    }

    await recordMembershipEvent(
      {
        teamId,
        userId: authUser.id,
        eventType: TEAM_MEMBERSHIP_EVENT_TYPES.LEFT,
        membershipRole: leftMembership.membershipRole,
        actedByUserId: authUser.id
      },
      { pool: client }
    );

    return leftMembership;
  });

  if (!membership) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_MEMBERSHIP_NOT_FOUND",
      message: "Active team membership not found."
    });
  }

  return {
    team,
    membership
  };
};
