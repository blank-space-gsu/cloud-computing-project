import { getAnonSupabaseClient } from "../config/supabase.js";
import { findUserAccessProfileById } from "../repositories/user.repository.js";
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

export const loginUser = async (
  credentials,
  {
    supabaseClient = getAnonSupabaseClient(),
    loadUserAccessProfile = findUserAccessProfileById
  } = {}
) => {
  const { data, error } = await supabaseClient.auth.signInWithPassword(credentials);

  if (error || !data?.session || !data?.user) {
    throw createAppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password."
    });
  }

  const profile = await loadUserAccessProfile(data.user.id);
  ensureProvisionedProfile(profile);

  return {
    session: buildSessionPayload(data.session),
    user: buildCurrentUserPayload(profile, data.user)
  };
};

export const resolveAuthenticatedUser = async (
  accessToken,
  {
    supabaseClient = getAnonSupabaseClient(),
    loadUserAccessProfile = findUserAccessProfileById
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

  const profile = await loadUserAccessProfile(data.user.id);
  ensureProvisionedProfile(profile);

  return {
    user: buildCurrentUserPayload(profile, data.user),
    accessToken
  };
};
