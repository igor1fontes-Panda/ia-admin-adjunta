#!/usr/bin/env node
/**
 * AI MANAGER (Gestor Autónomo de Operações) — REAL DATA ONLY.
 * Runs daily via GitHub Actions (or manually: npm run bot:manager).
 *
 * The boss of the AI team: it does NOT wait for humans to tell the agents
 * what to do. It runs BEFORE the daily shift and assigns a concrete mission
 * to every student agent through `agent_memory` (the same channel the AI
 * Teacher uses for lessons), so each agent picks its mission up on its
 * next scheduled run — autonomously, with no administrative approval.
 *
 * Missions (all derived from REAL funnel rows, never simulated):
 *  - lead_qualifier    → hunt/qualify leads for the best-selling packs
 *  - growth_marketing  → run the campaign that attacks the real bottleneck
 *  - insight_engine    → audit the real funnel and report risks/opportunities
 *  - error_handler     → verify EVERY registered pack is delivered and
 *                        functional for the client (REAL QA, see below)
 *
 * Pack sales registration (automatic, no human approval needed):
 *  - every PAID order becomes a delivery_status row (pending QA);
 *  - new clients found in sales but missing from the clients table are
 *    registered automatically (plan inferred from paid amount);
 *  - the manager records `packs_sold` with its real best-seller ranking.
 *
 * Safety: it never sends anything to customers. It writes plans, missions
 * and QA registrations — all auditable in agent_memory/activity_log.
 */
import {
  askAI,
  blackboxReady,
  dbInsertActivity,
  dbRecall,
  dbRemember,
  diagnoseSupabaseError,
  geminiReady,
  log,
  parseJsonObject,
  supabase,
  supabaseReady,
} from "./bot-lib.mjs";

const started = Date.now();

const PACK_SKILLS = {
  qualification: "lead qualification",
  closing: "deal closing and negotiation",
  nurture: "outreach and follow-up sequences",
  traffic: "audience growth and campaign strategy",
  collection: "payment follow-up and invoicing",
  scale: "referral programs and client retention",
};

function funnelSnapshot(leadRows, orderRows, clientRows, deliveryRows) {
  const counts = { total: leadRows.length, new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
  for (const l of leadRows) counts[l.status] = (counts[l.status] ?? 0) + 1;
  const paid = orderRows.filter((o) => o.status === "paid");
  const activeClients = clientRows.filter((c) => c.status === "active" || c.status === "trialing");
  return {
    leads: counts,
    activeClients: activeClients.length,
    mrr: activeClients.reduce((s, c) => s + (Number(c.mrr) || 0), 0),
    ordersPaid: paid.length,
    ordersPending: orderRows.length - paid.length,
    packsPendingQa: deliveryRows.filter((d) => d.qa_status === "pending").length,
    packsPassed: deliveryRows.filter((d) => d.qa_status === "passed").length,
    packsFailed: deliveryRows.filter((d) => d.qa_status === "failed").length,
  };
}

function detectBottleneck(snap) {
  if (snap.leads.total === 0) return "traffic";
  const decided = snap.leads.won + snap.leads.lost;
  if (snap.leads.new > 0 && decided === 0) return "qualification";
  if (snap.leads.contacted > 0 && snap.leads.qualified === 0) return "nurture";
  if (snap.leads.qualified > 0 && snap.leads.won === 0) return "closing";
  if (snap.leads.won / Math.max(1, decided) < 0.3) return "closing";
  if (snap.ordersPending > snap.ordersPaid) return "collection";
  return "scale";
}

/** Best-selling packs: real won leads per niche + real paid order volume. */
function bestSellers(leadRows, orderRows) {
  const won = {};
  for (const l of leadRows) if (l.status === "won") won[l.niche || "unknown"] = (won[l.niche || "unknown"] ?? 0) + 1;
  const volume = {};
  for (const o of orderRows) if (o.status === "paid") {
    const key = o.client_name || "walk-in";
    volume[key] = (volume[key] ?? 0) + (Number(o.amount) || 0);
  }
  return {
    niches: Object.entries(won).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => ({ pack: n, won: c })),
    clients: Object.entries(volume).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => ({ client: c, revenue: v })),
  };
}

/** Plan inferred from the real paid amount (engine pricing). */
function planForAmount(amount) {
  if (amount >= 8333) return "enterprise";
  if (amount >= 2916) return "professional";
  return "starter";
}

try {
  log("🧑‍💼 ops-manager starting", { supabase: supabaseReady, gemini: geminiReady, blackbox: blackboxReady });

  if (!supabaseReady) {
    log("⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — cannot read real data. Nothing simulated.");
    process.exit(0);
  }

  // 1) OBSERVE — the whole real operation
  const [{ data: leadRows, error: leadErr }, { data: orderRows, error: orderErr }, { data: clientRows, error: clientErr }, { data: deliveryRows, error: delErr }] = await Promise.all([
    supabase.from("leads").select("channel, status, niche, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("orders").select("id, client_id, client_name, amount, status, method, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("clients").select("id, name, email, plan, mrr, status").limit(500),
    supabase.from("delivery_status").select("order_id, qa_status").limit(500).then(
      (r) => r,
      () => ({ data: [], error: null }),
    ),
  ]);
  if (leadErr) throw new Error(`fetch leads: ${leadErr.message}`);
  if (orderErr) throw new Error(`fetch orders: ${orderErr.message}`);
  if (clientErr) log(`clients fetch failed (continuing): ${clientErr.message}`);
  let deliveries = deliveryRows ?? [];
  if (delErr) {
    log(`delivery_status not available yet (run migration 0005): ${delErr.message}`);
    deliveries = [];
  }

  const snap = funnelSnapshot(leadRows ?? [], orderRows ?? [], clientRows ?? [], deliveries);
  const bottleneck = detectBottleneck(snap);
  const sellers = bestSellers(leadRows ?? [], orderRows ?? []);
  log("operation snapshot:", JSON.stringify(snap));
  log("bottleneck:", bottleneck, "| best sellers:", JSON.stringify(sellers));

  // 2) REGISTER SOLD PACKS AUTOMATICALLY — every paid order needs delivery QA
  const clientByName = new Map((clientRows ?? []).map((c) => [String(c.name).toLowerCase(), c]));
  let registered = 0;
  let autoClients = 0;
  for (const o of (orderRows ?? []).filter((x) => x.status === "paid")) {
    if (deliveries.some((d) => d.order_id === o.id)) continue;

    let clientId = o.client_id ?? null;
    if (!clientId && o.client_name && clientByName.has(String(o.client_name).toLowerCase())) {
      clientId = clientByName.get(String(o.client_name).toLowerCase()).id;
    }
    // Auto-register clients found in sales but missing from the roster
    if (!clientId && o.client_name && !clientByName.has(String(o.client_name).toLowerCase())) {
      const plan = planForAmount(Number(o.amount) || 0);
      const { data: created, error: insErr } = await supabase
        .from("clients")
        .insert({ name: o.client_name, email: `client+${o.id.slice(0, 8)}@sales.local`, plan, mrr: Number(o.amount) || 0, status: "active" })
        .select("id")
        .single();
      if (!insErr && created) {
        clientId = created.id;
        autoClients += 1;
        clientByName.set(String(o.client_name).toLowerCase(), created);
        log(`auto-registered client "${o.client_name}" (plan ${plan}) from a real paid order`);
      } else {
        log(`could not auto-register client for order ${o.id}: ${insErr?.message ?? "unknown"}`);
      }
    }

    const { error } = await supabase.from("delivery_status").insert({
      client_id: clientId,
      order_id: o.id,
      client_name: o.client_name || "Walk-in",
      pack: planForAmount(Number(o.amount) || 0),
      method: o.method || "unknown",
      amount: Number(o.amount) || 0,
      qa_status: "pending",
      notes: "Auto-registered by the AI Manager from a real paid order.",
    });
    if (error) {
      log(`delivery insert failed for order ${o.id}: ${error.message}`);
      continue;
    }
    registered += 1;
  }
  log(`sold packs registered for QA: ${registered} (${autoClients} client(s) auto-registered)`);

  // 3) ASSIGN MISSIONS — the team acts on its own, humans are informed after
  const memory = await dbRecall().catch(() => ({}));
  const missionBase = {
    assigned_by: "ai_manager",
    assigned_at: new Date().toISOString(),
    bottleneck,
    snapshot: {
      leads: snap.leads.total,
      won: snap.leads.won,
      clients: snap.activeClients,
      mrr: Math.round(snap.mrr),
      packs_pending_qa: snap.packsPendingQa,
      packs_failed: snap.packsFailed,
    },
  };

  const missions = {
    lead_qualifier: {
      ...missionBase,
      objective: "capture and qualify real leads for the best-selling packs",
      best_sellers: sellers,
      focus_skills: ["lead qualification", PACK_SKILLS[bottleneck] ?? "lead qualification"],
      directive: `Prioritize leads in the top-selling niches (${sellers.niches.map((n) => n.pack).join(", ") || "all niches"}) and keep hot leads above 80 moving within 24h.`,
    },
    growth_marketing: {
      ...missionBase,
      objective: "attack the current funnel bottleneck with one concrete campaign",
      focus_skills: [PACK_SKILLS[bottleneck] ?? "audience growth", "campaign strategy"],
      directive: `The funnel bottleneck is "${bottleneck}". Design and record the campaign play for it; repeat plays that moved real numbers and kill the ones that did not.`,
    },
    insight_engine: {
      ...missionBase,
      objective: "audit the real operation and report risks and opportunities",
      focus_skills: ["business analytics", "market awareness"],
      directive: `Audit today's snapshot, verify agent progress (missions, lessons, QA) and report the single biggest risk and the single biggest opportunity with real numbers.`,
    },
    error_handler: {
      ...missionBase,
      objective: "verify every sold pack is delivered and functional for the client",
      focus_skills: ["delivery verification", "quality assurance"],
      directive: `Run the delivery QA pass: every delivery_status row pending must get a REAL functional verdict (passed/failed) before the next daily cycle. ${snap.packsPendingQa} pack(s) awaiting verification.`,
      pending_qa: snap.packsPendingQa,
    },
  };

  let assigned = 0;
  for (const [agent, mission] of Object.entries(missions)) {
    await dbRemember(agent, "mission", mission);
    assigned += 1;
    log(`mission assigned → ${agent}: ${mission.objective}`);
  }

  // 4) LOG — everything visible in the Operações module
  const summary = `AI Manager: ${assigned} missions assigned (bottleneck: ${bottleneck}), ${registered} sold pack(s) registered for delivery QA, ${autoClients} client(s) auto-registered.`;
  await dbInsertActivity("bot", summary).catch((e) => {
    const diag = diagnoseSupabaseError(e?.message);
    log(diag ?? `could not log activity: ${e?.message}`);
  });

  log(`✅ ops-manager done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  const diag = diagnoseSupabaseError(e.message);
  if (diag) log("💡", diag);
  await dbInsertActivity("system", `AI Manager error: ${e.message}`).catch(() => {});
  process.exit(0);
}
