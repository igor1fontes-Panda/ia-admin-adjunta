/**
 * db:smoke — the equivalent of `getData()` from the Server Actions snippet,
 * adapted to this repo's stack (Vercel Functions + Neon HTTP driver).
 *
 * Runs the same pattern: neon(process.env.DATABASE_URL) + tagged-template SQL.
 * Prints row counts for every table the app needs, so the moment DATABASE_URL
 * is set anywhere (sandbox env, shell prefix, or production), ONE command
 * proves the data layer end-to-end. Never mutates data.
 *
 * Usage:
 *   bun run db:smoke                                  (uses env DATABASE_URL)
 *   DATABASE_URL='postgres://…' bun run db:smoke      (inline, no .env needed)
 */
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error(
    "db:smoke: DATABASE_URL is not set.\n" +
      "  Provide the Neon pooled connection string (postgresql://…-pooler….aws.neon.tech/neondb?sslmode=require)\n" +
      "  via the environment or inline: DATABASE_URL='…' bun run db:smoke",
  );
  process.exit(1);
}

const sql = neon(connectionString);

const TABLES = [
  "leads",
  "clients",
  "orders",
  "activity_log",
  "agent_memory",
  "delivery_status",
  "user",
  "session",
  "account",
  "verification",
];

try {
  const [{ database, version }] = await sql`
    select current_database() as database, version() as version
  `;
  console.log(`✅ Connected: database="${database}"`);
  console.log(`   ${version.split(",")[0]}`);

  let missing = 0;
  for (const table of TABLES) {
    try {
      // Table names come from the fixed TABLES list above (never user input).
      // This neon driver version forbids call-form sql(); the documented
      // conventional-call API is sql.query().
      const rows = await sql.query(`select count(*)::int as n from "${table}"`);
      const row = rows[0];
      console.log(`   ${table.padEnd(16)} ${String(row.n).padStart(6)} rows`);
    } catch {
      console.log(`   ${table.padEnd(16)} MISSING (run: bun run db:push)`);
      missing += 1;
    }
  }

  if (missing > 0) {
    console.log(`\n⚠️  ${missing} table(s) missing — apply the schema with: bun run db:push`);
    process.exit(2);
  }
  console.log("\n✅ Schema complete — data layer ready.");
} catch (error) {
  console.error(`❌ Connection failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
