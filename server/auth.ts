/**
 * Better Auth server instance — secure session-based authentication.
 *
 * - Sessions stored in Postgres (Neon) via the Drizzle adapter, state delivered
 *   in HttpOnly Secure cookies (Better Auth default "session_token").
 * - Email/password enabled with a minimum length of 8 (matches the UI).
 * - BASE_URL and SECRET come from the environment (Vercel + .env.local).
 * - When DATABASE_URL is missing, `auth` is null and callers must return 503 —
 *   importing this module must never crash the serverless function.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, isDbConfigured } from "../db";
import { account, session, user, verification } from "../db/schema";

if (isDbConfigured && !process.env.BETTER_AUTH_SECRET && !process.env.AUTH_SECRET) {
  console.warn("[auth] BETTER_AUTH_SECRET is not set — session cookies cannot be signed securely.");
}

export const auth = db
  ? betterAuth({
      appName: "fontes-ai-admin-adjunta",
      baseURL: process.env.BETTER_AUTH_URL || process.env.PUBLIC_SITE_URL || undefined,
      secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
      trustedOrigins: (request) => {
        const origin = request?.headers?.get("origin");
        return origin ? [origin] : [];
      },
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // refresh once a day
        cookieCache: {
          enabled: true,
          maxAge: 5 * 60, // 5 min signed cookie cache cuts DB reads
        },
      },
      database: drizzleAdapter(db, {
        provider: "pg",
        // Model name → Drizzle TABLE OBJECT (the adapter executes queries on it).
        schema: { user, session, account, verification },
      }),
    })
  : null;

export type Auth = NonNullable<typeof auth>;
export type Session = Auth["$Infer"]["Session"];
