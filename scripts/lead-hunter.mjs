#!/usr/bin/env node
/**
 * Autonomous Lead Qualifier Bot — REAL DATA ONLY, SELF-LEARNING.
 * Runs daily via GitHub Actions (or manually: npm run bot:leads).
 *
 * The learning loop (all from REAL rows, never simulated):
 *  1. Recalls its own strategy memory (agent_memory) — which channels have
 *     actually converted into won deals before.
 *  2. Reads REAL unscored leads from Supabase.
 *  3. Reads REAL outcomes (won/lost leads) to measure per-channel conversion.
 *  4. Scores new leads (AI when available; adaptive rules otherwise) using
 *     what was learned, not a fixed heuristic.
 *  5. Persists the updated strategy so every run gets smarter — and the
 *     dashboard Agents tab shows exactly what the bot has learned.
 *
 * With an empty database there is nothing to learn yet — it says so honestly.
 */
import {
  askAI,
  blackboxReady,
  dbInsertActivity,
  dbRecall,
  dbRemember,
  dbUpdateLead,
  geminiReady,
  log,
  parseJsonArray,
  supabase,
  supabaseReady,
} from "./bot-lib.mjs";

const MIN_SCORE = Number(process.env.LEAD_BOT_MIN_SCORE || 70);

const started = Date.now();
try {
  log("🤖 lead-qualifier starting", { supabase: supabaseReady, gemini: geminiReady, blackbox: blackboxReady });

  if (!supabaseReady) {
    log("⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — nothing to qualify. Add repo secrets to enable real runs.");
    process.exit(0);
  }

  // 1) Recall what we learned in previous runs (real stored strategy)
  const memory = await dbRecall("lead_qualifier").catch(() => ({}));
  const learnedChannelBias = memory.lead_qualifier?.channel_bias ?? null;
  if (learnedChannelBias) {
    log("learned channel bias:", JSON.stringify(learnedChannelBias));
  }

  // 2) Real, unscored leads (no AI action assigned yet)
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, company, contact_name, email, niche, channel, score, status, created_at")
    .is("ai_action", null)
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(`fetch leads: ${error.message}`);

  if (!leads || leads.length === 0) {
    log("No unscored real leads found — nothing to do.");
    await dbInsertActivity("bot", "Lead qualifier: no pending leads (queue clear).").catch(() => {});
    process.exit(0);
  }
  log(`loaded ${leads.length} real lead(s) to qualify`);

  // 3) Measure REAL conversion per channel from won/lost outcomes
  const { data: outcomes, error: outcomeErr } = await supabase
    .from("leads")
    .select("channel, status")
    .in("status", ["won", "lost"]);
  if (outcomeErr) log(`outcome fetch failed (continuing without history): ${outcomeErr.message}`);

  const channelStats = {}; // { channel: { won, lost, total } }
  for (const o of outcomes ?? []) {
    const ch = o.channel || "unknown";
    channelStats[ch] = channelStats[ch] || { won: 0, lost: 0, total: 0 };
    channelStats[ch].total += 1;
    if (o.status === "won") channelStats[ch].won += 1;
    else channelStats[ch].lost += 1;
  }

  // Adaptive bias: channels that actually produced won deals get a boost
  // proportional to their real conversion rate; channels with real losses
  // are penalized. No outcomes → bias stays neutral (we cannot learn yet).
  const channelBias = {};
  let learnedSomething = false;
  for (const [ch, s] of Object.entries(channelStats)) {
    const decided = s.won + s.lost;
    if (decided === 0) continue;
    const rate = s.won / decided; // real conversion rate 0..1
    channelBias[ch] = Math.round((rate - 0.5) * 20); // -10..+10
    if (decided >= 2) learnedSomething = true;
  }

  // Persist the learning (real data only — skip silently when empty)
  if (Object.keys(channelBias).length > 0) {
    await dbRemember("lead_qualifier", "channel_bias", {
      bias: channelBias,
      stats: channelStats,
      updated_at: new Date().toISOString(),
    });
    log("persisted channel learning:", JSON.stringify(channelBias));
  }

  // 4) Score the new leads — AI first (fed with real learned bias), else
  //    adaptive rules that use the same real bias.
  let scored = null;
  if (geminiReady || blackboxReady) {
    const historyContext = Object.keys(channelStats).length
      ? `REAL conversion history per channel (won/lost/total): ${JSON.stringify(channelStats)}`
      : "No decided deals yet — no conversion history exists.";
    const biasContext = learnedChannelBias
      ? `Learned channel bias from previous runs (points added to score): ${JSON.stringify(learnedChannelBias.bias ?? learnedChannelBias)}`
      : "";
    const prompt = `You are the revenue-operations engine of Fontes AI Admin Adjunta (AI admin automation for SMBs in Angola/Portugal, plans 12,500–83,330 AOA/month).
Score these REAL inbound leads. For each: score 0-100 buying intent, and one concrete next action.
${historyContext}
${biasContext}
Favor channels and niches that actually converted before. Be honest and conservative. Return STRICT JSON array:
[{"id":"<lead id>","score":0,"ai_action":"","priority":"high|medium|low"}]

REAL LEADS:
${JSON.stringify(leads.map((l) => ({ id: l.id, company: l.company, contact_name: l.contact_name, niche: l.niche, channel: l.channel, created_at: l.created_at })), null, 2)}`;
    const raw = await askAI(prompt, { json: true });
    const parsed = parseJsonArray(raw);
    if (parsed && parsed.length) scored = parsed;
  }

  if (!scored) {
    // Adaptive rule-scoring: base heuristic + REAL learned channel bias
    const biasOf = (ch) => {
      const raw = channelBias[ch];
      if (typeof raw === "number") return raw;
      if (learnedChannelBias && typeof (learnedChannelBias.bias ?? {})[ch] === "number") {
        return learnedChannelBias.bias[ch];
      }
      return 0;
    };
    scored = leads.map((l) => {
      let s = typeof l.score === "number" ? l.score : 55;
      s += biasOf(l.channel); // learned, from real outcomes
      if (!Object.keys(channelBias).length && !learnedChannelBias) {
        // Cold-start prior (no evidence yet): mild, standard weights
        if (l.channel === "referral") s += 10;
        if (l.channel === "linkedin") s += 5;
      }
      if (["SaaS", "Fintech"].includes(l.niche)) s += 6;
      s = Math.max(0, Math.min(100, s));
      return {
        id: l.id,
        score: s,
        ai_action: s >= 80 ? "Contact today — high intent" : s >= 60 ? "Schedule demo this week" : "Add to nurture sequence",
        priority: s >= 80 ? "high" : s >= 60 ? "medium" : "low",
      };
    });
    log("AI unavailable — applied adaptive rule-scoring (real bias where available)");
  }

  // 5) Persist back to the real database
  let updated = 0;
  for (const s of scored) {
    if (!s || typeof s.id !== "string") continue;
    const patch = {
      score: Math.max(0, Math.min(100, Math.round(Number(s.score) || 0))),
      ai_action: String(s.ai_action ?? "").slice(0, 300) || null,
    };
    try {
      await dbUpdateLead(s.id, patch);
      updated++;
    } catch (e) {
      log(`update failed for ${s.id}: ${e.message}`);
    }
  }

  const hot = scored.filter((s) => (Number(s.score) || 0) >= MIN_SCORE).length;
  const learnNote = learnedSomething
    ? " Updated strategy from real won/lost outcomes."
    : Object.keys(channelStats).length
      ? " Awaiting more decided deals before strategy update."
      : " Cold start: no decided deals yet — using neutral priors.";
  await dbInsertActivity(
    "bot",
    `Lead qualifier processed ${updated} real lead(s) — ${hot} above threshold ${MIN_SCORE}.${learnNote}`,
  ).catch(() => {});

  log(`✅ qualified ${updated} lead(s) (${hot} hot) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  await dbInsertActivity("system", `Lead qualifier error: ${e.message}`).catch(() => {});
  process.exit(0); // never break the workflow
}
