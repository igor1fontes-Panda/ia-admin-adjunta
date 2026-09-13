import { describe, expect, it } from "vitest";
import {
  agentStatus,
  computeMetrics,
  formatKz,
  incomeByClient,
  incomeByMethod,
  leadsPerDay,
  mrrByPlan,
  pipelineFunnel,
  revenuePerDay,
  scoreLead,
  timeAgo,
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
