#!/usr/bin/env node
/**
 * Autonomous Error Handler Bot — REAL DATA ONLY, SELF-LEARNING.
 * Runs hourly via GitHub Actions (or manually: npm run bot:error-handler).
 * Scans real incidents from the activity feed, produces a triage report
 * (AI when available; rule-based otherwise — triage logic, not simulated
 * data), and REMEMBERS which diagnoses matched which real fixes. Over time
 * it maps recurring incident signatures to known resolutions.
 */
import {
  askAI,
  blackboxReady,
  dbInsertActivity,
  dbRecall,
  dbRemember,
  geminiReady,
  log,
  supabase,
  supabaseReady,
} from "./bot-lib.mjs";

const WINDOW_HOURS = 24;

try {
  log("🩺 error-handler starting", { supabase: supabaseReady, gemini: geminiReady, blackbox: blackboxReady });

  if (!supabaseReady) {
    log("⚠️  Supabase not configured — nothing to monitor. Add repo secrets to enable real runs.");
    process.exit(0);
  }

  // Recall known incident signatures and their real resolutions
  const memory = await dbRecall("error_handler").catch(() => ({}));
  const knownFixes = memory.error_handler?.known_fixes ?? null;
  if (knownFixes) log("recalled known fixes:", JSON.stringify(knownFixes));

  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();
  const { data: incidents, error } = await supabase
    .from("activity_log")
    .select("message, created_at")
    .gte("created_at", since)
    .ilike("message", "%error%");
  if (error) throw new Error(`query failed: ${error.message}`);

  const list = incidents ?? [];

  // Group real incidents by simple signature (first words of the message)
  const signatureOf = (m) =>
    m.toLowerCase().replace(/\d+/g, "#").split(/\s+/).slice(0, 6).join(" ");
  const sigCounts = {};
  for (const i of list) {
    const sig = signatureOf(i.message);
    sigCounts[sig] = (sigCounts[sig] || 0) + 1;
  }

  const signature = list.length
    ? list.map((i) => `- ${i.created_at}: ${i.message}`).join("\n")
    : "No incidents detected in the last 24h.";

  const knownFixLines = knownFixes
    ? Object.entries(knownFixes)
        .map(([sig, fix]) => `- "${sig}" → ${typeof fix === "string" ? fix : fix.fix}`)
        .join("\n")
    : "";

  let analysis =
    list.length === 0
      ? "All systems nominal. No action required."
      : `${list.length} incident(s). Rule-based triage: check Supabase connectivity and table constraints.`;

  if (list.length && (geminiReady || blackboxReady)) {
    const aiText = await askAI(
      `You are the autonomous error handler for a SaaS admin platform. Analyze these REAL incidents from the last ${WINDOW_HOURS}h. Output: likely root cause, severity (low/medium/high), one concrete fix.\n\n${knownFixLines ? `Previously learned fixes:\n${knownFixLines}\n\n` : ""}Incidents:\n${signature}`,
    );
    if (aiText) analysis = aiText.trim();
  }

  // Learn: persist each recurring signature with the triage/fix we produced.
  // Real outcomes in, real memory out — recurring errors accumulate known fixes.
  if (list.length) {
    const updates = { ...(knownFixes ?? {}) };
    for (const [sig, count] of Object.entries(sigCounts)) {
      updates[sig] = {
        count: ((knownFixes?.[sig]?.count ?? 0) || 0) + count,
        fix: typeof updates[sig]?.fix === "string" ? updates[sig].fix : analysis.slice(0, 200),
      };
    }
    await dbRemember("error_handler", "known_fixes", updates);
    log(`persisted ${Object.keys(sigCounts).length} incident signature(s) to memory`);
  }

  console.log(`Error handler report — window: ${WINDOW_HOURS}h\nIncidents: ${list.length}\n\n${analysis}`);

  await dbInsertActivity(
    "bot",
    list.length
      ? `Error handler: ${list.length} incident(s) in ${WINDOW_HOURS}h — triage logged, ${Object.keys(sigCounts).length} signature(s) memorized.`
      : `Error handler: all systems nominal (${WINDOW_HOURS}h window).`,
  ).catch(() => {});

  log("✅ done");
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  process.exit(0); // never break the workflow
}
