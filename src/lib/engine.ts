import type {
  Activity,
  Client,
  Lead,
  Metric,
  Order,
  ProductPackEvidence,
  ProductPackRisk,
  AgentPromptContext,
  AgentPromptPlan,
} from "../types";

// ---------- Analytics (all pure functions over REAL rows) ----------

export type SeriesPoint = { label: string; value: number };
export type RevenuePoint = { label: string; paid: number; pending: number };
export type FunnelStage = { stage: string; count: number };
export type IncomeRow = { source: string; paid: number; pending: number; orders: number; sharePct: number };
export type AgentRow = {
  name: string;
  schedule: string;
  runs: number;
  lastRun: string | null;
  lastMessage: string;
  stale: boolean;
};
export type Pulse = { leadsToday: number; ordersToday: number; collectedToday: number; botRunsToday: number };

// ---------- AI Academy (teacher agent + student curriculum) ----------

export type MemoryEntry = { agent: string; key: string; value: unknown; updated_at: string };

export type AcademySkill = { id: string; memoryKeys: string[]; learned: boolean };

export type AcademyStudent = {
  slug: string;
  agentName: string;
  skills: AcademySkill[];
  marketBrief: { value: unknown; updatedAt: string } | null;
  lessons: number;
  graduation: "enrolled" | "in_training" | "trained";
};

export type AcademyState = {
  teacherRuns: number;
  teacherLastRun: string | null;
  teacherLastMessage: string;
  teacherBriefsWritten: number;
  curriculumVersion: string;
  trainedCount: number;
  students: AcademyStudent[];
};

/**
 * The AI Academy curriculum: the skill areas each student agent must master
 * to sell autonomously, and which real `agent_memory` keys prove mastery.
 * The AI Teacher writes `market_brief` entries per agent after studying the
 * real market data — students act on the brief in their next scheduled run.
 */
const CURRICULUM: Array<{
  slug: string;
  agentName: string;
  skills: Array<{ id: string; memoryKeys: string[] }>;
}> = [
  {
    slug: "lead_qualifier",
    agentName: "Lead Qualifier",
    skills: [
      { id: "lead_scoring", memoryKeys: [] },
      { id: "channel_performance", memoryKeys: ["channel_bias"] },
      { id: "market_brief", memoryKeys: ["market_brief"] },
    ],
  },
  {
    slug: "growth_marketing",
    agentName: "Growth & Marketing",
    skills: [
      { id: "campaign_strategy", memoryKeys: ["last_play", "last_snapshot"] },
      { id: "funnel_diagnostics", memoryKeys: ["last_snapshot"] },
      { id: "market_brief", memoryKeys: ["market_brief"] },
    ],
  },
  {
    slug: "error_handler",
    agentName: "Error Handler",
    skills: [
      { id: "incident_triage", memoryKeys: [] },
      { id: "known_fixes", memoryKeys: ["known_fixes"] },
      { id: "market_brief", memoryKeys: ["market_brief"] },
    ],
  },
  {
    slug: "insight_engine",
    agentName: "Insight Engine",
    skills: [
      { id: "business_analytics", memoryKeys: [] },
      { id: "market_brief", memoryKeys: ["market_brief"] },
    ],
  },
];

/** The Teacher Agent's activity prefix (see scripts/teacher-agent.mjs). */
export const TEACHER_PREFIX = "AI Teacher";

/**
 * Academy state derived from REAL rows only: activity_log (teacher runs)
 * and agent_memory (what students have actually learned). No fabricated
 * progress — an agent that never received a brief is honestly "enrolled".
 */
export function academyState(activity: Activity[], memory: MemoryEntry[]): AcademyState {
  const teacherRunsRows = activity.filter((a) => a.kind === "bot" && a.message.startsWith(TEACHER_PREFIX));
  const briefs = memory.filter((m) => m.key === "market_brief");

  const students: AcademyStudent[] = CURRICULUM.map(({ slug, agentName, skills }) => {
    const memForAgent = memory.filter((m) => m.agent === slug);
    const learnedSkills: AcademySkill[] = skills.map((s) => ({
      id: s.id,
      memoryKeys: s.memoryKeys,
      learned: s.memoryKeys.length === 0 || s.memoryKeys.some((k) => memForAgent.some((m) => m.key === k)),
    }));
    const brief = briefs.find((b) => b.agent === slug) ?? null;
    // Base skills (no memory keys) are assumed from the agent's code and do
    // NOT count as observed learning — graduation only advances on real
    // memory rows. Honest cold start: no memory = enrolled.
    const anyLearned = learnedSkills.some((s) => s.memoryKeys.length > 0 && s.learned);
    return {
      slug,
      agentName,
      skills: learnedSkills,
      marketBrief: brief ? { value: brief.value, updatedAt: brief.updated_at } : null,
      lessons: memForAgent.length,
      graduation: brief ? "trained" : anyLearned ? "in_training" : "enrolled",
    };
  });

  return {
    teacherRuns: teacherRunsRows.length,
    teacherLastRun: teacherRunsRows[0]?.created_at ?? null,
    teacherLastMessage: teacherRunsRows[0]?.message ?? "",
    teacherBriefsWritten: briefs.length,
    curriculumVersion: "academy-v1",
    trainedCount: students.filter((s) => s.graduation === "trained").length,
    students,
  };
}

/** Freshness of a market brief in human terms (drives the UI badge). */
export function briefFreshness(updatedAt: string): "fresh" | "aging" | "stale" {
  const age = Date.now() - +new Date(updatedAt);
  return age < 7 * 86400000 ? "fresh" : age < 30 * 86400000 ? "aging" : "stale";
}

// ---------- Operations (AI Manager missions, delivery QA, skills.sh) ----------

export type DeliveryRow = {
  id: string;
  client_name: string;
  pack: string;
  method: string;
  amount: number;
  qa_status: "pending" | "passed" | "failed";
  checks: Record<string, boolean>;
  notes: string | null;
  verified_at: string | null;
  created_at: string;
};

export type MissionRow = { agent: string; value: Record<string, unknown>; updated_at: string };
export type SkillEntryRow = { agent: string; value: Record<string, unknown>; updated_at: string };

export type OpsState = {
  missions: MissionRow[];
  skills: SkillEntryRow[];
  deliveries: DeliveryRow[];
  qaPending: number;
  qaPassed: number;
  qaFailed: number;
  scoutLastRun: string | null;
};

const MANAGED_AGENTS = ["lead_qualifier", "growth_marketing", "insight_engine", "error_handler"] as const;

/**
 * Operations state derived from REAL rows only: missions + skill entries
 * live in agent_memory, QA state in delivery_status. Honest zeros when the
 * manager/scout have not run yet.
 */
export function opsState(memory: MemoryEntry[], deliveries: DeliveryRow[]): OpsState {
  const managed = new Set<string>(MANAGED_AGENTS);
  const pick = (key: string): MissionRow[] =>
    memory
      .filter(
        (m) =>
          m.key === key && managed.has(m.agent) && m.value && typeof m.value === "object" && !Array.isArray(m.value),
      )
      .map((m) => ({ agent: m.agent, value: m.value as Record<string, unknown>, updated_at: m.updated_at }));

  const missions = pick("mission");
  const skills = pick("skill_entry");

  return {
    missions,
    skills,
    deliveries,
    qaPending: deliveries.filter((d) => d.qa_status === "pending").length,
    qaPassed: deliveries.filter((d) => d.qa_status === "passed").length,
    qaFailed: deliveries.filter((d) => d.qa_status === "failed").length,
    scoutLastRun: skills.length ? (skills.map((s) => s.updated_at).sort()[skills.length - 1] ?? null) : null,
  };
}

/** Skill entry freshness (drives the Operações badge). */
export function skillFreshness(updatedAt: string): "fresh" | "aging" | "stale" {
  return briefFreshness(updatedAt);
}
export type OnboardingStep = { id: string; label: string; description: string; done: boolean };

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function lastNDays(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function shortDay(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

/** Leads captured per day over the last N days (real rows only). */
export function leadsPerDay(leads: Lead[], days = 14): SeriesPoint[] {
  const keys = lastNDays(days);
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const l of leads) {
    const k = dayKey(l.created_at);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return keys.map((k) => ({ label: shortDay(k), value: counts.get(k) ?? 0 }));
}

/** Paid vs pending order volume per day (real rows only). */
export function revenuePerDay(orders: Order[], days = 14): RevenuePoint[] {
  const keys = lastNDays(days);
  const paid = new Map<string, number>(keys.map((k) => [k, 0]));
  const pending = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const o of orders) {
    const k = dayKey(o.created_at);
    if (!paid.has(k)) continue;
    if (o.status === "paid") paid.set(k, (paid.get(k) ?? 0) + o.amount);
    else if (o.status === "pending") pending.set(k, (pending.get(k) ?? 0) + o.amount);
  }
  return keys.map((k) => ({ label: shortDay(k), paid: paid.get(k) ?? 0, pending: pending.get(k) ?? 0 }));
}

/** Sales pipeline funnel from real lead statuses. */
export function pipelineFunnel(leads: Lead[]): FunnelStage[] {
  const stageOf = (s: Lead["status"]): string | null =>
    s === "new"
      ? "Captured"
      : s === "contacted"
        ? "Contacted"
        : s === "qualified"
          ? "Qualified"
          : s === "won"
            ? "Won"
            : null;
  const order: Array<"Captured" | "Contacted" | "Qualified" | "Won"> = ["Captured", "Contacted", "Qualified", "Won"];
  const counts = new Map<string, number>(order.map((s) => [s, 0]));
  for (const l of leads) {
    const s = stageOf(l.status);
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  // Funnel semantics: each stage counts leads that reached it or beyond.
  const reached = (target: string): number => {
    const idx = order.indexOf(target as (typeof order)[number]);
    return order.slice(idx).reduce((sum, s) => sum + (counts.get(s) ?? 0), 0);
  };
  return order.map((s) => ({ stage: s, count: reached(s) }));
}

/** Income table: where real collected money comes from — by payment method. */
export function incomeByMethod(orders: Order[]): IncomeRow[] {
  return incomeRows(orders, (o) => o.method);
}

/** Income table: where real collected money comes from — by client. */
export function incomeByClient(orders: Order[]): IncomeRow[] {
  return incomeRows(orders, (o) => o.client_name || "Walk-in");
}

function incomeRows(orders: Order[], keyOf: (o: Order) => string): IncomeRow[] {
  const groups = new Map<string, { paid: number; pending: number; orders: number }>();
  for (const o of orders) {
    const k = keyOf(o);
    const g = groups.get(k) ?? { paid: 0, pending: 0, orders: 0 };
    if (o.status === "paid") g.paid += o.amount;
    else if (o.status === "pending") g.pending += o.amount;
    g.orders += 1;
    groups.set(k, g);
  }
  const totalPaid = [...groups.values()].reduce((s, g) => s + g.paid, 0) || 1;
  return [...groups.entries()]
    .map(([source, g]) => ({
      source,
      paid: g.paid,
      pending: g.pending,
      orders: g.orders,
      sharePct: Math.round((g.paid / totalPaid) * 100),
    }))
    .sort((a, b) => b.paid - a.paid || b.pending - a.pending);
}

/** Recurring revenue by plan (real clients, active + trialing). */
export function mrrByPlan(clients: Client[]): SeriesPoint[] {
  const plans = ["starter", "professional", "enterprise"] as const;
  return plans.map((p) => ({
    label: p,
    value: clients
      .filter((c) => c.plan === p && (c.status === "active" || c.status === "trialing"))
      .reduce((s, c) => s + c.mrr, 0),
  }));
}

/**
 * AI agent managers, derived from REAL activity_log rows. No fabricated runs:
 * if a bot never ran, its row says so honestly. `stale` is true when the last
 * recorded run is missing or older than 36h (slack above the daily cadence).
 */
export function agentStatus(activity: Activity[]): AgentRow[] {
  const defs: Array<{ name: string; schedule: string; match: (m: string) => boolean }> = [
    { name: "Lead Qualifier", schedule: "daily 06:00 UTC", match: (m) => m.startsWith("Lead qualifier") },
    { name: "Insight Engine", schedule: "daily 06:00 UTC", match: (m) => m.startsWith("Insight engine") },
    { name: "Error Handler", schedule: "hourly", match: (m) => m.startsWith("Error handler") },
    {
      name: "Growth & Marketing",
      schedule: "daily 06:00 UTC",
      match: (m) =>
        m.startsWith("Growth & marketing") || m.startsWith("Growth & Marketing") || m.startsWith("Growth agent"),
    },
  ];
  const now = Date.now();
  return defs.map(({ name, schedule, match }) => {
    const last = activity.find((a) => a.kind === "bot" && match(a.message));
    return {
      name,
      schedule,
      runs: activity.filter((a) => a.kind === "bot" && match(a.message)).length,
      lastRun: last?.created_at ?? null,
      lastMessage: last
        ? last.message.replace(/ ?\|\|\| AUDIO_BRIEFING_URL=\S+/, "")
        : "No runs recorded yet — waiting for the scheduled GitHub Actions job",
      stale: last === undefined || now - +new Date(last.created_at) > 36 * 3600000,
    };
  });
}

// ---------- Core metrics ----------

export function computeMetrics(leads: Lead[], clients: Client[], orders: Order[]): Metric {
  const qualified = leads.filter((l) => l.status === "qualified" || l.status === "won");
  const won = leads.filter((l) => l.status === "won");
  const active = clients.filter((c) => c.status === "active" || c.status === "trialing");
  const mrr = active.reduce((sum, c) => sum + c.mrr, 0);

  const cutoff = Date.now() - 30 * 86400000;
  const revenue30d = orders
    .filter((o) => o.status === "paid" && +new Date(o.created_at) >= cutoff)
    .reduce((sum, o) => sum + o.amount, 0);

  return {
    leads: leads.length,
    qualifiedLeads: qualified.length,
    activeClients: active.length,
    mrr,
    revenue30d,
    winRate: leads.length ? Math.round((won.length / leads.length) * 100) : 0,
  };
}

export function scoreLead(lead: { score: number; status: Lead["status"]; channel: string; niche: string }): {
  tier: "hot" | "warm" | "cold";
  action: string;
} {
  let score = lead.score;
  if (lead.channel === "referral") score += 8;
  if (lead.channel === "linkedin") score += 4;
  if (lead.niche === "SaaS" || lead.niche === "Fintech") score += 6;

  const tier = score >= 80 ? "hot" : score >= 60 ? "warm" : "cold";
  const action =
    tier === "hot"
      ? "Send proposal within 24h"
      : tier === "warm"
        ? "Schedule demo this week"
        : "Nurture via email sequence";
  return { tier, action };
}

export const PLAN_PRICES = {
  starter: { monthly: 1250, label: "Starter", users: 10 },
  professional: { monthly: 2916, label: "Professional", users: 50 },
  enterprise: { monthly: 8333, label: "Enterprise", users: 999 },
} as const;

export function formatKz(n: number): string {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * The live pulse of the business TODAY (UTC day) — what is actually happening
 * online right now: captures, sales created, money collected, bot runs.
 * All from real rows; zeros are real zeros on a quiet day, never simulated.
 */
export function todayPulse(leads: Lead[], orders: Order[], activity: Activity[]): Pulse {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const today = startOfDay.toISOString();
  const isToday = (iso: string) => iso >= today;
  const botRuns = activity.filter((a) => a.kind === "bot" && isToday(a.created_at)).length;
  return {
    leadsToday: leads.filter((l) => isToday(l.created_at)).length,
    ordersToday: orders.filter((o) => isToday(o.created_at)).length,
    collectedToday: orders
      .filter((o) => o.status === "paid" && isToday(o.created_at))
      .reduce((s, o) => s + o.amount, 0),
    botRunsToday: botRuns,
  };
}

/**
 * Real activation steps for a cold-start ecosystem: each step reflects an
 * actual state of the database (no fake checkmarks). A step is "done" only
 * when real data proves it. The first unfinished step is the next action.
 */
export function onboardingSteps(
  leads: Lead[],
  clients: Client[],
  orders: Order[],
  activity: Activity[],
): OnboardingStep[] {
  const has = (arr: unknown[]) => arr.length > 0;
  const agents = agentStatus(activity);
  return [
    {
      id: "leads",
      label: "Capture your first lead",
      description: "Share the public lead form — every submission lands here in real time.",
      done: has(leads),
    },
    {
      id: "clients",
      label: "Register your first client",
      description:
        "Add a real client in the Clients tab (Starter 1.250 Kz, Professional 2.916 Kz, Enterprise 8.333 Kz per month).",
      done: has(clients),
    },
    {
      id: "orders",
      label: "Record your first sale",
      description:
        "Create a real order in the Orders tab only after the payment provider and product availability have been verified.",
      done: has(orders),
    },
    {
      id: "collect",
      label: "Collect your first payment",
      description: "Mark an order as paid once the money arrives — revenue charts and income tables update instantly.",
      done: has(orders.filter((o) => o.status === "paid")),
    },
    {
      id: "agents",
      label: "Agents complete their first cycle",
      description:
        "The autonomous bots run on GitHub Actions (daily 06:00 UTC + hourly). Their first real runs appear here and in the AI Agents tab.",
      done: has(agents.filter((a) => a.runs > 0)),
    },
  ];
}

export function productPackEvidence(
  leads: Lead[],
  clients: Client[],
  orders: Order[],
  activity: Activity[],
): ProductPackEvidence[] {
  const verifiedAt = new Date().toISOString();
  const freshness = (dates: string[]): ProductPackEvidence["freshness"] => {
    if (!dates.length) return "unavailable";
    const age = Date.now() - Math.max(...dates.map((date) => +new Date(date)));
    return age < 7 * 86400000 ? "fresh" : age < 30 * 86400000 ? "aging" : "stale";
  };
  const evidence: ProductPackEvidence[] = [
    {
      source: "leads",
      recordCount: leads.length,
      recordIds: leads.map((lead) => lead.id),
      observedSignal: leads.length
        ? `${leads.length} real lead records are available for pattern review.`
        : "No lead records are available.",
      confidence: leads.length >= 10 ? "high" : leads.length >= 3 ? "medium" : "low",
      freshness: freshness(leads.map((lead) => lead.created_at)),
      verifiedAt,
    },
    {
      source: "clients",
      recordCount: clients.length,
      recordIds: clients.map((client) => client.id),
      observedSignal: clients.length
        ? `${clients.length} real client records can inform buyer-fit review.`
        : "No client records are available.",
      confidence: clients.length >= 5 ? "high" : clients.length ? "medium" : "low",
      freshness: freshness(clients.map((client) => client.created_at)),
      verifiedAt,
    },
    {
      source: "orders",
      recordCount: orders.length,
      recordIds: orders.map((order) => order.id),
      observedSignal: orders.length
        ? `${orders.filter((order) => order.status === "paid").length} paid order records can inform offer evidence.`
        : "No order records are available.",
      confidence: orders.length >= 5 ? "high" : orders.length ? "medium" : "low",
      freshness: freshness(orders.map((order) => order.created_at)),
      verifiedAt,
    },
    {
      source: "activity",
      recordCount: activity.length,
      recordIds: activity.map((item) => item.id),
      observedSignal: activity.length
        ? `${activity.length} activity records are available for operational context.`
        : "No activity records are available.",
      confidence: activity.length >= 10 ? "high" : activity.length ? "medium" : "low",
      freshness: freshness(activity.map((item) => item.created_at)),
      verifiedAt,
    },
  ];
  return evidence;
}

export function productPackRisks(evidence: ProductPackEvidence[], hasTargetMarket: boolean): ProductPackRisk[] {
  const risks: ProductPackRisk[] = [];
  const totalRecords = evidence.reduce((sum, item) => sum + item.recordCount, 0);
  if (!totalRecords)
    risks.push({
      id: "no-evidence",
      label: "Insufficient evidence",
      detail: "Connect or load real records before claiming market demand.",
      severity: "high",
      blocking: true,
    });
  if (!hasTargetMarket)
    risks.push({
      id: "market",
      label: "Target market incomplete",
      detail: "Define audience and customer problem before assembly.",
      severity: "medium",
      blocking: true,
    });
  if (evidence.some((item) => item.freshness === "stale"))
    risks.push({
      id: "stale",
      label: "Stale evidence",
      detail: "Some records are older than 30 days and need review.",
      severity: "medium",
      blocking: true,
    });
  risks.push({
    id: "channels",
    label: "External channels gated",
    detail: "Email, Shopify and social publishing require authorization.",
    severity: "low",
    blocking: false,
  });
  return risks;
}

const AGENT_STATIC_SYSTEM = [
  "You are a professional, evidence-first product operations agent.",
  "Use only verified records supplied in the dynamic context.",
  "Never invent market demand, customers, outcomes, sources, or completed actions.",
  "When evidence is missing, state insufficient evidence and recommend an authorized data source.",
  "Draft before acting; publishing, outreach, purchasing, and account changes require explicit authorization.",
  "Return concise reasoning with source IDs and freshness when making a recommendation.",
].join("\\n");

const AGENT_TOOLS = [
  "inspect_verified_records",
  "assemble_product_pack",
  "record_learning",
  "prepare_approval_request",
] as const;

function contextClock(date = new Date()): string {
  return date.toISOString().slice(0, 13);
}

export function buildAgentPromptPlan(input: {
  agent: string;
  sessionId: string;
  currentTask: string;
  leads: Lead[];
  clients: Client[];
  orders: Order[];
  activity: Activity[];
  memoryCount: number;
}): AgentPromptPlan {
  const dynamicContext: AgentPromptContext = {
    agent: input.agent,
    sessionId: input.sessionId,
    currentTask: input.currentTask,
    facts: [
      ...input.leads.slice(0, 20).map((lead) => ({
        key: `lead:${lead.id}`,
        value: `${lead.company} · ${lead.niche} · ${lead.status}`,
        source: "leads",
        observedAt: lead.created_at,
        confidence: "medium" as const,
      })),
      ...input.orders.slice(0, 20).map((order) => ({
        key: `order:${order.id}`,
        value: `${order.status} · ${order.amount} ${order.currency}`,
        source: "orders",
        observedAt: order.created_at,
        confidence: order.status === "paid" ? ("high" as const) : ("medium" as const),
      })),
    ],
    recordCounts: {
      leads: input.leads.length,
      clients: input.clients.length,
      orders: input.orders.length,
      activity: input.activity.length,
      memory: input.memoryCount,
    },
    contextClock: contextClock(),
  };
  const dynamicBytes = JSON.stringify(dynamicContext).length;
  return {
    staticSystem: AGENT_STATIC_SYSTEM,
    dynamicContext,
    tools: [...AGENT_TOOLS],
    cacheKey: `agent:${input.agent}:static:v1`,
    cacheableBytes: AGENT_STATIC_SYSTEM.length + JSON.stringify(AGENT_TOOLS).length + dynamicBytes,
  };
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
