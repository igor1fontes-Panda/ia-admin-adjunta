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
  url?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): VercelResponse;
  end(data?: string | Uint8Array): VercelResponse;
  append(name: string, value: string | string[]): VercelResponse;
  setHeader(name: string, value: string | string[] | number): VercelResponse;
  getHeader(name: string): string | number | string[] | undefined;
  flushHeaders?(): void;
}
import type { Auth } from "../../server/auth";

export type AuthUser = { id: string; email: string; name: string };

/** Returns the signed-in user for this request, or null.
 * `auth` may be null when DATABASE_URL is not configured (null-safe server).
 * Identity sources, in order: self-hosted Better Auth session cookie, then
 * an additive Clerk session JWT (Bearer) when CLERK_SECRET_KEY is set.
 * Both integrations load lazily: serverless functions must not crash at cold
 * start if a package's export map resolves oddly in the runtime — a failed
 * load degrades to "no session" (401) instead of FUNCTION_INVOCATION_FAILED. */
export async function getSessionUser(req: VercelRequest, auth: Auth | null): Promise<AuthUser | null> {
  if (auth) {
    try {
      const { fromNodeHeaders } = await import("better-auth/node");
      const session = await auth.api.getSession({
        // Vercel lambda headers are a plain object — convert for Better Auth.
        headers: fromNodeHeaders(req.headers),
      });
      if (session?.user) {
        return { id: session.user.id, email: session.user.email, name: session.user.name };
      }
    } catch {
      // fall through to Clerk bearer verification
    }
  }
  try {
    const { verifyClerkUser } = await import("../../server/clerk");
    return await verifyClerkUser(req);
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

// ---------- Input validation (zod) ----------
//
// Every mutating route parses its payload through a schema BEFORE it reaches
// Drizzle, so invalid requests are rejected with a readable 400 instead of
// producing a broken database row. zod is safe for server use and mirrors
// the client-side schemas in src/lib/schemas.ts.
import { z } from "zod";

/** 400 with the first human-readable validation message. */
export function validationError(res: VercelResponse, error: z.ZodError): VercelResponse {
  const issue = error.issues[0];
  return res.status(400).json({ error: issue ? issue.message : "Invalid input." });
}

/** Parse a request body with a zod schema; on failure, send a 400 and return null. */
export function parseBody<S extends z.ZodType>(res: VercelResponse, schema: S, body: unknown): z.infer<S> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    validationError(res, result.error);
    return null;
  }
  return result.data;
}

/** Shared field schemas for the API boundaries. Length caps mirror the
 * client-side schemas so a hostile direct API caller is bounded too. */
export const apiSchemas = {
  leadCreate: z.object({
    company: z.string().trim().min(2, "company must be at least 2 characters.").max(120),
    contact_name: z.string().trim().min(2, "contact_name must be at least 2 characters.").max(120),
    email: z.string().trim().toLowerCase().email("Invalid email address.").max(254),
    niche: z.string().trim().min(1, "niche is required.").max(80),
  }),
  clientCreate: z.object({
    name: z.string().trim().min(2, "name must be at least 2 characters.").max(120),
    email: z.string().trim().toLowerCase().email("Invalid billing email address.").max(254),
    plan: z.enum(["starter", "professional", "enterprise"], "plan must be starter, professional or enterprise."),
  }),
  orderCreate: z.object({
    client_id: z.string().trim().min(1, "client_id must be a non-empty id.").nullable(),
    client_name: z.string().trim().min(1, "client_name is required.").max(120),
    amount: z
      .number("amount must be a number.")
      .int("amount must be a whole number of AOA.")
      .min(1000, "amount must be at least 1.000 Kz."),
    method: z.enum(["multicaixa", "paypay", "card", "wire_usd", "wire_eur"], "invalid payment method."),
  }),
} as const;
