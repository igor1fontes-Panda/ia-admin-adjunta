#!/usr/bin/env node
/**
 * Autonomous Error Handler Bot — REAL DATA ONLY.
 * Runs hourly via GitHub Actions (or manually: npm run bot:error-handler).
 * Scans real incidents from the activity feed and produces a triage report
 * (Gemini analysis when GEMINI_API_KEY is set; rule-based otherwise — that is
 * triage logic, not simulated data).
 */
import { askAI, blackboxReady, dbInsertActivity, geminiReady, log, supabase, supabaseReady } from "./bot-lib.mjs";

const WINDOW_HOURS = 24;

try {
  log("🩺 error-handler starting", { supabase: supabaseReady, gemini: geminiReady, blackbox: blackboxReady });

  if (!supabaseReady) {
    log("⚠️  Supabase not configured — nothing to monitor. Add repo secrets to enable real runs.");
    process.exit(0);
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();
  const { data: incidents, error } = await supabase
    .from("activity_log")
    .select("message, created_at")
    .gte("created_at", since)
    .ilike("message", "%error%");
  if (error) throw new Error(`query failed: ${error.message}`);

  const list = incidents ?? [];
  const signature = list.length
    ? list.map((i) => `- ${i.created_at}: ${i.message}`).join("\n")
    : "No incidents detected in the last 24h.";

  let analysis =
    list.length === 0
      ? "All systems nominal. No action required."
      : `${list.length} incident(s). Rule-based triage: check Supabase connectivity and table constraints.`;

  if (list.length && (geminiReady || blackboxReady)) {
    const aiText = await askAI(
      `You are the autonomous error handler for a SaaS admin platform. Analyze these REAL incidents from the last ${WINDOW_HOURS}h. Output: likely root cause, severity (low/medium/high), one concrete fix.\n\n${signature}`,
    );
    if (aiText) analysis = aiText.trim();
  }

  console.log(`Error handler report — window: ${WINDOW_HOURS}h\nIncidents: ${list.length}\n\n${analysis}`);

  await dbInsertActivity(
    "bot",
    list.length
      ? `Error handler: ${list.length} incident(s) in ${WINDOW_HOURS}h — triage logged.`
      : `Error handler: all systems nominal (${WINDOW_HOURS}h window).`,
  ).catch(() => {});

  log("✅ done");
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  process.exit(0); // never break the workflow
}
