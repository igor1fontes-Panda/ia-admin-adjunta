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
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ADMIN_EMAIL, isAdminEmail } from "../../shared/admin";

export { ADMIN_EMAIL, isAdminEmail };

export type AuthUser = { id: string; email: string; name: string };

/**
 * Verify Neon Managed Better Auth access tokens before granting API access.
 * The browser SDK sends the short-lived session JWT as a Bearer token.
 * No database-backed Better Auth instance or Drizzle auth schema is used.
 */
let cachedJwksUrl: string | null = null;
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function authorizationHeader(headers: VercelRequest["headers"]): string | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === "authorization");
  const value = entry?.[1];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function neonJwks(): { keys: ReturnType<typeof createRemoteJWKSet>; issuer: string } | null {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  if (!baseUrl) return null;

  try {
    const parsedBaseUrl = new URL(baseUrl);
    if (parsedBaseUrl.protocol !== "https:" && parsedBaseUrl.hostname !== "localhost") return null;
    const issuer = parsedBaseUrl.origin;
    const jwksUrl =
      process.env.NEON_AUTH_JWKS_URL?.trim() ||
      `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}/.well-known/jwks.json`;
    if (jwksUrl !== cachedJwksUrl || !cachedJwks) {
      cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
      cachedJwksUrl = jwksUrl;
    }
    return { keys: cachedJwks, issuer };
  } catch {
    return null;
  }
}

export async function getSessionUser(req: VercelRequest): Promise<AuthUser | null> {
  const authorization = authorizationHeader(req.headers);
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const configuration = neonJwks();
  if (!configuration) return null;

  try {
    const { payload } = await jwtVerify(match[1].trim(), configuration.keys, {
      algorithms: ["EdDSA"],
      issuer: configuration.issuer,
      audience: configuration.issuer,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || !isAdminEmail(payload.email)) {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : payload.email,
    };
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
  // Keep database/provider details in server logs only; never expose them to clients.
  return res.status(500).json({ error: "An internal server error occurred." });
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
