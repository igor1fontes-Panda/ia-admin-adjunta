/**
 * Bot database layer — REAL DATA ONLY.
 *
 * Strategy: the bots now prefer the Neon Postgres database (DATABASE_URL /
 * NEON_DATABASE_URL) through the same schema the app uses. Every operation
 * falls back to the legacy Supabase REST path when the Neon URL is absent,
 * so existing GitHub Actions secrets keep working during the transition.
 * No simulation anywhere: if neither store is configured, callers must
 * refuse to act.
 */
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";

const NEON_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";

// Legacy Supabase config (fallback path)
const SUPABASE_URL = process.env.SUPABASE_URL_2 || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

const sql = NEON_URL ? neon(NEON_URL) : null;
const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

export const neonReady = Boolean(sql);
export const supabaseReady = Boolean(supabase);
export const storeReady = neonReady || supabaseReady;

export const storeLabel = neonReady ? "neon" : supabaseReady ? "supabase" : "none";

/** Generic read: returns an array of rows from the active store. */
export async function storeSelect(table, { columns = "*", orderBy = "created_at", ascending = false, limit = 200, eq = null } = {}) {
  if (sql) {
    const cols = columns === "*" ? "*" : columns;
    const order = `order by ${orderBy} ${ascending ? "asc" : "desc"}`;
    const rows = eq
      ? await sql(`select ${cols} from ${table} where ${eq.column} = $1 ${order} limit ${limit}`, [eq.value])
      : await sql(`select ${cols} from ${table} ${order} limit ${limit}`);
    return rows ?? [];
  }
  if (supabase) {
    let q = supabase.from(table).select(columns);
    if (eq) q = q.eq(eq.column, eq.value);
    const { data, error } = await q.order(orderBy, { ascending }).limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  throw new Error("No data store configured (set DATABASE_URL for Neon).");
}

/** Generic insert; returns the inserted row(s). */
export async function storeInsert(table, row) {
  if (sql) {
    const keys = Object.keys(row);
    const values = Object.values(row);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const quoted = keys.map((k) => `"${k}"`).join(", ");
    const inserted = await sql(
      `insert into ${table} (${quoted}) values (${placeholders}) returning *`,
      values,
    );
    return inserted ?? [];
  }
  if (supabase) {
    const { data, error } = await supabase.from(table).insert(row).select();
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  throw new Error("No data store configured.");
}

/** Generic update by id; returns the updated row(s). */
export async function storeUpdate(table, id, patch) {
  if (sql) {
    const keys = Object.keys(patch);
    if (keys.length === 0) return [];
    const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
    const updated = await sql(
      `update ${table} set ${sets} where id = $1 returning *`,
      [id, ...Object.values(patch)],
    );
    return updated ?? [];
  }
  if (supabase) {
    const { data, error } = await supabase.from(table).update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  throw new Error("No data store configured.");
}

/** Upsert into agent_memory on (agent, key) — the learning memory. */
export async function dbRemember(agent, key, value) {
  const updated_at = new Date().toISOString();
  if (sql) {
    await sql(
      `insert into agent_memory (agent, key, value, updated_at)
       values ($1, $2, $3::jsonb, $4)
       on conflict (agent, key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      [agent, key, JSON.stringify(value ?? null), updated_at],
    );
    return true;
  }
  if (supabase) {
    const { error } = await supabase
      .from("agent_memory")
      .upsert({ agent, key, value, updated_at });
    if (error) throw new Error(`supabase upsert agent_memory: ${error.message}`);
    return true;
  }
  return false;
}

/** Read the learning memory. Returns {} (never throws) when unavailable. */
export async function dbRecall(agent = null) {
  try {
    const rows = agent
      ? await storeSelect("agent_memory", { columns: "agent, key, value", orderBy: "updated_at", eq: { column: "agent", value: agent } })
      : await storeSelect("agent_memory", { columns: "agent, key, value", orderBy: "updated_at", limit: 500 });
    const out = {};
    for (const row of rows ?? []) {
      out[row.agent] = out[row.agent] || {};
      out[row.agent][row.key] = row.value;
    }
    return out;
  } catch {
    return {};
  }
}

export async function dbInsertActivity(kind, message) {
  if (!storeReady) return false;
  await storeInsert("activity_log", { kind, message });
  return true;
}

export async function dbInsertLeads(leads) {
  if (!storeReady) return false;
  for (const lead of leads) await storeInsert("leads", lead);
  return true;
}

export async function dbUpdateLead(id, patch) {
  if (!storeReady) return false;
  await storeUpdate("leads", id, patch);
  return true;
}

/**
 * Turn a recurring data-layer failure into an actionable diagnosis.
 * Returns null when the error is not a recognized recurring pattern.
 */
export function diagnoseStoreError(message) {
  const msg = String(message ?? "");
  if (/password authentication failed|auth.*failed|401/i.test(msg)) {
    return "Data store rejected the credentials. For Neon: copy the POOLED connection string (postgres://…-pooler…/neondb?sslmode=require) into DATABASE_URL.";
  }
  if (/relation .* does not exist|could not find the table|does not exist/i.test(msg)) {
    return "Required table is missing. Run `npx drizzle-kit push` (or apply drizzle/ migrations) against the Neon database.";
  }
  if (/failed to parse url|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(msg)) {
    return "Network/URL failure reaching the data store. Check DATABASE_URL and outbound connectivity.";
  }
  return null;
}

// Compatibility export for bots that import `supabase` directly — now routes
// through the generic store helpers so the bots stay store-agnostic.
export { storeSelect as select, storeInsert as insert, storeUpdate as update };
