/**
 * Shared runtime for the autonomous bots — REAL DATA ONLY.
 * - AI: official Google GenAI SDK (Interactions API) with automatic model
 *   fallback chain so a single model hiccup never breaks a run.
 * - Persistence: Neon Postgres (DATABASE_URL) is the primary store, accessed
 *   through a supabase-js-compatible shim so every bot keeps its existing
 *   code. If Neon is not configured the bots fall back to legacy Supabase
 *   service-role secrets; if neither exists they refuse to fabricate data.
 * - If GEMINI_API_KEY is missing, bots skip gracefully instead of inventing
 *   "leads" — no simulations, ever.
 */
import { GoogleGenAI } from "@google/genai";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";

// Primary store: Neon pooled connection string.
const NEON_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";

// Fallback store: legacy Supabase secrets.
const SUPABASE_URL = process.env.SUPABASE_URL_2 || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const BLACKBOX_KEY = process.env.BLACKBOX_API_KEY || "";
const BLACKBOX_URL = process.env.BLACKBOX_BASE_URL || "https://enterprise.blackbox.ai/chat/completions";
const BLACKBOX_MODEL = process.env.BLACKBOX_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";

/** Free-tier model chain: newest first, safest fallback last (deduplicated). */
const MODEL_CHAIN = [...new Set([
  process.env.GEMINI_MODEL || "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
])];

export const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

const neonSql = NEON_URL ? neon(NEON_URL) : null;
const supabaseClient = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

export const neonReady = Boolean(neonSql);
export const supabaseReady = Boolean(neonSql || supabaseClient);
export const storeLabel = neonReady ? "neon" : supabaseClient ? "supabase" : "none";

// ---------------------------------------------------------------------------
// supabase-js-compatible shim over the store (Neon-first, Supabase fallback).
// Supports the fluent patterns the bots use:
//   from(t).select(cols).eq(c,v).order(c,{ascending}).limit(n)
//   from(t).select(...).eq(...).maybeSingle() / .single()
//   from(t).insert(rows).select()      from(t).update(patch).eq("id",id)
//   from(t).upsert(row)                (agent_memory: conflict on (agent,key))
// Every query resolves to { data, error } exactly like supabase-js.
// ---------------------------------------------------------------------------

class ShimQuery {
  constructor(table) {
    this._table = table;
    this._mode = "select";
    this._columns = "*";
    this._filters = [];
    this._orderBy = null;
    this._ascending = false;
    this._limit = null;
    this._payload = null;
    this._single = false;
    this._maybe = false;
  }
  select(cols = "*") { this._columns = cols; return this; }
  eq(col, val) { this._filters.push([col, val]); return this; }
  order(col, opts = {}) { this._orderBy = col; this._ascending = opts.ascending === true; return this; }
  limit(n) { this._limit = n; return this; }
  insert(values) { this._mode = "insert"; this._payload = values; return this; }
  update(patch) { this._mode = "update"; this._payload = patch; return this; }
  upsert(row) { this._mode = "upsert"; this._payload = row; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybe = true; return this; }
  then(resolve, reject) {
    return execShim(this).then(resolve, reject);
  }
}

/** Serialize plain objects for jsonb columns; primitives pass through. */
function param(v) {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) return JSON.stringify(v);
  return v;
}

async function execShim(q) {
  if (neonSql) {
    try {
      return await execNeon(q);
    } catch (e) {
      if (!supabaseClient) return { data: null, error: { message: String(e?.message ?? e) } };
      // fall through to Supabase fallback
    }
  }
  if (supabaseClient) {
    try {
      return await execSupabase(q);
    } catch (e) {
      return { data: null, error: { message: String(e?.message ?? e) } };
    }
  }
  return { data: null, error: { message: "No data store configured (set DATABASE_URL for Neon, or legacy Supabase secrets)." } };
}

async function execNeon(q) {
  const params = [];
  let data;

  if (q._mode === "select") {
    let text = `select ${q._columns} from ${q._table}`;
    for (const [col, val] of q._filters) {
      params.push(param(val));
      text += params.length === 1 ? " where" : " and";
      text += ` "${col}" = $${params.length}`;
    }
    if (q._orderBy) text += ` order by "${q._orderBy}" ${q._ascending ? "asc" : "desc"}`;
    if (q._limit !== null) text += ` limit ${q._limit}`;
    data = await neonSql(text, params);
  } else if (q._mode === "insert" || q._mode === "upsert") {
    const rows = Array.isArray(q._payload) ? q._payload : [q._payload];
    if (rows.length === 0) return { data: [], error: null };
    const keys = Object.keys(rows[0]);
    const quoted = keys.map((k) => `"${k}"`).join(", ");
    const valuesClauses = [];
    for (const row of rows) {
      const ph = keys.map((k) => {
        params.push(param(row[k]));
        return `$${params.length}`;
      });
      valuesClauses.push(`(${ph.join(", ")})`);
    }
    let text = `insert into ${q._table} (${quoted}) values ${valuesClauses.join(", ")}`;
    if (q._mode === "upsert" && q._table === "agent_memory") {
      text += ` on conflict (agent, key) do update set value = excluded.value, updated_at = excluded.updated_at`;
    }
    text += ` returning *`;
    data = await neonSql(text, params);
  } else if (q._mode === "update") {
    const keys = Object.keys(q._payload);
    if (keys.length === 0) return { data: [], error: null };
    const sets = keys.map((k) => {
      params.push(param(q._payload[k]));
      return `"${k}" = $${params.length}`;
    });
    let text = `update ${q._table} set ${sets.join(", ")}`;
    for (const [col, val] of q._filters) {
      params.push(param(val));
      text += keys.length === params.length ? " where" : " and";
      text += ` "${col}" = $${params.length}`;
    }
    text += ` returning *`;
    data = await neonSql(text, params);
  } else {
    return { data: null, error: { message: `Unsupported mode ${q._mode}` } };
  }

  if (q._single || q._maybe) data = (data && data[0]) || null;
  return { data: data ?? [], error: null };
}

async function execSupabase(q) {
  let qb = supabaseClient.from(q._table);
  if (q._mode === "select") qb = qb.select(q._columns);
  else if (q._mode === "insert") qb = qb.insert(q._payload).select();
  else if (q._mode === "update") qb = qb.update(q._payload).select();
  else if (q._mode === "upsert") qb = qb.upsert(q._payload).select();
  for (const [col, val] of q._filters) qb = qb.eq(col, val);
  if (q._orderBy) qb = qb.order(q._orderBy, { ascending: q._ascending });
  if (q._limit !== null) qb = qb.limit(q._limit);
  if (q._single) qb = qb.single();
  else if (q._maybe) qb = qb.maybeSingle();
  return await qb;
}

/** The exported `supabase` is now the store-agnostic shim. */
export const supabase = { from: (table) => new ShimQuery(table) };

export const geminiReady = Boolean(GEMINI_KEY);
export const blackboxReady = Boolean(BLACKBOX_KEY);

export async function verifyBotReadiness() {
  const checks = {
    supabase: supabaseReady,
    neon: neonReady,
    model: geminiReady || blackboxReady,
  };
  if (!checks.supabase) return { ready: false, checks, message: "No data store configured (DATABASE_URL for Neon); no real-data operation can run." };
  if (!checks.model) return { ready: false, checks, message: "No approved AI provider is configured; no inference will run." };
  const { error } = await supabase.from("activity_log").select("id").limit(1);
  if (error) {
    const diagnosis = diagnoseSupabaseError(error.message);
    return { ready: false, checks, message: diagnosis || `Data store health check failed: ${error.message}` };
  }
  return { ready: true, checks, message: `Data store (${storeLabel}) and an approved AI provider are ready.` };
}

const ai = geminiReady ? new GoogleGenAI({ apiKey: GEMINI_KEY }) : null;

/**
 * Blackbox AI — OpenAI-compatible chat/completions endpoint.
 * Default model: nvidia/nemotron-3-ultra-550b-a55b. Non-streaming for
 * deterministic bot runs (same API, stream:false).
 */
export async function blackbox(prompt) {
  if (!BLACKBOX_KEY) return null;
  try {
    const res = await fetch(BLACKBOX_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BLACKBOX_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: BLACKBOX_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });
    if (!res.ok) {
      log(`blackbox: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.length > 0) {
      log(`ai: provider=blackbox model=${BLACKBOX_MODEL} chars=${text.length}`);
      return text;
    }
    log("blackbox: empty output");
    return null;
  } catch (e) {
    log(`blackbox failed: ${e?.message ?? e}`);
    return null;
  }
}

/**
 * Unified AI entry point with full provider chain:
 * Gemini (Interactions API, model chain) → Blackbox AI → null.
 * Callers treat null as "AI unavailable" and act on real data only.
 */
export async function askAI(prompt, { json = false } = {}) {
  const viaGemini = await gemini(prompt, { json });
  if (viaGemini) return viaGemini;
  return blackbox(prompt);
}
export async function gemini(prompt, { json = false } = {}) {
  if (!ai) return null;
  for (const model of MODEL_CHAIN) {
    try {
      const interaction = await ai.interactions.create({
        model,
        input: prompt,
        ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      });
      const text = interaction?.output_text;
      if (typeof text === "string" && text.length > 0) {
        log(`ai: model=${model} chars=${text.length}`);
        return text;
      }
      log(`ai: model=${model} returned empty output`);
    } catch (e) {
      log(`ai: model=${model} failed: ${e?.message ?? e}`);
    }
  }
  return null;
}

/** Parse a JSON array out of a model response, tolerating code fences. */
export function parseJsonArray(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  const m = raw.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/** Parse a JSON object out of a model response, tolerating code fences. */
export function parseJsonObject(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/**
 * Turn a recurring data-store failure into an actionable diagnosis.
 * Returns null when the error is not a recognized recurring pattern.
 */
export function diagnoseSupabaseError(message) {
  const msg = String(message ?? "");
  if (/password authentication failed|invalid api key|unregistered api key/i.test(msg)) {
    return "Recurring incident: the data store rejected the credentials. Fix (Neon): copy the POOLED connection string from Neon Console → Connection Details into DATABASE_URL.";
  }
  if (/relation .* does not exist|could not find the table/i.test(msg)) {
    return "Recurring incident: a required table is missing. Fix: run `npx drizzle-kit push` (or apply the drizzle/ migrations) against the Neon database.";
  }
  if (/failed to parse url|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(msg)) {
    return "Recurring incident: network/URL failure reaching the data store. Check DATABASE_URL and outbound connectivity.";
  }
  return null;
}

export async function dbInsertLeads(leads) {
  if (!supabaseReady) return false;
  const { error } = await supabase.from("leads").insert(leads);
  if (error) throw new Error(`insert leads: ${error.message}`);
  return true;
}

export async function dbUpdateLead(id, patch) {
  if (!supabaseReady) return false;
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) throw new Error(`update lead ${id}: ${error.message}`);
  return true;
}

export async function dbInsertActivity(kind, message) {
  if (!supabaseReady) return false;
  const { error } = await supabase.from("activity_log").insert({ kind, message });
  if (error) {
    const diag = diagnoseSupabaseError(error.message);
    log(`activity insert failed: ${error.message}${diag ? ` — ${diag}` : ""}`);
    throw new Error(`insert activity: ${error.message}`);
  }
  return true;
}

// ---------- Agent learning memory (real outcomes, persisted) ----------

/**
 * Persist what an agent LEARNED from real data. Upsert on (agent, key).
 * Silently no-ops when no store is configured (caller reports it).
 */
export async function dbRemember(agent, key, value) {
  if (!supabaseReady) return false;
  const { error } = await supabase
    .from("agent_memory")
    .upsert({ agent, key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`upsert agent_memory: ${error.message}`);
  return true;
}

/**
 * Read everything an agent has previously learned (or all agents when
 * agent is omitted). Returns {} on missing table/permission — callers
 * must work without memory, never crash.
 */
export async function dbRecall(agent) {
  if (!supabaseReady) return {};
  let q = supabase.from("agent_memory").select("agent, key, value");
  if (agent) q = q.eq("agent", agent);
  const { data, error } = await q;
  if (error) return {}; // missing migration etc. — operate memory-less
  const out = {};
  for (const row of data ?? []) {
    out[row.agent] = out[row.agent] || {};
    out[row.agent][row.key] = row.value;
  }
  return out;
}
