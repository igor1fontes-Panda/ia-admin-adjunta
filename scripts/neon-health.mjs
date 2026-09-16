import { neon } from "@neondatabase/serverless";

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Neon is not configured: set NEON_DATABASE_URL or DATABASE_URL.");
  process.exit(1);
}

const sql = neon(connectionString);
try {
  const [row] = await sql`select current_database() as database, current_schema() as schema`;
  console.log(`Neon connection OK: ${row.database}.${row.schema}`);
} catch (error) {
  console.error(`Neon connection failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
