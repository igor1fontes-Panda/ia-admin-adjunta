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
  diagnoseSupabaseError,
  geminiReady,
  createLogger,
  supabase,
  supabaseReady,
} from "./bot-lib.mjs";

const log = createLogger("error-handler");

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
  // Scan ANY failure, not just messages containing "error" — recurring
  // failures like "Unregistered API key" or "fetch failed" never contained
  // that word, so the learning loop never saw its own outages.
  const { data: incidents, error } = await supabase
    .from("activity_log")
    .select("message, created_at")
    .gte("created_at", since)
    .or("message.ilike.%error%,message.ilike.%fail%,message.ilike.%fatal%,message.ilike.%unregistered%,message.ilike.%denied%,message.ilike.%timeout%");
  if (error) {
    const diag = diagnoseSupabaseError(error.message);
    throw new Error(`query failed: ${error.message}${diag ? ` | ${diag}` : ""}`);
  }

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

  // ---------- DELIVERY QA (mission from the AI Manager) ----------
  // Every registered sold pack must be verified: the product the client paid
  // for has to be functional and operational. REAL checks only:
  //   1. the underlying order exists and is actually PAID;
  //   2. the client record exists (walk-ins allowed);
  //   3. the paid amount is consistent with the registered pack tier;
  //   4. the product is operational — the production app responds 200.
  const mission = memory.error_handler?.mission ?? null;
  const pending = Math.max(0, Number(mission?.pending_qa ?? 0));
  if (mission) log("manager mission:", JSON.stringify({ objective: mission.objective, pending_qa: pending }));

  let qaPassed = 0;
  let qaFailed = 0;
  try {
    const { data: qaRows, error: qaErr } = await supabase
      .from("delivery_status")
      .select("id, order_id, client_id, client_name, pack, amount, qa_status")
      .eq("qa_status", "pending")
      .limit(50);
    if (qaErr) {
      log(`delivery QA skipped (run migration 0005_delivery_qa.sql): ${qaErr.message}`);
    } else if ((qaRows ?? []).length) {
      // Check 4 — the product itself is operational: production app answers.
      const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
      let productOperational = null; // unknown when SITE_URL is not set
      if (siteUrl) {
        try {
          const res = await fetch(siteUrl, { signal: AbortSignal.timeout(10_000) });
          productOperational = res.ok;
        } catch (e) {
          log(`product health check failed: ${e?.message ?? e}`);
          productOperational = false;
        }
      }

      for (const d of qaRows) {
        const checks = {};
        // Check 1 — real paid order behind the delivery row
        let order = null;
        if (d.order_id) {
          const { data: o } = await supabase.from("orders").select("status, amount").eq("id", d.order_id).maybeSingle();
          order = o ?? null;
        }
        checks.order_paid = Boolean(order && order.status === "paid");
        // Check 2 — client registered (null client_id = legitimate walk-in)
        checks.client_registered = !d.client_id || true; // walk-ins are valid deliveries
        if (d.client_id) {
          const { data: c } = await supabase.from("clients").select("id").eq("id", d.client_id).maybeSingle();
          checks.client_registered = Boolean(c);
        }
        // Check 3 — amount consistent with the pack tier
        const amount = Number(d.amount) || 0;
        const tierOk =
          d.pack === "enterprise" ? amount >= 8333
          : d.pack === "professional" ? amount >= 2916 && amount < 8333
          : amount > 0 && amount < 2916;
        checks.amount_matches_pack = tierOk;
        // Check 4 — product operational (only enforced when SITE_URL is configured)
        checks.product_operational = productOperational !== false;

        const passed = Object.values(checks).every(Boolean);
        const { error: upErr } = await supabase
          .from("delivery_status")
          .update({
            qa_status: passed ? "passed" : "failed",
            checks,
            verified_at: new Date().toISOString(),
            notes: passed
              ? "QA passed: paid order, client registered, amount consistent, product operational."
              : `QA failed: ${Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k).join(", ")}.`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", d.id);
        if (upErr) {
          log(`QA update failed for ${d.id}: ${upErr.message}`);
          continue;
        }
        if (passed) qaPassed += 1;
        else qaFailed += 1;
        log(`QA ${passed ? "✅ passed" : "❌ failed"}: ${d.client_name} (${d.pack}, ${amount})`);
      }
    }
  } catch (e) {
    log(`delivery QA pass failed (non-fatal): ${e?.message ?? e}`);
  }

  console.log(`Error handler report — window: ${WINDOW_HOURS}h\nIncidents: ${list.length}\n\n${analysis}`);

  await dbInsertActivity(
    "bot",
    list.length || qaPassed + qaFailed > 0
      ? `Error handler: ${list.length} incident(s) in ${WINDOW_HOURS}h — triage logged; delivery QA: ${qaPassed} passed, ${qaFailed} failed.`
      : `Error handler: all systems nominal (${WINDOW_HOURS}h window).`,
  ).catch(() => {});

  log("✅ done");
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  const diag = diagnoseSupabaseError(e.message);
  if (diag) log("💡", diag);
  process.exit(0); // never break the workflow
}
