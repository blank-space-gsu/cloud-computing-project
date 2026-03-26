import { createClient } from "@supabase/supabase-js";
import {
  env,
  hasSupabaseAdminConfig,
  hasSupabaseAuthConfig
} from "./env.js";
import { createAppError } from "../utils/appError.js";

const authClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
};

let anonSupabaseClient;
let serviceRoleSupabaseClient;

export const createSupabaseClient = (supabaseUrl, supabaseKey) =>
  createClient(supabaseUrl, supabaseKey, authClientOptions);

export const getAnonSupabaseClient = (currentEnv = env) => {
  if (!hasSupabaseAuthConfig(currentEnv)) {
    throw createAppError({
      statusCode: 503,
      code: "AUTH_CONFIGURATION_MISSING",
      message:
        "Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY."
    });
  }

  if (currentEnv !== env) {
    return createSupabaseClient(currentEnv.SUPABASE_URL, currentEnv.SUPABASE_ANON_KEY);
  }

  if (!anonSupabaseClient) {
    anonSupabaseClient = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }

  return anonSupabaseClient;
};

export const getServiceRoleSupabaseClient = (currentEnv = env) => {
  if (!hasSupabaseAdminConfig(currentEnv)) {
    throw createAppError({
      statusCode: 503,
      code: "AUTH_ADMIN_CONFIGURATION_MISSING",
      message:
        "Supabase admin access is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    });
  }

  if (currentEnv !== env) {
    return createSupabaseClient(
      currentEnv.SUPABASE_URL,
      currentEnv.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  if (!serviceRoleSupabaseClient) {
    serviceRoleSupabaseClient = createSupabaseClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  return serviceRoleSupabaseClient;
};
