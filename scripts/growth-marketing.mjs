#!/usr/bin/env node
/**
 * Autonomous Growth & Marketing Agent — REAL DATA ONLY, SELF-LEARNING.
 * Runs daily via GitHub Actions (or manually: npm run bot:growth).
 *
 * Modus operandi (all from REAL rows, never simulated):
 *  1. OBSERVE — reads the real pipeline: leads by channel/status, wins,
 *     losses, orders and MRR. Detects the current growth bottleneck
 *     (no traffic → no leads → no qualification → no conversion → no
 *     repeat revenue) and targets the stage with the worst real ratio.
 *  2. RECALL — loads its own campaign memory: which channel mixes and
 *     campaign plays were recommended before, and what happened after
 *     (conversion deltas from real outcomes).
 *  3. PLAN — produces ONE concrete campaign play for the bottleneck stage
 *     (audience, channel mix, offer angle, success metric, kill criteria).
 *     AI when available; deterministic playbooks from real data otherwise.
 *  4. LEARN — persists the chosen play and the observed funnel snapshot so
 *     the next run can compare funnel deltas and keep what worked.
 *
 * Safety: it NEVER sends messages or publishes anywhere. Output is a plan
 * recorded in activity_log + agent_memory, awaiting human execution.
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
  parseJsonObject,
  supabase,
  supabaseReady,
} from "./bot-lib.mjs";

const log = createLogger("growth-marketing");

const started = Date.now();

function funnelSnapshot(leadRows, orderRows, clientRows) {
  const counts = { total: leadRows.length, new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
  const byChannel = {};
  for (const l of leadRows) {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
    const ch = l.channel || "unknown";
    byChannel[ch] = byChannel[ch] || { total: 0, won: 0, lost: 0, qualified: 0 };
    byChannel[ch].total += 1;
    if (l.status === "won") byChannel[ch].won += 1;
    if (l.status === "lost") byChannel[ch].lost += 1;
    if (l.status === "qualified" || l.status === "won") byChannel[ch].qualified += 1;
  }
  const paid = orderRows.filter((o) => o.status === "paid");
  return {
    leads: counts,
    byChannel,
    activeClients: clientRows.filter((c) => c.status === "active" || c.status === "trialing").length,
    mrr: clientRows
      .filter((c) => c.status === "active" || c.status === "trialing")
      .reduce((s, c) => s + (Number(c.mrr) || 0), 0),
    ordersPaid: paid.length,
    ordersPending: orderRows.length - paid.length,
  };
}

/** The stage with the worst real conversion is the bottleneck to attack. */
function detectBottleneck(snap) {
  if (snap.leads.total === 0) return { stage: "traffic", ratio: 0, note: "no leads captured yet" };
  const decided = snap.leads.won + snap.leads.lost;
  if (snap.leads.new > 0 && decided === 0) return { stage: "qualification", ratio: 0, note: "leads waiting, no decided outcomes yet" };
  if (snap.leads.contacted > 0 && snap.leads.qualified === 0) return { stage: "nurture", ratio: 0, note: "contacted but nobody qualified" };
  if (snap.leads.qualified > 0 && snap.leads.won === 0) return { stage: "closing", ratio: 0, note: "qualified but zero won deals" };
  const winRate = decided > 0 ? snap.leads.won / decided : 0;
  if (winRate < 0.3) return { stage: "closing", ratio: winRate, note: `win rate only ${(winRate * 100).toFixed(0)}%` };
  if (snap.ordersPending > snap.ordersPaid) return { stage: "collection", ratio: snap.ordersPaid / (snap.ordersPaid + snap.ordersPending), note: "more pending than paid orders" };
  return { stage: "scale", ratio: winRate, note: "funnel healthy — scale what works" };
}

const PLAYBOOKS = {
  traffic: {
    audience: "Founders of SMBs in the top lead niches (SaaS, Fintech) in Angola/Portugal",
    play: "Publish one SEO landing page per top niche with a niche-specific lead magnet, and share it in two founder communities where prior leads came from",
    metric: "new leads per week from the target niches",
    kill: "0 leads after 2 weeks of publishing",
  },
  qualification: {
    audience: "Leads stuck in status 'new' (they exist in the real leads table)",
    play: "Run the Lead Qualifier, then personally contact every lead above score 80 within 24h with a proposal draft",
    metric: "share of 'new' leads moved to 'contacted'",
    kill: "no movement after 5 days",
  },
  nurture: {
    audience: "Contacted-but-not-qualified leads",
    play: "Send a 3-step value sequence (case note, ROI checklist, invite to a 20-min audit call) from the outreach draft in the product pack",
    metric: "contacted → qualified conversion",
    kill: "no qualification in 10 days",
  },
  closing: {
    audience: "Qualified leads without a decision",
    play: "Offer a time-boxed pilot of the Professional plan with a concrete success metric agreed in writing; follow the deal-pitch template",
    metric: "qualified → won conversion",
    kill: "two consecutive pilot offers declined",
  },
  collection: {
    audience: "Clients with pending orders",
    play: "Send the payment reference with a one-line summary of delivered value and a Multicaixa/PayPay deep link; confirm manually on receipt",
    metric: "pending → paid orders",
    kill: "no payment after 7 days — escalate to a call",
  },
  scale: {
    audience: "Active clients and their peers",
    play: "Launch a referral ask: offer one free month per signed referral to the happiest active clients (highest MRR tenure first)",
    metric: "referral leads per week",
    kill: "0 referral leads after 2 weeks",
  },
};

try {
  log("📈 growth-marketing starting", { supabase: supabaseReady, gemini: geminiReady, blackbox: blackboxReady });

  if (!supabaseReady) {
    log("⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — cannot read real funnel data. Add repo secrets to enable real runs.");
    process.exit(0);
  }

  // 1) OBSERVE — real funnel rows
  const [{ data: leadRows, error: leadErr }, { data: orderRows, error: orderErr }, { data: clientRows, error: clientErr }] = await Promise.all([
    supabase.from("leads").select("channel, status, niche, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("orders").select("status, amount, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("clients").select("plan, mrr, status, created_at").order("created_at", { ascending: false }).limit(500),
  ]);
  if (leadErr) throw new Error(`fetch leads: ${leadErr.message}`);
  if (orderErr) log(`orders fetch failed (continuing with leads only): ${orderErr.message}`);
  if (clientErr) log(`clients fetch failed (continuing): ${clientErr.message}`);

  const snap = funnelSnapshot(leadRows ?? [], orderRows ?? [], clientRows ?? []);
  const bottleneck = detectBottleneck(snap);
  log("funnel snapshot:", JSON.stringify(snap));
  log("bottleneck:", JSON.stringify(bottleneck));

  // 2) RECALL — what did we plan before and how did the funnel move?
  const memory = await dbRecall("growth_marketing").catch(() => ({}));
  const lastPlay = memory.growth_marketing?.last_play ?? null;
  const lastSnap = memory.growth_marketing?.last_snapshot ?? null;
  // Lesson from the AI Teacher (Academy): the latest market brief, when present
  const marketBrief = memory.growth_marketing?.market_brief ?? null;
  if (marketBrief) {
    log("academy brief:", JSON.stringify(marketBrief));
  }
  // Mission from the AI Manager: today's objective, when assigned
  const mission = memory.growth_marketing?.mission ?? null;
  if (mission) {
    log("manager mission:", JSON.stringify(mission));
  }
  let delta = null;
  if (lastSnap && typeof lastSnap === "object") {
    delta = {
      leads: snap.leads.total - (lastSnap.leads?.total ?? 0),
      won: snap.leads.won - (lastSnap.leads?.won ?? 0),
      mrr: snap.mrr - (lastSnap.mrr ?? 0),
    };
    log("funnel delta since last run:", JSON.stringify(delta));
  }

  // 3) PLAN — one concrete campaign play for the bottleneck stage
  const fallback = PLAYBOOKS[bottleneck.stage] ?? PLAYBOOKS.scale;
  let plan = {
    stage: bottleneck.stage,
    audience: fallback.audience,
    play: fallback.play,
    metric: fallback.metric,
    kill: fallback.kill,
    channel_mix: bottleneck.stage === "traffic" ? ["SEO", "communities"] : ["direct outreach", "email (opted-in)"],
    generated_by: "playbook",
  };

  if (geminiReady || blackboxReady) {
    const context = [
      `REAL funnel snapshot: ${JSON.stringify(snap)}`,
      lastPlay ? `Previous play (repeat only if it was working): ${JSON.stringify(lastPlay)}` : "No previous play.",
      delta ? `Funnel delta since last run: ${JSON.stringify(delta)}` : "",
      `Current bottleneck: ${JSON.stringify(bottleneck)}`,
      marketBrief && typeof marketBrief === "object" ? `Academy market brief from the AI Teacher (latest lesson — apply it): ${JSON.stringify(marketBrief)}` : "",
      mission && typeof mission === "object" ? `Today's mission assigned by the AI Manager (respect the directive and priorities): ${JSON.stringify(mission)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const prompt = `You are the growth & marketing strategist of Fontes AI Admin Adjunta (AI admin automation for SMBs in Angola/Portugal, plans 12,500–83,330 AOA/month).
${context}
Design ONE concrete campaign play to attack the bottleneck stage. Respect these rules:
- Use only the real data above; never invent clients, results or case studies.
- Outreach only via opted-in/contacted channels; no mass unsolicited sending.
- Keep the play executable by a single person in under 4 hours.
Return STRICT JSON:
{"stage":"","audience":"","play":"","channel_mix":["",""],"metric":"","kill":""}`;
    const raw = await askAI(prompt, { json: true });
    const parsed = parseJsonObject(raw);
    if (parsed && typeof parsed.play === "string" && parsed.play.length > 10) {
      plan = {
        stage: String(parsed.stage ?? plan.stage).slice(0, 40),
        audience: String(parsed.audience ?? plan.audience).slice(0, 300),
        play: String(parsed.play).slice(0, 600),
        channel_mix: Array.isArray(parsed.channel_mix) ? parsed.channel_mix.map(String).slice(0, 4) : plan.channel_mix,
        metric: String(parsed.metric ?? plan.metric).slice(0, 200),
        kill: String(parsed.kill ?? plan.kill).slice(0, 200),
        generated_by: "ai",
      };
    } else {
      log("AI returned no usable plan — using deterministic playbook from real data");
    }
  }

  // 4) LEARN — persist the plan and today's snapshot for the next delta
  await dbRemember("growth_marketing", "last_play", { ...plan, updated_at: new Date().toISOString() });
  if (Object.keys(snap).length) {
    await dbRemember("growth_marketing", "last_snapshot", snap);
  }

  const summary = `Growth & marketing plan (${plan.stage}): ${plan.play} — metric: ${plan.metric}`;
  await dbInsertActivity("bot", `Growth & marketing: ${summary}`).catch((e) => {
    const diag = diagnoseSupabaseError(e?.message);
    log(diag ?? `could not log activity: ${e?.message}`);
  });

  log("✅ growth play stored:", JSON.stringify(plan, null, 2));
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  const diag = diagnoseSupabaseError(e.message);
  if (diag) log("💡", diag);
  await dbInsertActivity("system", `Growth & marketing error: ${e.message}`).catch(() => {});
  process.exit(0); // never break the workflow
}
