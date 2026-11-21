/**
 * Single Better Auth server instance, backed by the existing Neon identity schema.
 * No database migration is executed at application startup.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, isDbConfigured } from "../db";
import { authSchema } from "../db/auth-schema";

const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
if (isDbConfigured && !secret) {
  console.error("[auth] BETTER_AUTH_SECRET is missing; authentication is disabled.");
}

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined) ||
  (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : undefined) ||
  process.env.PUBLIC_SITE_URL ||
  process.env.V0_RUNTIME_URL;

const trustedOrigins = [
  ...(process.env.NODE_ENV === "development"
    ? [
        "http://localhost:3000",
        "http://localhost:5173",
        process.env.V0_RUNTIME_URL,
        process.env.V0_DEV_APP_URL,
        process.env.V0_BUILD_URL,
        process.env.V0_SANDBOX_URL,
      ]
    : []),
  ...(process.env.NODE_ENV === "production"
    ? [
        process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : undefined,
        process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined,
        process.env.PUBLIC_SITE_URL,
      ]
    : []),
].filter((value): value is string => Boolean(value));

export const auth =
  db && secret
    ? betterAuth({
        appName: "fontes-ai-admin-adjunta",
        baseURL,
        secret,
        trustedOrigins,
        database: drizzleAdapter(db, {
          provider: "pg",
          schemaName: "neon_auth",
          schema: authSchema,
        }),
        emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
        user: {
          additionalFields: {
            role: { type: "string", required: false, input: false, defaultValue: "user" },
            banned: { type: "boolean", required: false, input: false, defaultValue: false },
            banReason: { type: "string", required: false, input: false },
            banExpires: { type: "date", required: false, input: false },
          },
        },
        advanced: {
          database: { generateId: "uuid" },
          ...(process.env.NODE_ENV === "development"
            ? { defaultCookieAttributes: { sameSite: "lax" as const, secure: false } }
            : {}),
        },
        session: {
          expiresIn: 60 * 60 * 24 * 7,
          updateAge: 60 * 60 * 24,
          cookieCache: { enabled: true, maxAge: 5 * 60 },
        },
      })
    : null;

export type Auth = NonNullable<typeof auth>;
export type Session = Auth["$Infer"]["Session"];
