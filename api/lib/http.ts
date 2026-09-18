/**
 * Shared helpers for the data API routes (Neon + Drizzle).
 *
 * Authorization model (replaces Supabase RLS):
 * - Business data (leads/clients/orders/activity/agent_memory/delivery_status):
 *   authenticated sessions only.
 * - The ONLY public mutation is the landing-page lead form (POST /api/leads
 *   without a session), which is hard-limited to safe defaults server-side —
 *   the public cannot set score/status/ai_action (mirrors the old Supabase
 *   trigger `forces_default_lead_fields`).
 */
export interface VercelRequest {
  method?: string;
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): VercelResponse;
  end(): VercelResponse;
}
import type { Auth } from "../../server/auth";
import { fromNodeHeaders } from "better-auth/node";

export type AuthUser = { id: string; email: string; name: string };

/** Returns the signed-in user for this request, or null.
 * `auth` may be null when DATABASE_URL is not configured (null-safe server). */
export async function getSessionUser(
  req: VercelRequest,
  auth: Auth | null,
): Promise<AuthUser | null> {
  if (!auth) return null;
  try {
    const session = await auth.api.getSession({
      // Vercel lambda headers are a plain object — convert for Better Auth.
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) return null;
    return { id: session.user.id, email: session.user.email, name: session.user.name };
  } catch {
    return null;
  }
}

export function unauthorized(res: VercelResponse): VercelResponse {
  return res.status(401).json({ error: "Sign in to access the command center data." });
}

export function dbUnavailable(res: VercelResponse): VercelResponse {
  return res.status(503).json({
    error: "Database is not connected. Set DATABASE_URL (Neon pooled connection) in the environment.",
  });
}

export function badRequest(res: VercelResponse, message: string): VercelResponse {
  return res.status(400).json({ error: message });
}

/** Central error mapping so routes never leak stack traces to the client. */
export function serverError(res: VercelResponse, error: unknown): VercelResponse {
  console.error("[api] error:", error);
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return res.status(500).json({ error: message });
}
