/**
 * GET /api/health — liveness + data-layer health.
 * Reports which layer is missing so the dashboard can guide setup instead of
 * showing fake data. Never throws.
 */
import type { VercelRequest, VercelResponse } from "./lib/http";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  res.setHeader("Cache-Control", "no-store");
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
  const authReady = Boolean(process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET);
  const readOnlyConnectionString = process.env.NEON_READONLY_DATABASE_URL || "";

  let dbOk = false;
  let dbError: string | null = null;
  if (connectionString) {
    try {
      const q = neon(connectionString);
      await q`select 1`;
      dbOk = true;
    } catch {
      dbError = "database_unavailable";
    }
  }

  let readReplicaOk: boolean | null = null;
  let readReplicaError: string | null = null;
  if (readOnlyConnectionString) {
    try {
      const readOnlyQuery = neon(readOnlyConnectionString);
      await readOnlyQuery`select 1`;
      readReplicaOk = true;
    } catch {
      readReplicaOk = false;
      readReplicaError = "read_replica_unavailable";
    }
  }

  const ok = dbOk && authReady && readReplicaOk !== false;
  return res.status(ok ? 200 : 503).json({
    ok,
    database: { configured: Boolean(connectionString), connected: dbOk, error: dbError },
    readReplica: {
      configured: Boolean(readOnlyConnectionString),
      connected: readReplicaOk,
      error: readReplicaError,
    },
    auth: { configured: authReady, provider: "better-auth" },
    checkedAt: new Date().toISOString(),
  });
}
