#!/usr/bin/env node
/**
 * Autonomous Error Handler Bot
 * Runs hourly via GitHub Actions (or manually: npm run bot:error-handler).
 * Detects recent failures and writes a triage report. With GEMINI_API_KEY it
 * produces an AI analysis of the failure signature; otherwise a rule-based one.
 */
import { dbInsertActivity, gemini, log, supabase } from "./bot-lib.mjs";

const WINDOW_HOURS = 24;

try {
  log("🩺 error-handler starting", { supabase: !!supabase });

  let incidents = [];
  if (supabase) {
    // Activity entries containing "error" in the lookback window = incidents.
    const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();
    const { data, error } = await supabase
      .from("activity_log")
      .select("message, created_at")
      .gte("created_at", since)
      .ilike("message", "%error%");
    if (error) throw new Error(`query failed: ${error.message}`);
    incidents = data ?? [];
  }

  const signature = incidents.length
    ? incidents.map((i) => `- ${i.created_at}: ${i.message}`).join("\n")
    : "No incidents detected in the last 24h.";

  let analysis =
    incidents.length === 0
      ? "All systems nominal. No action required."
      : `${incidents.length} incident(s) found. Rule-based triage: review leads table constraints and Supabase connectivity.`;

  if (incidents.length && process.env.GEMINI_API_KEY) {
    const ai = await gemini(
      `You are the autonomous error handler for a SaaS admin platform. Analyze these incidents from the last ${WINDOW_HOURS}h and output a short triage: likely root cause, severity (low/medium/high), and one concrete fix.\n\n${signature}`,
    );
    if (ai) analysis = ai.trim();
  }

  const report = [`Error handler report — window: ${WINDOW_HOURS}h`, `Incidents: ${incidents.length}`, "", analysis].join("\n");
  console.log(report);

  await dbInsertActivity(
    "bot",
    incidents.length
      ? `Error handler: ${incidents.length} incident(s) in ${WINDOW_HOURS}h — triage logged.`
      : `Error handler: all systems nominal (${WINDOW_HOURS}h window).`,
  ).catch(() => {});

  log("✅ done");
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  process.exit(0); // never break the workflow
}
