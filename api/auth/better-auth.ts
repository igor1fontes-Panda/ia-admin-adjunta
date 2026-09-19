/**
 * Better Auth handler for Vercel serverless functions.
 *
 * Mounted at /api/auth/better-auth and rewritten (see vercel.json) so every
 * auth endpoint works under the canonical /api/auth/* prefix:
 *   POST /api/auth/sign-in/email   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-out        GET  /api/auth/get-session
 *
 * `toNodeHandler` adapts Better Auth's web-standard Request/Response handler
 * to the Node.js (req, res) signature Vercel functions use — calling
 * auth.handler directly with Vercel's req/res silently breaks sessions.
 */
import { toNodeHandler } from "better-auth/node";
import { auth } from "../../server/auth";
import type { VercelRequest, VercelResponse } from "../lib/http";

// Vercel accepts the runtime family name here; the project engine controls
// the Node.js major version used by the build and function environment.
export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!auth) {
    return res.status(503).json({
      error:
        "Authentication is unavailable: set DATABASE_URL (Neon pooled connection) and BETTER_AUTH_SECRET, then redeploy.",
    });
  }
  try {
    return await toNodeHandler(auth)(req as never, res as never);
  } catch (error) {
    console.error("[auth] handler error:", error);
    return res.status(500).json({ error: "Authentication service error." });
  }
}
