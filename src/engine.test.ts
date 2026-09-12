import { describe, expect, it } from "vitest";
import { computeMetrics, formatKz, scoreLead, timeAgo } from "./lib/engine";
import type { Client, Lead, Order } from "./types";

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
