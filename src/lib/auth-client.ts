/**
 * Better Auth React client.
 *
 * The browser ALWAYS talks to this app's own /api/auth routes (same-origin,
 * HttpOnly cookies on our domain). The server side decides where the session
 * lives:
 *   - VITE_NEON_AUTH_URL set on the server → server proxies to managed Neon
 *     Auth (hosted Better Auth), injecting a trusted origin server-to-server.
 *   - unset → self-hosted Better Auth on Neon Postgres (DATABASE_URL).
 *
 * This removes the cross-origin browser calls that made managed Neon Auth
 * reject the deployed origin with "Invalid origin".
 */
import { createAuthClient } from "better-auth/react";

const configuredAuthUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)?.trim();

// Managed Neon Auth is active when the SERVER has the endpoint configured.
// The VITE_ prefix also inlines it into the client bundle, which keeps the
// NEON_AUTH flag true for the sign-up verification-panel UX — but the client
// itself never calls that URL: everything goes through same-origin /api/auth.
export const NEON_AUTH = Boolean(configuredAuthUrl);
export const AUTH_BASE = "/api/auth";

const authClientBaseURL =
  typeof window !== "undefined" ? `${window.location.origin}/api/auth` : "http://localhost:5173/api/auth";

export const authClient = createAuthClient({ baseURL: authClientBaseURL });

export const { useSession, signIn, signUp, signOut } = authClient;
