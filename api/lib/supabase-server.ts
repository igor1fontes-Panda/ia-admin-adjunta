import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveEnv } from "@supabase/server/core";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createServerSupabaseClient(): SupabaseClient {
  const { data, error } = resolveEnv({
    url: process.env.SUPABASE_URL_2 || process.env.SUPABASE_URL,
    secretKeys: process.env.SUPABASE_SECRET_KEY
      ? { default: process.env.SUPABASE_SECRET_KEY }
      : undefined,
    publishableKeys: process.env.SUPABASE_PUBLISHABLE_KEY_2
      ? { default: process.env.SUPABASE_PUBLISHABLE_KEY_2 }
      : undefined,
    jwksUrl: process.env.SUPABASE_JWKS_URL,
  });

  if (error || !data) throw new Error(error?.message || "Supabase server configuration is invalid");
  const secretKey = process.env.SUPABASE_SECRET_KEY || data.secretKeys?.default;
  return createClient(required("SUPABASE_URL", data.url), required("SUPABASE_SECRET_KEY", secretKey), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseServerConfig() {
  return {
    url: process.env.SUPABASE_URL_2 || process.env.SUPABASE_URL || "",
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY_2 || process.env.SUPABASE_PUBLISHABLE_KEY || "",
    jwksUrl: process.env.SUPABASE_JWKS_URL || "",
    hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
  };
}
