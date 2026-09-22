import { describe, expect, it } from "vitest";
import {
  PLAN_PRICES,
  buildAgentPromptPlan,
  computeMetrics,
  productPackEvidence,
  productPackRisks,
  scoreLead,
  skillFreshness,
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

const activity = (over: Partial<Activity>): Activity => ({
  id: "a1",
  kind: "bot",
  message: "Insight engine: test",
  created_at: new Date().toISOString(),
  ...over,
});

// ---------- productPackEvidence ----------

describe("productPackEvidence", () => {
  it("reports honest unavailable evidence on cold start", () => {
    const e = productPackEvidence([], [], [], []);
    expect(e.map((x) => x.source)).toEqual(["leads", "clients", "orders", "activity"]);
    for (const row of e) {
      expect(row.recordCount).toBe(0);
      expect(row.recordIds).toEqual([]);
      expect(row.freshness).toBe("unavailable");
      expect(row.confidence).toBe("low");
      expect(row.observedSignal).toMatch(/No .* records are available/);
      expect(row.verifiedAt).toBeTruthy();
    }
  });

  it("scales confidence and freshness with real record volume and age", () => {
    const fresh = new Date().toISOString();
    const stale = new Date(Date.now() - 45 * 86400000).toISOString();
    const e = productPackEvidence(
      Array.from({ length: 12 }, (_, i) => lead({ id: `l${i}`, created_at: fresh })),
      [client({})],
      [order({ created_at: stale })],
      [activity({ created_at: fresh })],
    );
    const leads = e.find((x) => x.source === "leads")!;
    expect(leads.confidence).toBe("high");
    expect(leads.freshness).toBe("fresh");
    expect(leads.recordIds).toHaveLength(12);

    const clients = e.find((x) => x.source === "clients")!;
    expect(clients.confidence).toBe("medium"); // >0 but <5 threshold

    const orders = e.find((x) => x.source === "orders")!;
    expect(orders.freshness).toBe("stale");
    expect(orders.observedSignal).toContain("1 paid order records");
  });
});

// ---------- productPackRisks ----------

describe("productPackRisks", () => {
  it("blocks assembly without any evidence", () => {
    const risks = productPackRisks(productPackEvidence([], [], [], []), false);
    const noEvidence = risks.find((r) => r.id === "no-evidence")!;
    expect(noEvidence.severity).toBe("high");
    expect(noEvidence.blocking).toBe(true);
    expect(risks.find((r) => r.id === "market")!.blocking).toBe(true);
    expect(risks.find((r) => r.id === "channels")!.blocking).toBe(false);
  });

  it("does not block when evidence is fresh and market is defined", () => {
    const fresh = new Date().toISOString();
    const evidence = productPackEvidence([lead({})], [client({})], [order({})], [activity({ created_at: fresh })]);
    const risks = productPackRisks(evidence, true);
    expect(risks.find((r) => r.id === "no-evidence")).toBeUndefined();
    expect(risks.find((r) => r.id === "market")).toBeUndefined();
    expect(risks.find((r) => r.id === "stale")).toBeUndefined();
    // the always-on advisory risk remains
    expect(risks.map((r) => r.id)).toEqual(["channels"]);
  });

  it("flags stale evidence as a blocking risk", () => {
    const stale = new Date(Date.now() - 45 * 86400000).toISOString();
    const evidence = productPackEvidence([lead({ created_at: stale })], [], [], []);
    expect(productPackRisks(evidence, true).find((r) => r.id === "stale")!.blocking).toBe(true);
  });
});

// ---------- buildAgentPromptPlan ----------

describe("buildAgentPromptPlan", () => {
  const base = {
    agent: "lead_qualifier",
    sessionId: "s-123",
    currentTask: "qualify daily batch",
    leads: [lead({}), lead({ id: "l2" })],
    clients: [client({})],
    orders: [order({}), order({ id: "o2", status: "pending" as const })],
    activity: [activity({})],
    memoryCount: 4,
  };

  it("builds a static system prompt, dynamic context and a stable cache key", () => {
    const plan = buildAgentPromptPlan(base);
    expect(plan.staticSystem).toMatch(/evidence-first/);
    expect(plan.staticSystem).toMatch(/Never invent/);
    expect(plan.dynamicContext.agent).toBe("lead_qualifier");
    expect(plan.dynamicContext.sessionId).toBe("s-123");
    expect(plan.tools).toContain("inspect_verified_records");
    expect(plan.tools).not.toHaveLength(0);
    expect(plan.cacheKey).toBe("agent:lead_qualifier:static:v1");
    expect(plan.cacheableBytes).toBeGreaterThan(0);
  });

  it("derives facts from real leads and orders, capped at 20 each", () => {
    const manyLeads = Array.from({ length: 25 }, (_, i) => lead({ id: `l${i}` }));
    const plan = buildAgentPromptPlan({ ...base, leads: manyLeads });
    const leadFacts = plan.dynamicContext.facts.filter((f) => f.source === "leads");
    expect(leadFacts).toHaveLength(20); // cap enforced

    const paid = plan.dynamicContext.facts.find((f) => f.key === "order:o1")!;
    expect(paid.confidence).toBe("high"); // paid orders are high confidence
    const pending = plan.dynamicContext.facts.find((f) => f.key === "order:o2")!;
    expect(pending.confidence).toBe("medium");
  });

  it("records real record counts including memory", () => {
    const plan = buildAgentPromptPlan(base);
    expect(plan.dynamicContext.recordCounts).toEqual({
      leads: 2,
      clients: 1,
      orders: 2,
      activity: 1,
      memory: 4,
    });
    // contextClock is a UTC hour bucket (YYYY-MM-DDTHH)
    expect(plan.dynamicContext.contextClock).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });

  it("does not invent facts when rows are empty", () => {
    const plan = buildAgentPromptPlan({ ...base, leads: [], clients: [], orders: [], activity: [] });
    expect(plan.dynamicContext.facts).toEqual([]);
    expect(plan.dynamicContext.recordCounts.leads).toBe(0);
  });
});

// ---------- skillFreshness / PLAN_PRICES / boundary scoring ----------

describe("skillFreshness", () => {
  it("mirrors brief freshness buckets", () => {
    expect(skillFreshness(new Date().toISOString())).toBe("fresh");
    expect(skillFreshness(new Date(Date.now() - 14 * 86400000).toISOString())).toBe("aging");
    expect(skillFreshness(new Date(Date.now() - 45 * 86400000).toISOString())).toBe("stale");
  });
});

describe("PLAN_PRICES", () => {
  it("pins the three public pack prices and user caps", () => {
    expect(PLAN_PRICES.starter).toMatchObject({ monthly: 1250, label: "Starter", users: 10 });
    expect(PLAN_PRICES.professional).toMatchObject({ monthly: 2916, label: "Professional", users: 50 });
    expect(PLAN_PRICES.enterprise).toMatchObject({ monthly: 8333, label: "Enterprise", users: 999 });
  });
});

describe("scoreLead boundaries", () => {
  it("draws tier boundaries at 60 and 80 after channel/niche bonuses", () => {
    // 79 + 0 bonuses = warm just under hot
    expect(scoreLead({ score: 79, status: "new", channel: "website", niche: "Other" }).tier).toBe("warm");
    // 79 + 8 referral = 87 → hot
    expect(scoreLead({ score: 79, status: "new", channel: "referral", niche: "Other" }).tier).toBe("hot");
    // 59 + 4 linkedin = 63 → warm just above cold
    expect(scoreLead({ score: 59, status: "new", channel: "linkedin", niche: "Other" }).tier).toBe("warm");
    // 55 + 0 = cold
    expect(scoreLead({ score: 55, status: "new", channel: "website", niche: "Other" }).tier).toBe("cold");
  });

  it("maps tiers to concrete next actions", () => {
    expect(scoreLead({ score: 95, status: "new", channel: "referral", niche: "Fintech" }).action).toMatch(/proposal/);
    expect(scoreLead({ score: 65, status: "new", channel: "website", niche: "Other" }).action).toMatch(/demo/);
    expect(scoreLead({ score: 30, status: "new", channel: "website", niche: "Other" }).action).toMatch(/Nurture/);
  });
});

describe("computeMetrics revenue window", () => {
  it("only counts paid orders from the last 30 days", () => {
    const m = computeMetrics(
      [],
      [],
      [
        order({ amount: 1000, created_at: new Date(Date.now() - 29 * 86400000).toISOString() }),
        order({ amount: 2000, created_at: new Date(Date.now() - 31 * 86400000).toISOString() }),
        order({ amount: 4000, status: "pending" }),
      ],
    );
    expect(m.revenue30d).toBe(1000);
  });
});
