import { betterAuth } from "better-auth";
import { pool } from "./db";

// pool is null when DATABASE_URL is unset (credential-less build / cold start);
// better-auth accepts the union and the API surface answers 503 until configured.
const database = pool ?? undefined;

const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  process.env.V0_RUNTIME_URL;

export const auth = betterAuth({
  database,
  baseURL,
  emailAndPassword: { enabled: true, autoSignIn: true },
  trustedOrigins: [
    ...(process.env.NODE_ENV === "development"
      ? [
          "http://localhost:3000",
          ...["V0_RUNTIME_URL", "V0_DEV_APP_URL", "V0_BUILD_URL", "V0_SANDBOX_URL"]
            .map((key) => process.env[key])
            .filter((value): value is string => Boolean(value)),
        ]
      : []),
    ...(process.env.NODE_ENV === "production"
      ? [
          process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
          process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : undefined,
        ].filter((value): value is string => Boolean(value))
      : []),
  ],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: { defaultCookieAttributes: { sameSite: "none" as const, secure: true } },
      }
    : {}),
});
