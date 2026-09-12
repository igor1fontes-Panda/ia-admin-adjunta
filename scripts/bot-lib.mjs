/**
 * Shared runtime for the autonomous bots.
 * - Supabase persistence (service role) when configured, else local JSON fallback.
 * - Gemini (Google AI Studio) via REST when GEMINI_API_KEY is set, else
 *   deterministic heuristic mode. Bots NEVER crash the workflow — they degrade
 *   gracefully and always exit 0 unless a hard infra error occurs.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

export const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

export const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

export async function dbInsertLeads(leads) {
  if (!supabase) return false;
  const { error } = await supabase.from("leads").insert(leads);
  if (error) throw new Error(`supabase insert leads: ${error.message}`);
  return true;
}

export async function dbInsertActivity(kind, message) {
  if (!supabase) return false;
  const { error } = await supabase.from("activity_log").insert({ kind, message });
  if (error) throw new Error(`supabase insert activity: ${error.message}`);
  return true;
}

export function saveLocalFallback(rows, filename) {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, filename);
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  fs.writeFileSync(file, JSON.stringify([...existing, ...rows], null, 2));
  log(`saved ${rows.length} rows locally → ${file} (Supabase not configured)`);
}

/** Call Gemini generateContent REST API. Returns text or null on any failure. */
export async function gemini(prompt, { json = false } = {}) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: json ? { responseMimeType: "application/json" } : {},
        }),
      },
    );
    if (!res.ok) {
      log(`gemini HTTP ${res.status} — falling back to heuristic mode`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ?? null;
  } catch (e) {
    log(`gemini call failed: ${e.message} — falling back to heuristic mode`);
    return null;
  }
}
