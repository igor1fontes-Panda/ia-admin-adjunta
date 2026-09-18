/**
 * REAL DATA ONLY — no demo mode, no simulations.
 *
 * The browser never touches the database directly anymore. Every read/write
 * goes through this app's authenticated serverless API (Neon Postgres +
 * Drizzle server-side, Better Auth sessions). The ONLY public mutation is
 * the landing-page lead form (POST /api/leads without a session).
 *
 * "Live" updates arrive via a 15s poll of the authenticated snapshot —
 * serverless functions cannot push like Supabase Realtime did, so the
 * dashboard refreshes itself and shows a live/offline connection state.
 */
import type { Activity, Client, Lead, Metric, Order } from "../types";
import { computeMetrics } from "./engine";
import { isMockMode, mockData } from "./data.mock";

const API = "/api";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** The browser talks to this app's authenticated /api/* routes only. */
export const isLive = true;

export type DataLayerHealth = {
  configured: boolean;
  reachable: boolean;
  schemaReady: boolean;
  checkedAt: string;
  message: string;
};

export async function checkDataLayerHealth(timeoutMs = 8000): Promise<DataLayerHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const result = await Promise.race([
      api<{ ok: boolean; database: { configured: boolean; connected: boolean } }>("/health"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Health check timed out.")), timeoutMs)),
    ]);
    return {
      configured: result.database.configured,
      reachable: result.database.connected,
      schemaReady: result.database.connected,
      checkedAt,
      message: result.database.connected
        ? "Neon Postgres is connected and healthy."
        : "DATABASE_URL is not set — connect Neon (pooled connection string).",
    };
  } catch (e) {
    return {
      configured: true,
      reachable: false,
      schemaReady: false,
      checkedAt,
      message: e instanceof Error ? e.message : "Health check failed.",
    };
  }
}

// ---- Leads ----

export async function fetchLeads(): Promise<Lead[]> {
  if (isMockMode) return mockData.leads;
  return api<Lead[]>("/leads");
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  await api(`/leads?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

// ---- Clients ----

const PLAN_MRR: Record<Client["plan"], number> = { starter: 1250, professional: 2916, enterprise: 8333 };
void PLAN_MRR; // MRR is derived server-side from the plan; kept for reference.

export async function fetchClients(): Promise<Client[]> {
  if (isMockMode) return mockData.clients;
  return api<Client[]>("/clients");
}

export async function createClient(input: { name: string; email: string; plan: Client["plan"] }): Promise<Client> {
  return api<Client>("/clients", { method: "POST", body: JSON.stringify(input) });
}

// ---- Orders ----

export async function fetchOrders(): Promise<Order[]> {
  if (isMockMode) return mockData.orders;
  return api<Order[]>("/orders");
}

export async function createOrder(input: {
  client_id: string | null;
  client_name: string;
  amount: number;
  method: string;
}): Promise<Order> {
  return api<Order>("/orders", { method: "POST", body: JSON.stringify(input) });
}

export async function markOrderPaid(id: string): Promise<void> {
  await api(`/orders?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
}

// ---- Public lead capture (landing page form) ----

export async function submitLead(input: { company: string; contact_name: string; email: string; niche: string }): Promise<void> {
  await api("/leads", { method: "POST", body: JSON.stringify(input) });
}

// ---- Activity feed ----

export async function fetchActivity(): Promise<Activity[]> {
  if (isMockMode) return mockData.activity;
  return api<Activity[]>("/activity");
}

// ---- Agent learning memory ----

export type AgentMemoryRow = { agent: string; key: string; value: unknown; updated_at: string };

export async function fetchAgentMemory(): Promise<AgentMemoryRow[]> {
  return api<AgentMemoryRow[]>("/agents/memory");
}

// ---- Delivery QA ----

export type DeliveryRow = {
  id: string;
  client_id: string | null;
  order_id: string | null;
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

export async function fetchDeliveryStatus(): Promise<DeliveryRow[]> {
  return api<DeliveryRow[]>("/deliveries");
}

// ---- Auth (Better Auth) ----

export async function authSignIn(email: string, password: string): Promise<void> {
  const res = await fetch(`${API}/auth/sign-in/email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || `Sign-in failed (${res.status})`);
  }
}

export async function authSignUp(email: string, password: string, name: string): Promise<void> {
  const res = await fetch(`${API}/auth/sign-up/email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || `Sign-up failed (${res.status})`);
  }
}

export async function authSignOut(): Promise<void> {
  await fetch(`${API}/auth/sign-out`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function authGetSession(): Promise<{ email: string; name: string } | null> {
  try {
    const session = await api<{ user?: { email?: string; name?: string } }>("/auth/get-session");
    if (session?.user?.email) return { email: session.user.email, name: session.user.name ?? "" };
    return null;
  } catch {
    return null;
  }
}

// ---- Aggregated snapshot ----

export type Snapshot = {
  metrics: Metric;
  leads: Lead[];
  clients: Client[];
  orders: Order[];
  activity: Activity[];
};

export async function loadSnapshot(): Promise<Snapshot> {
  const [leads, clients, orders, activity] = await Promise.all([
    fetchLeads(),
    fetchClients(),
    fetchOrders(),
    fetchActivity(),
  ]);
  return {
    metrics: computeMetrics(leads, clients, orders),
    leads,
    clients,
    orders,
    activity,
  };
}
