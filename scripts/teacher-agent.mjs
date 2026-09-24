#!/usr/bin/env node
/**
 * AI TEACHER AGENT (Academia IA) — REAL DATA ONLY, AUTONOMOUS.
 * Runs daily via GitHub Actions (or manually: npm run bot:teacher).
 *
 * Modus operandi (all from REAL rows, never simulated):
 *  1. OBSERVE — studies the real market the students operate in: funnel
 *     rows (leads/clients/orders), plus what every student agent has
 *     already learned in `agent_memory`.
 *  2. DIAGNOSE — for each student agent, finds its knowledge gaps:
 *     which curriculum skills have no real memory entry yet, and which
 *     known learnings are stale (> 14 days).
 *  3. TEACH — writes ONE `market_brief` lesson per student into
 *     `agent_memory`: what changed in the market, what the student
 *     should do differently in its next run, and what NOT to repeat.
 *     AI when available; deterministic curriculum briefs otherwise.
 *  4. LOG — records the class session in activity_log ("AI Teacher: …")
 *     so the dashboard Academy submenu shows the real teaching history.
 *
 * Autonomy: needs NO administrative approval — teaching is read-only
 * over the business data and only appends lessons to agent_memory.
 * It never contacts customers and never mutates business tables.
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

const log = createLogger("teacher-agent");

const started = Date.now();
const STALE_MS = 14 * 24 * 3600 * 1000; // a lesson older than 14d is stale

/** The curriculum the teacher teaches from (mirrors engine.ts CURRICULUM). */
const CURRICULUM = [
  {
    slug: "lead_qualifier",
    name: "Lead Qualifier",
    skills: ["lead scoring", "channel performance", "market awareness"],
    guidance:
      "The brief should update channel priorities and what makes a lead hot in the CURRENT market (niches in demand, offer angles that convert now).",
  },
  {
    slug: "growth_marketing",
    name: "Growth & Marketing",
    skills: ["campaign strategy", "funnel diagnostics", "market awareness"],
    guidance:
      "The brief should update which channels/audiences are responsive right now and how the pitch should adapt to current market conditions.",
  },
  {
    slug: "error_handler",
    name: "Error Handler",
    skills: ["incident triage", "known fixes", "market awareness"],
    guidance:
      "The brief should note recurring operational risks in the current growth phase (e.g. surging lead volume, new payment flows) and what to watch for.",
  },
  {
    slug: "insight_engine",
    name: "Insight Engine",
    skills: ["business analytics", "market awareness"],
    guidance:
      "The brief should give the analyst fresh market context: where the business stands, what moved, what the market rewards this week.",
  },
];

function funnelSnapshot(leadRows, orderRows, clientRows) {
  const counts = { total: leadRows.length, new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
  const byChannel = {};
  const niches = {};
  for (const l of leadRows) {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
    const ch = l.channel || "unknown";
    byChannel[ch] = byChannel[ch] || { total: 0, won: 0, qualified: 0 };
    byChannel[ch].total += 1;
    if (l.status === "won") byChannel[ch].won += 1;
    if (l.status === "qualified" || l.status === "won") byChannel[ch].qualified += 1;
    const n = l.niche || "unknown";
    niches[n] = (niches[n] ?? 0) + 1;
  }
  const paid = orderRows.filter((o) => o.status === "paid");
  return {
    leads: counts,
    byChannel,
    topNiches: Object.entries(niches)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([n, c]) => ({ niche: n, leads: c })),
    activeClients: clientRows.filter((c) => c.status === "active" || c.status === "trialing").length,
    mrr: clientRows
      .filter((c) => c.status === "active" || c.status === "trialing")
      .reduce((s, c) => s + (Number(c.mrr) || 0), 0),
    ordersPaid: paid.length,
    revenue30d: paid
      .filter((o) => new Date(o.created_at).getTime() >= Date.now() - 30 * 86400000)
      .reduce((s, o) => s + (Number(o.amount) || 0), 0),
  };
}

try {
  log("🎓 teacher-agent starting", { supabase: supabaseReady, gemini: geminiReady, blackbox: blackboxReady });

  if (!supabaseReady) {
    log(
      "⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — cannot read real market data. Nothing simulated; add repo secrets to enable real classes.",
    );
    process.exit(0);
  }

  // 1) OBSERVE — real market data + current knowledge of every student
  const [
    { data: leadRows, error: leadErr },
    { data: orderRows, error: orderErr },
    { data: clientRows, error: clientErr },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("channel, status, niche, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("orders").select("status, amount, created_at").order("created_at", { ascending: false }).limit(500),
    supabase
      .from("clients")
      .select("plan, mrr, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (leadErr) throw new Error(`fetch leads: ${leadErr.message}`);
  if (orderErr) log(`orders fetch failed (continuing): ${orderErr.message}`);
  if (clientErr) log(`clients fetch failed (continuing): ${clientErr.message}`);

  const snap = funnelSnapshot(leadRows ?? [], orderRows ?? [], clientRows ?? []);
  log("market snapshot:", JSON.stringify(snap));

  const memory = await dbRecall(); // everything all agents learned so far
  log(`agent_memory rows: ${Object.values(memory).reduce((s, a) => s + Object.keys(a).length, 0)}`);

  // 2) DIAGNOSE — knowledge gaps and stale knowledge per student
  const now = Date.now();
  const lessons = [];
  for (const student of CURRICULUM) {
    const learned = memory[student.slug] ?? {};
    const keys = Object.keys(learned);
    const gaps = student.skills.filter((skill) => !keys.some((k) => learned[k] !== undefined && k !== "market_brief"));
    const staleKeys = keys.filter((k) => {
      const v = learned[k];
      return v && typeof v === "object" && typeof v.updated_at === "string"
        ? now - new Date(v.updated_at).getTime() > STALE_MS
        : false;
    });
    const previousBrief = learned.market_brief ?? null;
    lessons.push({ student, gaps, staleKeys, previousBrief, keys });
  }
  log(
    `diagnosis: ${lessons.map((l) => `${l.student.slug}: ${l.gaps.length} gaps, ${l.staleKeys.length} stale`).join(" | ")}`,
  );

  // 3) TEACH — one market_brief per student
  let taught = 0;
  for (const { student, gaps, staleKeys, previousBrief } of lessons) {
    const fallbackBrief = {
      lesson_date: new Date().toISOString().slice(0, 10),
      market_state: snap.leads.total
        ? `${snap.leads.total} leads (${snap.leads.won} won, ${snap.leads.qualified} qualified), top niches: ${snap.topNiches.map((n) => n.niche).join(", ") || "n/a"}`
        : "no leads captured yet — the priority is driving traffic to the public lead form",
      focus_skills: gaps.length ? gaps.join(", ") : "sharpen existing skills",
      instruction: student.guidance,
      avoid:
        previousBrief && typeof previousBrief === "object"
          ? "do not repeat strategies from the previous brief that produced no funnel movement"
          : "do not act on assumptions; only on recorded data",
      generated_by: "curriculum",
    };

    let brief = fallbackBrief;
    if (geminiReady || blackboxReady) {
      const prompt = `You are the AI Teacher of Fontes AI Admin Adjunta's agent academy (AI admin automation for SMBs in Angola/Portugal, plans 12,500–83,330 AOA/month).
You are teaching the "${student.name}" agent, whose job is: ${student.guidance}
REAL market data (current):
${JSON.stringify(snap)}
Student's knowledge gaps: ${gaps.length ? gaps.join(", ") : "none — sharpen mastery"}
Stale knowledge (older than 14 days): ${staleKeys.length ? staleKeys.join(", ") : "none"}
Previous brief (if any): ${previousBrief ? JSON.stringify(previousBrief) : "none"}
Write ONE concise lesson (max 150 words) that updates this agent for TODAY's market so it can help sell autonomously.
Return STRICT JSON:
{"lesson_date":"YYYY-MM-DD","market_state":"","focus_skills":"","instruction":"","avoid":""}`;
      const raw = await askAI(prompt, { json: true });
      const parsed = parseJsonObject(raw);
      if (parsed && typeof parsed.instruction === "string" && parsed.instruction.length > 10) {
        brief = {
          lesson_date: String(parsed.lesson_date ?? fallbackBrief.lesson_date).slice(0, 10),
          market_state: String(parsed.market_state ?? "").slice(0, 400),
          focus_skills: String(parsed.focus_skills ?? gaps.join(", ")).slice(0, 200),
          instruction: String(parsed.instruction).slice(0, 600),
          avoid: String(parsed.avoid ?? "").slice(0, 300),
          generated_by: "ai",
        };
      } else {
        log(`ai returned no usable brief for ${student.slug} — using curriculum brief`);
      }
    }

    await dbRemember(student.slug, "market_brief", brief);
    taught += 1;
    log(`🎓 taught ${student.slug}: ${brief.focus_skills}`);
  }

  // 4) LOG — the class session, visible in the dashboard Academy
  const summary = `AI Teacher: class session complete — ${taught}/${CURRICULUM.length} students received today's market brief (${snap.leads.total} leads, ${snap.activeClients} clients, MRR ${snap.mrr.toFixed(0)} AOA).`;
  await dbInsertActivity("bot", summary).catch((e) => {
    const diag = diagnoseSupabaseError(e?.message);
    log(diag ?? `could not log activity: ${e?.message}`);
  });

  log(`✅ teaching done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${taught} briefs written`);
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  const diag = diagnoseSupabaseError(e.message);
  if (diag) log("💡", diag);
  await dbInsertActivity("system", `AI Teacher error: ${e.message}`).catch(() => {});
  process.exit(0); // never break the workflow
}
