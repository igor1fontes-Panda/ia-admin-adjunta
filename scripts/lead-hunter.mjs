#!/usr/bin/env node
/**
 * Autonomous Lead Qualifier Bot — REAL DATA ONLY.
 * Runs daily via GitHub Actions (or manually: npm run bot:leads).
 *
 * What it actually does (no simulations):
 *  1. Reads REAL leads from the Supabase `leads` table (public form + imports).
 *  2. Asks Gemini (Interactions API, free-tier model chain) to score each real
 *     lead 0-100 and define the next best action.
 *  3. Writes the AI scores/actions back to Supabase so the dashboard updates
 *     with genuine, persisted intelligence.
 *  4. Logs a real activity entry. Without a key it does nothing destructive —
 *     it reports and exits; it never invents leads.
 */
import { askAI, blackboxReady, dbInsertActivity, dbUpdateLead, geminiReady, log, parseJsonArray, supabase, supabaseReady } from "./bot-lib.mjs";

const MIN_SCORE = Number(process.env.LEAD_BOT_MIN_SCORE || 70);

const started = Date.now();
try {
  log("🤖 lead-qualifier starting", { supabase: supabaseReady, gemini: geminiReady, blackbox: blackboxReady });

  if (!supabaseReady) {
    log("⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — nothing to qualify. Add repo secrets to enable real runs.");
    process.exit(0);
  }

  // 1) Real, unscored leads (no AI action assigned yet)
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

  // 2) AI scoring of the REAL leads (Gemini → Blackbox fallback chain)
  let scored = null;
  if (geminiReady || blackboxReady) {
    const prompt = `You are the revenue-operations engine of Fontes AI Admin Adjunta (AI admin automation for SMBs in Angola/Portugal, plans 12,500–83,330 AOA/month).
Score these REAL inbound leads. For each: score 0-100 buying intent, and one concrete next action.
Be honest and conservative. Return STRICT JSON array:
[{"id":"<lead id>","score":0,"ai_action":"","priority":"high|medium|low"}]

REAL LEADS:
${JSON.stringify(leads.map((l) => ({ id: l.id, company: l.company, contact_name: l.contact_name, niche: l.niche, channel: l.channel, created_at: l.created_at })), null, 2)}`;
    const raw = await askAI(prompt, { json: true });
    const parsed = parseJsonArray(raw);
    if (parsed && parsed.length) scored = parsed;
  }

  if (!scored) {
    // Deterministic ranking on real data (a scoring rule, not fabricated data)
    const base = (l) => {
      let s = typeof l.score === "number" ? l.score : 55;
      if (l.channel === "referral") s += 10;
      if (l.channel === "linkedin") s += 5;
      if (["SaaS", "Fintech"].includes(l.niche)) s += 6;
      return Math.max(0, Math.min(100, s));
    };
    scored = leads.map((l) => {
      const s = base(l);
      return {
        id: l.id,
        score: s,
        ai_action: s >= 80 ? "Contact today — high intent (rule-scored)" : s >= 60 ? "Schedule demo this week (rule-scored)" : "Add to nurture sequence (rule-scored)",
        priority: s >= 80 ? "high" : s >= 60 ? "medium" : "low",
      };
    });
    log("AI unavailable — applied deterministic rule-scoring to real leads");
  }

  // 3) Persist back to the real database
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
  await dbInsertActivity(
    "bot",
    `Lead qualifier processed ${updated} real lead(s) — ${hot} above threshold ${MIN_SCORE}.`,
  ).catch(() => {});

  log(`✅ qualified ${updated} lead(s) (${hot} hot) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  await dbInsertActivity("system", `Lead qualifier error: ${e.message}`).catch(() => {});
  process.exit(0); // never break the workflow
}
