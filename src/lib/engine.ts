import type { Activity, Client, Lead, Metric, Order } from "../types";

// ---------- Analytics (all pure functions over REAL rows) ----------

export type SeriesPoint = { label: string; value: number };
export type RevenuePoint = { label: string; paid: number; pending: number };
export type FunnelStage = { stage: string; count: number };
export type IncomeRow = { source: string; paid: number; pending: number; orders: number; sharePct: number };
export type AgentRow = { name: string; schedule: string; runs: number; lastRun: string | null; lastMessage: string };

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
    s === "new" ? "Captured" : s === "contacted" ? "Contacted" : s === "qualified" ? "Qualified" : s === "won" ? "Won" : null;
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
    value: clients.filter((c) => c.plan === p && (c.status === "active" || c.status === "trialing")).reduce((s, c) => s + c.mrr, 0),
  }));
}

/**
 * AI agent managers, derived from REAL activity_log rows. No fabricated runs:
 * if a bot never ran, its row says so honestly.
 */
export function agentStatus(activity: Activity[]): AgentRow[] {
  const defs: Array<{ name: string; schedule: string; match: (m: string) => boolean }> = [
    { name: "Lead Qualifier", schedule: "daily 06:00 UTC", match: (m) => m.startsWith("Lead qualifier") },
    { name: "Insight Engine", schedule: "daily 06:00 UTC", match: (m) => m.startsWith("Insight engine") },
    { name: "Error Handler", schedule: "hourly", match: (m) => m.startsWith("Error handler") },
  ];
  const now = Date.now();
  return defs.map(({ name, schedule, match }) => {
    const rows = activity.filter((a) => a.kind === "bot" && match(a.message));
    const last = rows[0];
    const stale = last ? now - +new Date(last.created_at) > 36 * 3600000 : true;
    return {
      name,
      schedule,
      runs: rows.length,
      lastRun: last?.created_at ?? null,
      lastMessage: last ? last.message.replace(/ ?\|\|\| AUDIO_BRIEFING_URL=\S+/, "") : "No runs recorded yet — waiting for the scheduled GitHub Actions job",
      ...(last && !stale ? {} : {}),
    } as AgentRow & { stale?: boolean };
  }).map((r) => r as AgentRow);
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

export function scoreLead(lead: {
  score: number;
  status: Lead["status"];
  channel: string;
  niche: string;
}): { tier: "hot" | "warm" | "cold"; action: string } {
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

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
