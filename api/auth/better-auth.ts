/**
 * Canonical Vercel Better Auth handler using the existing Neon neon_auth schema.
 */
import type { VercelRequest, VercelResponse } from "../lib/http";
import { getAdminAuthDenial } from "../../shared/auth-policy";

export const config = { runtime: "nodejs" };

function requestBody(req: VercelRequest): unknown {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function enforceAdminIdentity(req: VercelRequest, res: VercelResponse): VercelResponse | null {
  const denial = getAdminAuthDenial({ url: req.url, body: requestBody(req) });
  return denial ? res.status(denial.status).json({ error: denial.message }) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const denied = enforceAdminIdentity(req, res);
  if (denied) return denied;

  const [{ auth }, { toNodeHandler }] = await Promise.all([import("../../server/auth.ts"), import("better-auth/node")]);
  if (!auth) {
    return res.status(503).json({
      error: "Authentication is unavailable. Check DATABASE_URL and BETTER_AUTH_SECRET.",
    });
  }

  try {
    return await toNodeHandler(auth)(req as never, res as never);
  } catch (error) {
    console.error("[auth] handler error:", error);
    return res.status(500).json({ error: "Authentication service error." });
  }
}
