import { APP_ROLES, PRIVILEGED_ROLES } from "../constants/roles.js";
import { getServiceRoleSupabaseClient } from "../config/supabase.js";
import {
  createTeamMember,
  findAccessibleTeamById
} from "../repositories/team.repository.js";
import {
  findUserAccessProfileById,
  listUsersForDirectory as loadUsersForDirectory,
  updateUserProfileById,
  upsertUserProfile
} from "../repositories/user.repository.js";
import { createAppError } from "../utils/appError.js";
import { listTeamsForUser } from "./team.service.js";

const SELF_EDITABLE_FIELDS = new Set([
  "firstName",
  "lastName",
  "jobTitle",
  "dateOfBirth",
  "address"
]);

const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;
const isPrivilegedUser = (authUser) => PRIVILEGED_ROLES.includes(authUser.appRole);

const ensurePrivilegedUser = (authUser, code, message) => {
  if (!isPrivilegedUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code,
      message
    });
  }
};

const buildSupabaseUserMetadata = (input) => ({
  first_name: input.firstName,
  last_name: input.lastName,
  job_title: input.jobTitle ?? null
});

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

const ensureUserVisibleToManager = async (
  authUser,
  targetUser,
  { listTeams = listTeamsForUser } = {}
) => {
  if (isAdminUser(authUser)) {
    return targetUser;
  }

  const manageableTeams = (await listTeams(authUser))
    .filter((team) => team.canManageTeam)
    .map((team) => team.id);
  const manageableTeamIds = new Set(manageableTeams);
  const sharesManageableTeam = (targetUser.teams ?? []).some((team) =>
    manageableTeamIds.has(team.teamId)
  );

  if (!sharesManageableTeam) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  return targetUser;
};

const sanitizeSelfProfilePatch = (patch) => {
  const sanitized = {};
  const rejectedFields = [];

  for (const [field, value] of Object.entries(patch)) {
    if (!SELF_EDITABLE_FIELDS.has(field)) {
      rejectedFields.push(field);
      continue;
    }

    sanitized[field] = value;
  }

  if (rejectedFields.length > 0) {
    throw createAppError({
      statusCode: 403,
      code: "PROFILE_UPDATE_FORBIDDEN",
      message: "Only supported self-profile fields can be updated.",
      details: rejectedFields.map((field) => ({
        field,
        message: "This field cannot be updated through the self-profile endpoint."
      }))
    });
  }

  return sanitized;
};

const createAuthUser = async (supabaseClient, input) => {
  const { data, error } = await supabaseClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: buildSupabaseUserMetadata(input),
    app_metadata: {
      app_role: APP_ROLES.EMPLOYEE
    }
  });

  if (error || !data?.user) {
    throw createAppError({
      statusCode: error?.status === 422 ? 409 : 502,
      code: error?.status === 422 ? "USER_CREATION_CONFLICT" : "AUTH_USER_CREATE_FAILED",
      message:
        error?.status === 422
          ? "A user with this email already exists."
          : "Failed to create the authentication user."
    });
  }

  return data.user;
};

const rollbackAuthUser = async (supabaseClient, userId) => {
  try {
    await supabaseClient.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error("Failed to roll back auth user after profile creation error.", {
      userId,
      error
    });
  }
};

export const getCurrentUserProfile = (authUser) => authUser;

export const updateCurrentUserProfile = async (
  authUser,
  patch,
  {
    updateProfile = updateUserProfileById
  } = {}
) => {
  const sanitizedPatch = sanitizeSelfProfilePatch(patch);
  const updatedUser = await updateProfile(authUser.id, sanitizedPatch);

  if (!updatedUser) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found."
    });
  }

  return updatedUser;
};

export const listDirectoryUsersForUser = async (
  authUser,
  filters,
  {
    listUsers = loadUsersForDirectory
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "USER_DIRECTORY_FORBIDDEN",
    "Only managers and admins can view the people directory."
  );

  return listUsers(filters);
};

export const createEmployeeForUser = async (
  authUser,
  input,
  {
    findTeam = findAccessibleTeamById,
    supabaseClient = getServiceRoleSupabaseClient(),
    saveProfile = upsertUserProfile,
    addTeamMembership = createTeamMember,
    findUser = findUserAccessProfileById
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "USER_CREATION_FORBIDDEN",
    "Only managers and admins can create employees."
  );

  await ensureTeamManageable(authUser, input.teamId, { findTeam });

  let createdAuthUser;

  try {
    createdAuthUser = await createAuthUser(supabaseClient, input);

    await saveProfile({
      id: createdAuthUser.id,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      address: input.address ?? null,
      avatarUrl: input.avatarUrl ?? null,
      appRole: APP_ROLES.EMPLOYEE,
      isActive: true
    });

    await addTeamMembership({
      teamId: input.teamId,
      userId: createdAuthUser.id,
      membershipRole: "member"
    });
  } catch (error) {
    if (createdAuthUser?.id) {
      await rollbackAuthUser(supabaseClient, createdAuthUser.id);
    }

    throw error;
  }

  const user = await findUser(createdAuthUser.id);

  if (!user) {
    throw createAppError({
      statusCode: 500,
      code: "USER_PROFILE_CREATE_FAILED",
      message: "The employee was created, but the application profile could not be loaded."
    });
  }

  return user;
};

export const updateUserAvatarForUser = async (
  authUser,
  userId,
  input,
  {
    findUser = findUserAccessProfileById,
    updateProfile = updateUserProfileById,
    listTeams = listTeamsForUser
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "USER_AVATAR_UPDATE_FORBIDDEN",
    "Only managers and admins can update user avatars."
  );

  const targetUser = await findUser(userId);

  if (!targetUser) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found."
    });
  }

  await ensureUserVisibleToManager(authUser, targetUser, { listTeams });

  const updatedUser = await updateProfile(userId, {
    avatarUrl: input.avatarUrl
  });

  if (!updatedUser) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found."
    });
  }

  return updatedUser;
};
