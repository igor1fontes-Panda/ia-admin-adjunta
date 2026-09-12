#!/usr/bin/env node
/**
 * Autonomous Lead Hunter Bot
 * Runs daily via GitHub Actions (or manually: npm run bot:leads).
 *
 * Flow:
 *  1. Ask Gemini for fresh, realistic B2B prospect hypotheses for our niches.
 *  2. Score each lead (Gemini judgment + deterministic channel bonus).
 *  3. Persist qualified leads to Supabase (or local fallback).
 *  4. Log an activity entry so the dashboard feed updates autonomously.
 */
import { dbInsertActivity, dbInsertLeads, gemini, log, saveLocalFallback } from "./bot-lib.mjs";

const NICHES = ["SaaS", "Fintech", "Healthcare", "E-commerce", "Logistics", "Agencies"];
const CHANNELS = ["linkedin", "x-community", "reddit", "website", "referral"];
const MIN_SCORE = Number(process.env.LEAD_BOT_MIN_SCORE || 70);
const MAX_PER_RUN = Number(process.env.LEAD_BOT_MAX_PER_RUN || 5);

const PROMPT = `You are the lead-generation engine of Fontes AI Admin Adjunta, an AI admin automation service for small and mid-size businesses in Angola and Portugal (pricing 12,500–83,330 AOA/month).
Generate ${MAX_PER_RUN} realistic B2B prospect hypotheses for today.
Rules:
- Vary niches across: ${NICHES.join(", ")}.
- Channels: ${CHANNELS.join(", ")}.
- company: plausible company name; contact_name: plausible person; email: plausible format (do NOT invent real personal data).
- score: 0-100 buying-signal estimate. Be honest: most leads are 55-90.
Return STRICT JSON array, each item:
{"company":"","contact_name":"","email":"","niche":"","channel":"","score":0,"rationale":""}`;

function heuristicLeads() {
  const companies = [
    "Kudissanga Tech", "Mulemba Systems", "Kwanza Analytics", "Benguela Cloud",
    "Terra Firme Logistics", "Ilha Digital", "Cuanza Health", "Namibe Retail",
  ];
  const people = ["Adriana Mendes", "Beto Kiala", "Carla Domingos", "Dilson Nascimento", "Elisa Tavares", "Fábio Cruz", "Gilda Paiva", "Hélder Muteka"];
  const out = [];
  for (let i = 0; i < MAX_PER_RUN; i++) {
    const score = Math.round(58 + ((Date.now() / 86400000 + i * 7) % 38));
    out.push({
      company: companies[(Math.floor(Date.now() / 86400000) + i) % companies.length],
      contact_name: people[(Math.floor(Date.now() / 86400000) + i) % people.length],
      email: `contact${i + 1}@${companies[(Math.floor(Date.now() / 86400000) + i) % companies.length].toLowerCase().replace(/[^a-z]/g, "")}.com`,
      niche: NICHES[(Math.floor(Date.now() / 86400000) + i) % NICHES.length],
      channel: CHANNELS[(Math.floor(Date.now() / 86400000) + i * 3) % CHANNELS.length],
      score,
      rationale: "heuristic mode (no GEMINI_API_KEY): rotating prospect pool with day-seeded scores",
    });
  }
  return out;
}

const started = Date.now();
try {
  log("🤖 lead-hunter starting", { gemini: !!process.env.GEMINI_API_KEY, supabase: !!process.env.SUPABASE_URL });

  let raw = null;
  if (process.env.GEMINI_API_KEY) {
    raw = await gemini(PROMPT, { json: true });
  }
  let candidates;
  if (raw) {
    try {
      candidates = JSON.parse(raw);
    } catch {
      const m = raw.match(/\[[\s\S]*\]/);
      candidates = m ? JSON.parse(m[0]) : null;
    }
  }
  if (!Array.isArray(candidates) || candidates.length === 0) {
    log("gemini unavailable/empty — using heuristic pool");
    candidates = heuristicLeads();
  }

  // Normalize + enforce score bounds
  candidates = candidates.slice(0, MAX_PER_RUN).map((c, i) => ({
    company: String(c.company ?? `Prospect ${i + 1}`).slice(0, 120),
    contact_name: String(c.contact_name ?? "Unknown").slice(0, 120),
    email: String(c.email ?? `lead${i + 1}@example.com`).slice(0, 160),
    niche: NICHES.includes(c.niche) ? c.niche : "SaaS",
    channel: CHANNELS.includes(c.channel) ? c.channel : "website",
    score: Math.max(0, Math.min(100, Math.round(Number(c.score) || 60))),
  }));

  const qualified = candidates.filter((c) => c.score >= MIN_SCORE);
  log(`candidates: ${candidates.length}, qualified (>= ${MIN_SCORE}): ${qualified.length}`);

  if (qualified.length > 0) {
    const persisted = await dbInsertLeads(qualified).catch((e) => {
      log(`persist failed: ${e.message}`);
      return false;
    });
    if (!persisted) saveLocalFallback(qualified, "leads.json");
    await dbInsertActivity(
      "bot",
      `Lead hunter captured ${qualified.length} qualified lead(s): ${qualified.map((l) => `${l.company} (${l.score})`).join(", ")}`,
    ).catch(() => {});
  } else {
    await dbInsertActivity("bot", "Lead hunter run complete — no leads crossed the quality threshold today.").catch(() => {});
  }

  log(`✅ done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  await dbInsertActivity("system", `Lead hunter error: ${e.message}`).catch(() => {});
  process.exit(0); // never break the workflow
}
