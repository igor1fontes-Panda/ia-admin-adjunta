import { neon } from "@neondatabase/serverless";

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Neon is not configured: set NEON_DATABASE_URL or DATABASE_URL.");
  process.exit(1);
}

const sql = neon(connectionString);
try {
  const [row] = await sql`
    select
      current_database() as database,
      current_schema() as schema,
      to_regclass('public.leads') is not null as leads,
      to_regclass('public.clients') is not null as clients,
      to_regclass('public.orders') is not null as orders,
      to_regclass('public.activity_log') is not null as activity_log,
      to_regclass('public.agent_memory') is not null as agent_memory,
      to_regclass('public.delivery_status') is not null as delivery_status,
      exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'agent_memory'
          and indexdef ilike 'create unique index% (agent, key)%'
      ) as agent_memory_upsert_ready,
      exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'orders'
          and indexdef ilike 'create%index% (client_id)%'
      ) as orders_client_id_index_ready
  `;
  const required = ["leads", "clients", "orders", "activity_log", "agent_memory", "delivery_status"];
  const missing = required.filter((name) => row[name] !== true);
  if (row.agent_memory_upsert_ready !== true) missing.push("agent_memory unique(agent, key) index");
  if (missing.length) {
    throw new Error(`Neon is reachable, but required schema elements are missing: ${missing.join(", ")}`);
  }
  console.log(`Neon connection and schema OK: ${row.database}.${row.schema}`);
  if (row.orders_client_id_index_ready !== true) {
    console.warn("[neon] Performance advisory: missing index on public.orders(client_id).");
  }
} catch (error) {
  console.error(`Neon connection failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
