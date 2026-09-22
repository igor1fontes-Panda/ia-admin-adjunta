/**
 * db:read-back — proves the read side of the data layer end-to-end.
 * SELECTs the newest rows from `leads` (and prints total counts), so a
 * single command demonstrates that data written through the app's API
 * is retrievable from Neon. Read-only; never mutates data.
 *
 * Usage: DATABASE_URL='postgres://...' bun run db:read-back
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL is not set in the environment.");
  process.exit(1);
}

const sql = neon(url);

const rows = await sql`
  SELECT id, company, contact_name, email, niche, channel, status, score, created_at
  FROM leads
  ORDER BY created_at DESC
  LIMIT 5
`;

const [{ count: total }] = await sql`SELECT count(*)::int AS count FROM leads`;

console.log(`✅ Read-back from Neon: ${total} lead(s) total, newest ${rows.length}:`);
for (const r of rows) {
  console.log(
    `   ${String(r.id).slice(0, 8)} | ${r.company} | ${r.contact_name} <${r.email}> | ${r.niche}/${r.channel} | ${r.status} | score ${r.score}`
  );
}
console.log("✅ READ-BACK OK — data retrieved from the database.");
