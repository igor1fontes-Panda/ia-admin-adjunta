import type { Client, Lead, Order } from "../types";

const COMPANIES = [
  "Nimbus SaaS", "Vertex Labs", "Kalahari Digital", "Atlantico Bank", "Lumina Health",
  "Codecraft Lda", "Palmwave Media", "Northgate Capital", "Zebra Logistics", "Ango Cloud",
  "Bluepeak Analytics", "Casa Digital", "Tratore Group", "Metro Retail", "Solaris Energy",
];
const CONTACTS = [
  "Ana Ferreira", "João Santos", "Maria Costa", "Pedro Alves", "Sofia Martins",
  "Lucas Rocha", "Beatriz Silva", "Tiago Pereira", "Inês Cardoso", "Rui Mendes",
];
const NICHES = ["SaaS", "Fintech", "Healthcare", "E-commerce", "Logistics", "Agencies"];
const CHANNELS = ["linkedin", "x-community", "reddit", "website", "referral"];
const PLANS: Client["plan"][] = ["starter", "professional", "enterprise"];
const METHODS = ["multicaixa", "paypay", "card"];

// Deterministic PRNG so demo data is stable per seed
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function demoLeads(count = 18): Lead[] {
  const rand = mulberry32(42);
  const statuses: Lead["status"][] = ["new", "contacted", "qualified", "won", "lost"];
  return Array.from({ length: count }, (_, i) => {
    const score = Math.round(45 + rand() * 54);
    return {
      id: `demo-lead-${i + 1}`,
      company: pick(rand, COMPANIES),
      contact_name: pick(rand, CONTACTS),
      email: `contact${i + 1}@${pick(rand, ["nimbus.io", "vertexlabs.com", "kalahari.ao", "lumina.health", "codecraft.pt"])}`,
      niche: pick(rand, NICHES),
      channel: pick(rand, CHANNELS),
      score,
      status: score > 85 ? "qualified" : statuses[Math.floor(rand() * 3)],
      created_at: new Date(Date.now() - Math.floor(rand() * 20) * 86400000).toISOString(),
    };
  }).sort((a, b) => b.score - a.score);
}

export function demoClients(count = 9): Client[] {
  const rand = mulberry32(7);
  const planPrice: Record<Client["plan"], number> = { starter: 1250, professional: 2916, enterprise: 8333 };
  return Array.from({ length: count }, (_, i) => {
    const plan = pick(rand, PLANS);
    const status: Client["status"] = rand() > 0.9 ? "trialing" : "active";
    return {
      id: `demo-client-${i + 1}`,
      name: pick(rand, COMPANIES),
      email: `billing${i + 1}@example.com`,
      plan,
      mrr: Math.round(planPrice[plan] / 12),
      status,
      created_at: new Date(Date.now() - Math.floor(rand() * 300) * 86400000).toISOString(),
    };
  });
}

export function demoOrders(count = 14): Order[] {
  const rand = mulberry32(99);
  const clients = demoClients();
  const amounts = [1250, 2500, 2916, 5000, 8333, 10000, 15000];
  return Array.from({ length: count }, (_, i) => {
    const client = pick(rand, clients);
    return {
      id: `demo-order-${i + 1}`,
      client_id: client.id,
      client_name: client.name,
      amount: pick(rand, amounts),
      currency: "AOA",
      method: pick(rand, METHODS),
      status: (rand() > 0.25 ? "paid" : "pending") as Order["status"],
      reference: String(923012293 + i),
      created_at: new Date(Date.now() - Math.floor(rand() * 45) * 86400000).toISOString(),
    };
  }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export const DEMO_NOTE =
  "Demo data — connect Supabase keys in Settings → Environment to switch to live production data.";
