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
  const results = await Promise.all([
    sql`SELECT count(*)::int AS count FROM public.activity_log`,
    sql`SELECT count(*)::int AS count FROM public.agent_memory`,
    sql`SELECT count(*)::int AS count FROM public.clients`,
    sql`SELECT count(*)::int AS count FROM public.delivery_status`,
    sql`SELECT count(*)::int AS count FROM public.leads`,
    sql`SELECT count(*)::int AS count FROM public.orders`,
  ]);
  return Object.fromEntries(tables.map((table, index) => [table, results[index][0].count]));
}

try {
  const [mode] = await replica`SELECT
    current_user AS role_name,
    current_setting('transaction_read_only') AS transaction_read_only,
    has_table_privilege(current_user, 'public.clients', 'SELECT') AS can_read,
    has_table_privilege(current_user, 'public.clients', 'INSERT') AS can_write`;
  if (
    mode?.role_name !== "app_reporting_ro" ||
    String(mode?.transaction_read_only).toLowerCase() !== "on" ||
    mode?.can_read !== true ||
    mode?.can_write !== false
  ) {
    throw new Error("The replica must use app_reporting_ro with SELECT-only privileges.");
  }

  const startedAt = performance.now();
  await replica`SELECT 1`;
  const replicaLatencyMs = Math.round((performance.now() - startedAt) * 100) / 100;

  const [primaryCounts, replicaCounts] = await Promise.all([counts(primary), counts(replica)]);
  const mismatches = tables.filter((table) => primaryCounts[table] !== replicaCounts[table]);
  if (mismatches.length) {
    throw new Error(`Primary/replica row-count mismatch: ${mismatches.join(", ")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        readOnly: mode.transaction_read_only,
        replicaLatencyMs,
        comparedTables: tables.length,
        counts: replicaCounts,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    [
      "Read-only replica smoke test failed:",
      error instanceof Error ? error.message : error,
    ].join(" "),
  );
  process.exitCode = 1;
}
