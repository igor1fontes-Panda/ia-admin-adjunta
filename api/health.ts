/**
 * GET /api/health — liveness + data-layer health.
 * Reports which layer is missing so the dashboard can guide setup instead of
 * showing fake data. Never throws.
 */
import type { VercelRequest, VercelResponse } from "./lib/http";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
  const authReady = Boolean(process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET);

  let dbOk = false;
  let dbError: string | null = null;
  if (connectionString) {
    try {
      const q = neon(connectionString);
      await q`select 1`;
      dbOk = true;
    } catch (e) {
      dbError = e instanceof Error ? e.message : "connection failed";
    }
  }

  const ok = dbOk && authReady;
  return res.status(ok ? 200 : 503).json({
    ok,
    database: { configured: Boolean(connectionString), connected: dbOk, error: dbError },
    auth: { configured: authReady, provider: "better-auth" },
    checkedAt: new Date().toISOString(),
  });
}
