/**
 * Browser client for the single server-side Better Auth instance.
 * All authentication requests use the same-origin API and HttpOnly cookies.
 */
import { createAuthClient } from "better-auth/react";
import { ADMIN_EMAIL } from "../../shared/admin";

export { ADMIN_EMAIL };

export const AUTH_BASE = "/api/auth";

const authClientBaseURL =
  typeof window !== "undefined" ? `${window.location.origin}/api/auth` : "http://localhost:5173/api/auth";

export const authClient = createAuthClient({ baseURL: authClientBaseURL });

export const { useSession, signIn, signUp, signOut } = authClient;
