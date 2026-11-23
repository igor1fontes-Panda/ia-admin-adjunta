/**
 * Read-only replica integration smoke test.
 *
 * Requires DATABASE_URL (or NEON_DATABASE_URL) and
 * NEON_READONLY_DATABASE_URL. It performs SELECT-only checks and never writes.
 */
import { neon } from "@neondatabase/serverless";

const primaryUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const readOnlyUrl = process.env.NEON_READONLY_DATABASE_URL;

if (!primaryUrl || !readOnlyUrl) {
  console.error("Set DATABASE_URL (or NEON_DATABASE_URL) and NEON_READONLY_DATABASE_URL.");
  process.exit(2);
}

const primary = neon(primaryUrl);
const replica = neon(readOnlyUrl);
const tables = ["activity_log", "agent_memory", "clients", "delivery_status", "leads", "orders"];

async function counts(sql) {
  const [row] = await sql`SELECT
    (SELECT count(*)::int FROM public.activity_log) AS activity_log,
    (SELECT count(*)::int FROM public.agent_memory) AS agent_memory,
    (SELECT count(*)::int FROM public.clients) AS clients,
    (SELECT count(*)::int FROM public.delivery_status) AS delivery_status,
    (SELECT count(*)::int FROM public.leads) AS leads,
    (SELECT count(*)::int FROM public.orders) AS orders`;
  return row;
}

try {
  const [mode] = await replica`SHOW transaction_read_only`;
  if (String(mode?.transaction_read_only).toLowerCase() !== "on") {
    throw new Error("The configured read endpoint did not report transaction_read_only=on.");
  }

  const startedAt = performance.now();
  await replica`SELECT 1`;
  const replicaLatencyMs = Math.round((performance.now() - startedAt) * 100) / 100;

  const [primaryCounts, replicaCounts] = await Promise.all([counts(primary), counts(replica)]);
  const mismatches = tables.filter((table) => primaryCounts[table] !== replicaCounts[table]);
  if (mismatches.length) {
    throw new Error(`Primary/replica row-count mismatch: ${mismatches.join(", ")}`);
  }

  console.log(JSON.stringify({
    ok: true,
    readOnly: mode.transaction_read_only,
    replicaLatencyMs,
    comparedTables: tables.length,
    counts: replicaCounts,
  }, null, 2));
} catch (error) {
  console.error("Read-only replica smoke test failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
