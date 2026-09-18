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

const DEFAULT_NEON_AUTH_URL = "https://ep-broad-salad-zanhmhy8.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth";

const neonAuthUrl = (import.meta.env.VITE_NEON_AUTH_URL ?? DEFAULT_NEON_AUTH_URL).replace(/\/$/, "");

export const NEON_AUTH = Boolean(neonAuthUrl);
export const AUTH_BASE = neonAuthUrl || "/api/auth";

export const authClient = createAuthClient(neonAuthUrl ? { baseURL: neonAuthUrl } : {});

export const { useSession, signIn, signUp, signOut } = authClient;
