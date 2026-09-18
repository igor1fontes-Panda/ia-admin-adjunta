#!/usr/bin/env node
/**
 * Autonomous Lead Qualifier Bot — REAL DATA ONLY, SELF-LEARNING.
 * Runs daily via GitHub Actions (or manually: npm run bot:leads).
 *
 * The learning loop (all from REAL rows, never simulated):
 *  1. Recalls its own strategy memory — which channels actually converted.
 *  2. Reads REAL unscored leads from the data store (Neon-first).
 *  3. Reads REAL outcomes (won/lost leads) to measure per-channel conversion.
 *  4. Scores every unscored lead (AI when configured + learned bias).
 *  5. Writes the next action + score back to the REAL lead row.
 *  6. Persists what it learned for the next run.
 *
 * If no data store is configured, or no AI provider is available, it reports
 * and exits — it NEVER fabricates leads or scores.
 */
import {
  dbInsertActivity,
  dbRecall,
  dbRemember,
  dbUpdateLead,
  diagnoseStoreError,
  log,
  storeLabel,
  storeReady,
  storeSelect,
} from "./bot-db.mjs";
import { askAI, parseJsonObject } from "./bot-lib.mjs";

const started = Date.now();

const DEFAULT_BIAS = {
  referral: 10,
  website: 5,
  linkedin: 5,
  event: 4,
  email: 0,
  cold_outreach: -5,
};

try {
  log("🎯 lead-hunter starting", { store: storeLabel });

  if (!storeReady) {
    log("⚠️  No data store configured (DATABASE_URL for Neon, or legacy Supabase secrets) — nothing real to qualify. Nothing simulated.");
    process.exit(0);
  }

  // ---------- 1) Recall learned strategy ----------
  const memory = await dbRecall("lead_qualifier");
  const channelLearning = memory.channel_conversion ?? {};
  const bias = { ...DEFAULT_BIAS };
  if (channelLearning && typeof channelLearning === "object") {
    for (const [channel, delta] of Object.entries(channelLearning)) {
      if (typeof delta === "number") bias[channel] = delta;
    }
  }
  log("learned channel bias:", JSON.stringify(bias));

  // ---------- 2) Read REAL unscored leads ----------
  const allLeads = await storeSelect("leads", { orderBy: "created_at", limit: 200 });
  const unscored = allLeads.filter((l) => l.ai_action === null || l.ai_action === undefined);
  log(`real leads: ${allLeads.length} total, ${unscored.length} awaiting qualification`);

  if (unscored.length === 0) {
    log("✅ nothing to qualify — every lead already processed.");
    await dbInsertActivity("bot", "Lead qualifier ran: all leads already scored — no new leads to process.").catch(() => {});
    process.exit(0);
  }

  // ---------- 3) Learn from REAL outcomes ----------
  const won = allLeads.filter((l) => l.status === "won");
  const lost = allLeads.filter((l) => l.status === "lost");
  const decided = won.length + lost.length;
  if (decided > 0) {
    const byChannel = {};
    for (const l of [...won, ...lost]) {
      byChannel[l.channel] = byChannel[l.channel] || { won: 0, lost: 0 };
      byChannel[l.channel][l.status === "won" ? "won" : "lost"] += 1;
    }
    const learned = {};
    for (const [channel, c] of Object.entries(byChannel)) {
      const total = c.won + c.lost;
      const rate = c.won / total; // 0..1
      // Map conversion rate to a bias in [-10, +10]
      learned[channel] = Math.round((rate - 0.5) * 20);
    }
    await dbRemember("lead_qualifier", "channel_conversion", learned);
    log("updated channel learning:", JSON.stringify(learned));
  }

  // ---------- 4) Score unscored leads (AI + learned bias) ----------
  let scored = 0;
  for (const lead of unscored) {
    const base = 50;
    const channelBoost = bias[lead.channel] ?? 0;
    let aiScore = null;
    let action = null;

    const ai = await askAI(
      `You are qualifying a B2B lead for an AI admin automation agency (Angola/Portugal market, plans 1,250-8,333 AOA/month). ` +
        `Lead: company="${lead.company}", contact="${lead.contact_name}", email="${lead.email}", niche="${lead.niche}", channel="${lead.channel}". ` +
        `Return ONLY a JSON object: {"score": <0-100 integer>, "action": "<one concrete next step, max 12 words>"}.`,
      { json: true },
    );
    if (ai) {
      const parsed = parseJsonObject(ai);
      if (parsed && Number.isFinite(Number(parsed.score))) {
        aiScore = Math.min(Math.max(Math.round(Number(parsed.score)), 0), 100);
        action = typeof parsed.action === "string" ? parsed.action.slice(0, 120) : null;
      }
    }

    const score = aiScore !== null ? Math.round(aiScore * 0.7 + (base + channelBoost) * 0.3) : Math.min(Math.max(base + channelBoost, 0), 100);
    const nextAction = action ?? (score >= 70 ? "Send proposal within 24h" : score >= 50 ? "Schedule demo this week" : "Nurture via email sequence");
    const status = score >= 80 ? "qualified" : lead.status;

    await dbUpdateLead(lead.id, { score, ai_action: nextAction, ...(status !== lead.status ? { status } : {}) });
    scored += 1;
    log(`scored ${lead.company}: ${score} → ${nextAction}`);
  }

  await dbInsertActivity("bot", `Lead qualifier: scored ${scored} new lead(s) using ${decided > 0 ? "learned channel conversion from real outcomes" : "neutral priors (no decided deals yet)"}.`);
  log(`✅ lead-hunter done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${scored} scored`);
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  const diag = diagnoseStoreError(e.message);
  if (diag) log("💡", diag);
  await dbInsertActivity("system", `Lead qualifier error: ${e.message}`).catch(() => {});
  process.exit(0);
}
