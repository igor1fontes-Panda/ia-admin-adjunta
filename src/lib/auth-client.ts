/**
 * Better Auth React client.
 *
 * Default target: the project's managed Neon Auth endpoint (powered by Better
 * Auth) — a public, project-specific URL provided by the owner. Sessions live
 * in HttpOnly cookies on that origin (SameSite=None; Secure for the SPA).
 *
 * Override: set VITE_NEON_AUTH_URL to "" to fall back to this app's own
 * /api/auth serverless routes (self-hosted Better Auth + DATABASE_URL).
 */
import { createAuthClient } from "better-auth/react";

const configuredAuthUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)?.trim();
const neonAuthUrl = configuredAuthUrl ? configuredAuthUrl.replace(/\/$/, "") : "";

// Keep authentication same-origin by default. This makes the browser use the
// Vercel function backed by Neon instead of a stale project-specific URL.
export const NEON_AUTH = Boolean(neonAuthUrl);
export const AUTH_BASE = neonAuthUrl || "/api/auth";

const authClientBaseURL = neonAuthUrl ||
  (typeof window !== "undefined" ? `${window.location.origin}/api/auth` : "http://localhost:5173/api/auth");

export const authClient = createAuthClient({ baseURL: authClientBaseURL });

export const { useSession, signIn, signUp, signOut } = authClient;
