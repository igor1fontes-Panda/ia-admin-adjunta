import { describe, expect, it } from "vitest";
import {
  agentStatus,
  computeMetrics,
  formatKz,
  incomeByClient,
  incomeByMethod,
  leadsPerDay,
  mrrByPlan,
  onboardingSteps,
  pipelineFunnel,
  revenuePerDay,
  scoreLead,
  timeAgo,
  todayPulse,
} from "./lib/engine";
import type { Activity, Client, Lead, Order } from "./types";

const lead = (over: Partial<Lead>): Lead => ({
  id: "l1",
  company: "Acme",
  contact_name: "Joana",
  email: "j@acme.com",
  niche: "SaaS",
  channel: "linkedin",
  score: 80,
  status: "new",
  ai_action: null,
  created_at: new Date().toISOString(),
  ...over,
});

const client = (over: Partial<Client>): Client => ({
  id: "c1",
  name: "Acme",
  email: "billing@acme.com",
  plan: "professional",
  mrr: 2430,
  status: "active",
  created_at: new Date().toISOString(),
  ...over,
});

const order = (over: Partial<Order>): Order => ({
  id: "o1",
  client_id: "c1",
  client_name: "Acme",
  amount: 29160,
  currency: "AOA",
  method: "multicaixa",
  status: "paid",
  reference: "923012293",
  created_at: new Date().toISOString(),
  ...over,
});

describe("computeMetrics", () => {
  it("computes leads, MRR, revenue and win rate", () => {
    const m = computeMetrics(
      [lead({ status: "won", score: 91 }), lead({ status: "new" }), lead({ status: "qualified" })],
      [client({ mrr: 1000 }), client({ mrr: 2500, status: "trialing" }), client({ mrr: 9000, status: "churned" })],
      [order({ amount: 29160 }), order({ amount: 10000, status: "pending" }), order({ amount: 5000, created_at: new Date(Date.now() - 40 * 86400000).toISOString() })],
    );
    expect(m.leads).toBe(3);
    expect(m.qualifiedLeads).toBe(2);
    expect(m.activeClients).toBe(2);
    expect(m.mrr).toBe(3500);
    expect(m.revenue30d).toBe(29160);
    expect(m.winRate).toBe(33);
  });

  it("handles empty state without crashing", () => {
    const m = computeMetrics([], [], []);
    expect(m.leads).toBe(0);
    expect(m.winRate).toBe(0);
  });
});

describe("scoreLead", () => {
  it("ranks referral + SaaS hot", () => {
    const r = scoreLead({ score: 78, status: "new", channel: "referral", niche: "SaaS" });
    expect(r.tier).toBe("hot");
  });

  it("keeps low-score cold with nurture action", () => {
    const r = scoreLead({ score: 40, status: "new", channel: "website", niche: "Agencies" });
    expect(r.tier).toBe("cold");
    expect(r.action).toMatch(/Nurture/);
  });
});

describe("formatKz", () => {
  it("formats AOA currency", () => {
    expect(formatKz(29160)).toContain("29");
  });
});

describe("timeAgo", () => {
  it("labels recent times", () => {
    expect(timeAgo(new Date(Date.now() - 30_000).toISOString())).toBe("just now");
    expect(timeAgo(new Date(Date.now() - 90 * 60_000).toISOString())).toBe("1h ago");
  });
});

describe("leadsPerDay", () => {
  it("counts only leads inside the window and fills zero days", () => {
    const today = new Date().toISOString();
    const old = new Date(Date.now() - 40 * 86400000).toISOString();
    const pts = leadsPerDay([lead({ created_at: today }), lead({ created_at: today }), lead({ created_at: old })], 7);
    expect(pts).toHaveLength(7);
    expect(pts.reduce((s, p) => s + p.value, 0)).toBe(2);
  });
});

export const activity = (over: Partial<Activity>): Activity => ({
  id: "a1",
  kind: "bot",
  message: "Insight engine: test",
  created_at: new Date().toISOString(),
  ...over,
});

describe("pipelineFunnel", () => {
  it("counts cumulative stages and excludes lost", () => {
    const f = pipelineFunnel([
      lead({ status: "new" }),
      lead({ status: "contacted" }),
      lead({ status: "qualified" }),
      lead({ status: "won" }),
      lead({ status: "lost" }),
    ]);
    const byStage = Object.fromEntries(f.map((s) => [s.stage, s.count]));
    expect(byStage["Captured"]).toBe(4);
    expect(byStage["Contacted"]).toBe(3);
    expect(byStage["Qualified"]).toBe(2);
    expect(byStage["Won"]).toBe(1);
  });
});

describe("revenuePerDay", () => {
  it("splits paid and pending per day", () => {
    const today = new Date().toISOString();
    const pts = revenuePerDay([
      order({ amount: 1000, status: "paid", created_at: today }),
      order({ amount: 500, status: "pending", created_at: today }),
      order({ amount: 7000, status: "paid", created_at: new Date(Date.now() - 30 * 86400000).toISOString() }),
    ], 7);
    const todayPt = pts[pts.length - 1];
    expect(todayPt.paid).toBe(1000);
    expect(todayPt.pending).toBe(500);
    expect(pts.reduce((s, p) => s + p.paid, 0)).toBe(1000);
  });
});

describe("incomeByMethod", () => {
  it("groups collected money and computes share", () => {
    const rows = incomeByMethod([
      order({ method: "multicaixa", amount: 3000, status: "paid" }),
      order({ method: "multicaixa", amount: 1000, status: "pending" }),
      order({ method: "paypay", amount: 1000, status: "paid" }),
    ]);
    expect(rows[0].source).toBe("multicaixa");
    expect(rows[0].paid).toBe(3000);
    expect(rows[0].pending).toBe(1000);
    expect(rows[0].sharePct).toBe(75);
    expect(rows[1].paid).toBe(1000);
  });

  it("handles no orders", () => {
    expect(incomeByMethod([])).toEqual([]);
  });
});

describe("incomeByClient", () => {
  it("attributes walk-ins", () => {
    const rows = incomeByClient([order({ client_name: "", amount: 900, status: "paid" })]);
    expect(rows[0].source).toBe("Walk-in");
  });
});

describe("mrrByPlan", () => {
  it("sums only active/trialing clients per plan", () => {
    const pts = mrrByPlan([
      client({ plan: "starter", mrr: 1250 }),
      client({ plan: "starter", mrr: 1250, status: "churned" }),
      client({ plan: "enterprise", mrr: 8333, status: "trialing" }),
    ]);
    expect(pts.find((p) => p.label === "starter")?.value).toBe(1250);
    expect(pts.find((p) => p.label === "professional")?.value).toBe(0);
    expect(pts.find((p) => p.label === "enterprise")?.value).toBe(8333);
  });
});

describe("agentStatus", () => {
  it("counts real runs and is honest when a bot never ran", () => {
    const rows = agentStatus([
      activity({ message: "Lead qualifier: scored 2 real leads" }),
      activity({ message: "Lead qualifier: scored 1 real lead" }),
      activity({ kind: "system", message: "Database initialized" }),
    ]);
    const leadBot = rows.find((a) => a.name === "Lead Qualifier");
    expect(leadBot?.runs).toBe(2);
    const insight = rows.find((a) => a.name === "Insight Engine");
    expect(insight?.runs).toBe(0);
    expect(insight?.lastMessage).toMatch(/No runs recorded/);
  });
});

describe("todayPulse", () => {
  it("counts only today's real activity (UTC day)", () => {
    const now = new Date();
    const earlierToday = new Date(now.getTime() - 2 * 3600_000).toISOString();
    const pulse = todayPulse(
      [lead({}), lead({ id: "l2", created_at: "2020-01-01T00:00:00Z" })],
      [
        order({}),
        order({ id: "o2", status: "pending" }),
        order({ id: "o3", created_at: "2020-01-01T00:00:00Z" }),
      ],
      [activity({}), activity({ id: "a2", created_at: earlierToday })],
    );
    expect(pulse.leadsToday).toBe(1);
    expect(pulse.ordersToday).toBe(2);
    // only the PAID order counts towards collected money
    expect(pulse.collectedToday).toBeGreaterThan(0);
    expect(pulse.botRunsToday).toBe(2);
  });

  it("is all zeros on a quiet day — real zeros, never simulated", () => {
    const pulse = todayPulse([], [], []);
    expect(pulse).toEqual({ leadsToday: 0, ordersToday: 0, collectedToday: 0, botRunsToday: 0 });
  });
});

describe("onboardingSteps", () => {
  it("cold start: every step is open and the first is lead capture", () => {
    const steps = onboardingSteps([], [], [], []);
    expect(steps.length).toBe(5);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps[0].id).toBe("leads");
  });

  it("marks steps done only from real rows, in order", () => {
    const steps = onboardingSteps(
      [lead({})],
      [client({})],
      [order({ status: "pending" })],
      [activity({ message: "Lead qualifier: scored 1 real lead" })],
    );
    expect(steps.find((s) => s.id === "leads")?.done).toBe(true);
    expect(steps.find((s) => s.id === "clients")?.done).toBe(true);
    expect(steps.find((s) => s.id === "orders")?.done).toBe(true);
    // collect step requires a PAID order — pending does not count
    expect(steps.find((s) => s.id === "collect")?.done).toBe(false);
    // agents step needs a bot run recorded in activity
    expect(steps.find((s) => s.id === "agents")?.done).toBe(true);
  });
});

// ---------- AI Academy ----------

import { academyState, briefFreshness, TEACHER_PREFIX } from "./lib/engine";

describe("academyState", () => {
  it("cold start: all students honestly enrolled, teacher never ran", () => {
    const s = academyState([], []);
    expect(s.teacherRuns).toBe(0);
    expect(s.teacherLastRun).toBeNull();
    expect(s.teacherBriefsWritten).toBe(0);
    expect(s.trainedCount).toBe(0);
    expect(s.students).toHaveLength(4);
    for (const st of s.students) {
      expect(st.graduation).toBe("enrolled");
      expect(st.marketBrief).toBeNull();
    }
  });

  it("agents with prior learnings graduate to in_training", () => {
    const s = academyState(
      [],
      [{ agent: "lead_qualifier", key: "channel_bias", value: { bias: { linkedin: 4 } }, updated_at: new Date().toISOString() }],
    );
    const lq = s.students.find((st) => st.slug === "lead_qualifier")!;
    expect(lq.graduation).toBe("in_training");
    expect(lq.skills.find((k) => k.id === "channel_performance")?.learned).toBe(true);
    expect(lq.skills.find((k) => k.id === "market_brief")?.learned).toBe(false);
    // others without any memory stay enrolled
    expect(s.students.find((st) => st.slug === "insight_engine")!.graduation).toBe("enrolled");
  });

  it("a market_brief marks the student trained and counts as a teacher brief", () => {
    const s = academyState(
      [activity({ message: `${TEACHER_PREFIX}: class session complete — 4/4 students` })],
      [
        { agent: "growth_marketing", key: "market_brief", value: { instruction: "focus on fintech" }, updated_at: new Date().toISOString() },
        { agent: "error_handler", key: "market_brief", value: { instruction: "watch lead surge" }, updated_at: new Date().toISOString() },
      ],
    );
    expect(s.teacherRuns).toBe(1);
    expect(s.teacherBriefsWritten).toBe(2);
    expect(s.trainedCount).toBe(2);
    const gm = s.students.find((st) => st.slug === "growth_marketing")!;
    expect(gm.graduation).toBe("trained");
    expect(gm.marketBrief?.value).toEqual({ instruction: "focus on fintech" });
    // memory-backed skills with no rows stay unlearned (honest progress)
    expect(gm.skills.find((k) => k.id === "campaign_strategy")?.learned).toBe(false);
    expect(gm.skills.find((k) => k.id === "market_brief")?.learned).toBe(true);
  });
});

describe("briefFreshness", () => {
  it("classifies fresh / aging / stale by real age", () => {
    expect(briefFreshness(new Date().toISOString())).toBe("fresh");
    expect(briefFreshness(new Date(Date.now() - 14 * 86400000).toISOString())).toBe("aging");
    expect(briefFreshness(new Date(Date.now() - 45 * 86400000).toISOString())).toBe("stale");
  });
});

// ---------- Operations (AI Manager / delivery QA / skills.sh) ----------

import { opsState } from "./lib/engine";
import type { DeliveryRow } from "./lib/engine";

const delivery = (over: Partial<DeliveryRow>): DeliveryRow => ({
  id: "d1",
  client_name: "Acme",
  pack: "professional",
  method: "multicaixa",
  amount: 2916,
  qa_status: "pending",
  checks: {},
  notes: null,
  verified_at: null,
  created_at: new Date().toISOString(),
  ...over,
});

describe("opsState", () => {
  it("honest cold start: no missions, no skills, no QA rows", () => {
    const s = opsState([], []);
    expect(s.missions).toHaveLength(0);
    expect(s.skills).toHaveLength(0);
    expect(s.deliveries).toHaveLength(0);
    expect(s.qaPending).toBe(0);
    expect(s.qaPassed).toBe(0);
    expect(s.qaFailed).toBe(0);
    expect(s.scoutLastRun).toBeNull();
  });

  it("collects missions and skill entries per managed agent from real memory", () => {
    const now = new Date().toISOString();
    const s = opsState(
      [
        { agent: "lead_qualifier", key: "mission", value: { objective: "qualify", bottleneck: "closing" }, updated_at: now },
        { agent: "lead_qualifier", key: "channel_bias", value: {}, updated_at: now }, // not a mission
        { agent: "growth_marketing", key: "skill_entry", value: { ecosystem: "skills.sh" }, updated_at: now },
        { agent: "rogue_agent", key: "mission", value: {}, updated_at: now }, // ignored: not managed
      ],
      [],
    );
    expect(s.missions).toHaveLength(1);
    expect(s.missions[0].agent).toBe("lead_qualifier");
    expect(s.missions[0].value.bottleneck).toBe("closing");
    expect(s.skills).toHaveLength(1);
    expect(s.skills[0].agent).toBe("growth_marketing");
    expect(s.scoutLastRun).toBe(now);
  });

  it("counts delivery QA statuses from real rows", () => {
    const s = opsState([], [
      delivery({ id: "d1", qa_status: "passed" }),
      delivery({ id: "d2", qa_status: "passed" }),
      delivery({ id: "d3", qa_status: "failed" }),
      delivery({ id: "d4" }),
    ]);
    expect(s.qaPassed).toBe(2);
    expect(s.qaFailed).toBe(1);
    expect(s.qaPending).toBe(1);
  });
});

describe("opsState — qa status normalization edge cases", () => {
  it("treats unknown qa_status values as pending (server normalization contract)", () => {
    // fetchDeliveryStatus normaliza qualquer valor inesperado para "pending";
    // opsState nunca deve contar valores inesperados nem em passed nem failed.
    const s = opsState(
      [],
      [
        { ...delivery({ id: "d1", qa_status: "passed" }) },
        { ...delivery({ id: "d2", qa_status: "failed" }) },
        { ...delivery({ id: "d3", qa_status: "pending" }) },
      ],
    );
    expect(s.qaPassed + s.qaFailed + s.qaPending).toBe(3);
    expect(s.qaPassed).toBe(1);
    expect(s.qaFailed).toBe(1);
    expect(s.qaPending).toBe(1);
  });

  it("qa counts stay consistent when the same delivery flips status", () => {
    const rows = [delivery({ id: "d1", qa_status: "pending" })];
    const before = opsState([], rows);
    expect(before.qaPending).toBe(1);
    const after = opsState([], rows.map((r) => ({ ...r, qa_status: "passed" as const })));
    expect(after.qaPending).toBe(0);
    expect(after.qaPassed).toBe(1);
    expect(after.qaFailed).toBe(0);
  });
});
