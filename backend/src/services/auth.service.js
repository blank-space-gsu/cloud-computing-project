import {
  getAnonSupabaseClient,
  getServiceRoleSupabaseClient
} from "../config/supabase.js";
import { env } from "../config/env.js";
import { APP_ROLES } from "../constants/roles.js";
import {
  findUserAccessProfileByEmail,
  findUserAccessProfileById,
  syncAuthBackedUserProfile
} from "../repositories/user.repository.js";
import { createAppError } from "../utils/appError.js";

const buildSessionPayload = (session) => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  tokenType: session.token_type,
  expiresIn: session.expires_in,
  expiresAt: session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null
});

const buildCurrentUserPayload = (profile, authUser) => ({
  ...profile,
  auth: {
    emailConfirmedAt: authUser.email_confirmed_at,
    lastSignInAt: authUser.last_sign_in_at
  }
});

const buildSignupVerificationPayload = (input, emailRedirectTo) => ({
  email: input.email,
  appRole: input.appRole,
  verificationRequired: true,
  verificationEmailSent: true,
  emailRedirectTo
});

const getAuthUserMetadataValue = (authUser, field) =>
  authUser?.user_metadata?.[field]
  ?? authUser?.raw_user_meta_data?.[field]
  ?? null;

const getAuthUserAppRole = (authUser) => {
  const appRole =
    authUser?.app_metadata?.app_role
    ?? authUser?.raw_app_meta_data?.app_role
    ?? APP_ROLES.EMPLOYEE;

  return [APP_ROLES.EMPLOYEE, APP_ROLES.MANAGER, APP_ROLES.ADMIN].includes(appRole)
    ? appRole
    : APP_ROLES.EMPLOYEE;
};

const buildAuthBackedProfile = (authUser, existingProfile = null) => ({
  id: authUser.id,
  email: authUser.email,
  firstName: String(getAuthUserMetadataValue(authUser, "first_name") ?? existingProfile?.firstName ?? "User").trim() || "User",
  lastName: String(getAuthUserMetadataValue(authUser, "last_name") ?? existingProfile?.lastName ?? "Account").trim() || "Account",
  jobTitle: getAuthUserMetadataValue(authUser, "job_title") ?? existingProfile?.jobTitle ?? null,
  appRole: getAuthUserAppRole(authUser),
  isActive: existingProfile?.isActive ?? true
});

const profileNeedsAuthSync = (profile, authUser) => {
  if (!profile) {
    return true;
  }

  const authProfile = buildAuthBackedProfile(authUser, profile);

  return (
    profile.email !== authProfile.email
    || profile.firstName !== authProfile.firstName
    || profile.lastName !== authProfile.lastName
    || (profile.jobTitle ?? null) !== (authProfile.jobTitle ?? null)
    || profile.appRole !== authProfile.appRole
  );
};

const ensureProvisionedProfile = (profile) => {
  if (!profile) {
    throw createAppError({
      statusCode: 403,
      code: "ACCOUNT_NOT_PROVISIONED",
      message:
        "The authenticated user does not have an application profile yet."
    });
  }

  if (!profile.isActive) {
    throw createAppError({
      statusCode: 403,
      code: "ACCOUNT_DISABLED",
      message: "This account is currently disabled."
    });
  }
};

const loadProvisionedProfile = async (
  authUser,
  {
    loadUserAccessProfile = findUserAccessProfileById,
    syncProfile = syncAuthBackedUserProfile
  } = {}
) => {
  let profile = await loadUserAccessProfile(authUser.id);

  if (profileNeedsAuthSync(profile, authUser)) {
    await syncProfile(buildAuthBackedProfile(authUser, profile));
    profile = await loadUserAccessProfile(authUser.id);
  }

  ensureProvisionedProfile(profile);

  return profile;
};

const buildSignupUserMetadata = (input) => ({
  first_name: input.firstName,
  last_name: input.lastName,
  job_title: input.jobTitle ?? null
});

const getSignupEmailRedirectTo = (currentEnv = env) =>
  currentEnv.authEmailRedirectTo;

const isDuplicateSignupError = (error) => {
  const code = String(error?.code ?? error?.name ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    error?.status === 422
    || code === "email_exists"
    || code === "user_already_exists"
    || message.includes("already registered")
    || message.includes("already exists")
  );
};

const isSignupEmailRateLimitError = (error) => {
  const code = String(error?.code ?? error?.name ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    error?.status === 429
    || code === "over_email_send_rate_limit"
    || message.includes("email send rate limit")
  );
};

const isEmailNotVerifiedError = (error) => {
  const code = String(error?.code ?? error?.name ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "email_not_confirmed"
    || message.includes("email not confirmed")
    || message.includes("email not verified")
  );
};

const createPendingVerificationAuthUser = async (
  input,
  {
    supabaseClient = getAnonSupabaseClient(),
    emailRedirectTo = getSignupEmailRedirectTo()
  } = {}
) => {
  const { data, error } = await supabaseClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: buildSignupUserMetadata(input),
      emailRedirectTo
    }
  });

  if (error) {
    const isDuplicate = isDuplicateSignupError(error);
    const isRateLimited = isSignupEmailRateLimitError(error);

    throw createAppError({
      statusCode: isDuplicate ? 409 : isRateLimited ? 429 : 502,
      code:
        isDuplicate
          ? "ACCOUNT_ALREADY_EXISTS"
          : isRateLimited
            ? "EMAIL_VERIFICATION_RATE_LIMITED"
            : "AUTH_SIGNUP_FAILED",
      message:
        isDuplicate
          ? "An account with this email already exists."
          : isRateLimited
            ? "Too many verification emails were requested recently. Please wait a moment and try again."
            : "Failed to create the authentication account."
    });
  }

  if (!data?.user) {
    throw createAppError({
      statusCode: 502,
      code: "AUTH_SIGNUP_FAILED",
      message: "Failed to create the authentication account."
    });
  }

  return {
    user: data.user,
    session: data.session ?? null,
    emailRedirectTo
  };
};

const assignSignupAppRole = async (
  authUserId,
  appRole,
  { supabaseClient = getServiceRoleSupabaseClient() } = {}
) => {
  const { error } = await supabaseClient.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      app_role: appRole
    }
  });

  if (error) {
    throw createAppError({
      statusCode: 502,
      code: "AUTH_SIGNUP_ROLE_SYNC_FAILED",
      message: "Failed to finish the application role setup for this account."
    });
  }
};

const rollbackAuthUser = async (userId, supabaseClient) => {
  try {
    await supabaseClient.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error("Failed to roll back auth signup after error.", {
      userId,
      error
    });
  }
};

export const loginUser = async (
  credentials,
  {
    supabaseClient = getAnonSupabaseClient(),
    loadUserAccessProfile = findUserAccessProfileById,
    syncProfile = syncAuthBackedUserProfile
  } = {}
) => {
  const { data, error } = await supabaseClient.auth.signInWithPassword(credentials);

  if (error || !data?.session || !data?.user) {
    if (isEmailNotVerifiedError(error)) {
      throw createAppError({
        statusCode: 403,
        code: "EMAIL_NOT_VERIFIED",
        message: "Check your inbox and verify your email before logging in."
      });
    }

    throw createAppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password."
    });
  }

  const profile = await loadProvisionedProfile(data.user, {
    loadUserAccessProfile,
    syncProfile
  });

  return {
    session: buildSessionPayload(data.session),
    user: buildCurrentUserPayload(profile, data.user)
  };
};

export const signupUser = async (
  input,
  {
    anonSupabaseClient = getAnonSupabaseClient(),
    serviceRoleSupabaseClient = getServiceRoleSupabaseClient(),
    findUserByEmail = findUserAccessProfileByEmail,
    syncProfile = syncAuthBackedUserProfile,
    currentEnv = env
  } = {}
) => {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw createAppError({
      statusCode: 409,
      code: "ACCOUNT_ALREADY_EXISTS",
      message: "An account with this email already exists."
    });
  }

  let createdAuthUserId;

  try {
    const signupResult = await createPendingVerificationAuthUser(input, {
      supabaseClient: anonSupabaseClient,
      emailRedirectTo: getSignupEmailRedirectTo(currentEnv)
    });
    createdAuthUserId = signupResult.user.id;

    if (signupResult.session) {
      throw createAppError({
        statusCode: 503,
        code: "AUTH_EMAIL_CONFIRMATION_NOT_ENABLED",
        message:
          "Signup must require email verification, but Supabase returned an immediate session. Enable email confirmations for this project."
      });
    }

    await assignSignupAppRole(signupResult.user.id, input.appRole, {
      supabaseClient: serviceRoleSupabaseClient
    });

    await syncProfile({
      id: signupResult.user.id,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle ?? null,
      appRole: input.appRole,
      isActive: true
    });

    return buildSignupVerificationPayload(input, signupResult.emailRedirectTo);
  } catch (error) {
    if (createdAuthUserId) {
      await rollbackAuthUser(createdAuthUserId, serviceRoleSupabaseClient);
    }

    throw error;
  }
};

export const resolveAuthenticatedUser = async (
  accessToken,
  {
    supabaseClient = getAnonSupabaseClient(),
    loadUserAccessProfile = findUserAccessProfileById,
    syncProfile = syncAuthBackedUserProfile
  } = {}
) => {
  const { data, error } = await supabaseClient.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw createAppError({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "The provided access token is invalid or expired."
    });
  }

  const profile = await loadProvisionedProfile(data.user, {
    loadUserAccessProfile,
    syncProfile
  });

  return {
    user: buildCurrentUserPayload(profile, data.user),
    accessToken
  };
};
