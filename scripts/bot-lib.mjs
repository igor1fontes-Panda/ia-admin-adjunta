/**
 * Shared runtime for the autonomous bots — REAL DATA ONLY.
 * - AI: official Google GenAI SDK (Interactions API) with automatic model
 *   fallback chain so a single model hiccup never breaks a run.
 * - Persistence: Supabase service-role client. If Supabase is not configured
 *   the bots refuse to fabricate data and exit with clear guidance.
 * - If GEMINI_API_KEY is missing, bots skip gracefully instead of inventing
 *   "leads" — no simulations, ever.
 */
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
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

export const supabaseReady = Boolean(SUPABASE_URL && SERVICE_KEY);
export const supabase = supabaseReady ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

export const geminiReady = Boolean(GEMINI_KEY);
export const blackboxReady = Boolean(BLACKBOX_KEY);
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

export async function dbInsertLeads(leads) {
  if (!supabase) return false;
  const { error } = await supabase.from("leads").insert(leads);
  if (error) throw new Error(`supabase insert leads: ${error.message}`);
  return true;
}

export async function dbUpdateLead(id, patch) {
  if (!supabase) return false;
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) throw new Error(`supabase update lead ${id}: ${error.message}`);
  return true;
}

export async function dbInsertActivity(kind, message) {
  if (!supabase) return false;
  const { error } = await supabase.from("activity_log").insert({ kind, message });
  if (error) throw new Error(`supabase insert activity: ${error.message}`);
  return true;
}

// ---------- Agent learning memory (real outcomes, persisted) ----------

/**
 * Persist what an agent LEARNED from real data. Upsert on (agent, key).
 * Silently no-ops when Supabase is not configured (caller reports it).
 */
export async function dbRemember(agent, key, value) {
  if (!supabase) return false;
  const { error } = await supabase
    .from("agent_memory")
    .upsert({ agent, key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`supabase upsert agent_memory: ${error.message}`);
  return true;
}

/**
 * Read everything an agent has previously learned (or all agents when
 * agent is omitted). Returns {} on missing table/permission — callers
 * must work without memory, never crash.
 */
export async function dbRecall(agent) {
  if (!supabase) return {};
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
