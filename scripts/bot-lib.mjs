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

/** Free-tier model chain: newest first, safest fallback last. */
const MODEL_CHAIN = [
  process.env.GEMINI_MODEL || "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

export const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

export const supabaseReady = Boolean(SUPABASE_URL && SERVICE_KEY);
export const supabase = supabaseReady ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

export const geminiReady = Boolean(GEMINI_KEY);
const ai = geminiReady ? new GoogleGenAI({ apiKey: GEMINI_KEY }) : null;

/**
 * Generate text via the official Interactions API.
 * Tries each model in the chain until one responds; returns null if none do
 * (callers must treat null as "AI unavailable" and act on real data only).
 */
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
