/**
 * Better Auth React client.
 * Talks to /api/auth/* (rewritten to the serverless handler in vercel.json).
 * Session state lives in an HttpOnly cookie — no tokens in localStorage.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;
