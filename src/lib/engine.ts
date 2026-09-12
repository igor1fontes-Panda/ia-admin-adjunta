import type { Client, Lead, Metric, Order } from "../types";

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
