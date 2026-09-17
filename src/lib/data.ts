import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Client, Lead, Metric, Order } from "../types";
import { computeMetrics, type DeliveryRow } from "./engine";
import { isMockMode, mockData } from "./data.mock";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * REAL DATA ONLY — no demo mode, no simulations.
 * The app requires public Supabase URL + publishable/anon key variables.
 * If they are missing, components render a setup checklist instead of fake data.
 */

// These values are public by design. Secrets such as service-role keys must
// never be used here; row-level security remains the authorization boundary.
const env = import.meta.env as Record<string, string | undefined>;
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabase: SupabaseClient | null =
  url && anonKey ? createSupabaseClient(url, anonKey) : null;

export const isLive = supabase !== null;

export type DataLayerHealth = {
  configured: boolean;
  reachable: boolean;
  schemaReady: boolean;
  checkedAt: string;
  message: string;
};

export async function checkDataLayerHealth(timeoutMs = 8000): Promise<DataLayerHealth> {
  const checkedAt = new Date().toISOString();
  if (isMockMode) return { configured: true, reachable: true, schemaReady: true, checkedAt, message: "Offline mock data is enabled." };
  if (!supabase) return { configured: false, reachable: false, schemaReady: false, checkedAt, message: "Supabase public configuration is missing." };
  const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) => {
    setTimeout(() => resolve({ data: null, error: { message: "Health check timed out." } }), timeoutMs);
  });
  const result = await Promise.race([supabase.from("activity_log").select("id").limit(1), timeout]);
  if (result.error) {
    const schemaReady = !/relation .* does not exist|schema cache|could not find the table|pgrst205/i.test(result.error.message);
    return { configured: true, reachable: schemaReady, schemaReady, checkedAt, message: schemaReady ? `Supabase health check failed: ${result.error.message}` : "Supabase is reachable, but required migrations are not applied." };
  }
  return { configured: true, reachable: true, schemaReady: true, checkedAt, message: "Supabase is reachable and the activity schema is available." };
}

async function mapError<T>(
  p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---- Leads ----

export async function fetchLeads(): Promise<Lead[]> {
  if (isMockMode) return mockData.leads;
  const rows = await mapError(
    supabase!.from("leads").select("*").order("created_at", { ascending: false }).limit(200),
  ) as DbRow[];
  return (rows ?? []).map((r) => ({
    id: r.id,
    company: r.company ?? "",
    contact_name: r.contact_name ?? "",
    email: r.email ?? "",
    niche: r.niche ?? "",
    channel: r.channel ?? "",
    score: r.score ?? 50,
    status: (r.status ?? "new") as Lead["status"],
    ai_action: r.ai_action ?? null,
    created_at: r.created_at ?? "",
  }));
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  await mapError(supabase!.from("leads").update({ status }).eq("id", id));
}

// ---- Clients ----

const PLAN_MRR: Record<Client["plan"], number> = { starter: 1250, professional: 2916, enterprise: 8333 };

type DbRow = {
  id: string;
  company?: string;
  contact_name?: string;
  email?: string;
  niche?: string;
  channel?: string;
  score?: number;
  status?: string;
  ai_action?: string | null;
  name?: string;
  plan?: Client["plan"];
  mrr?: number;
  client_id?: string | null;
  client_name?: string;
  amount?: number;
  currency?: string;
  method?: string;
  reference?: string;
  created_at?: string;
  kind?: Activity["kind"];
  message?: string;
  agent?: string;
  key?: string;
  value?: unknown;
  updated_at?: string;
};

export async function fetchClients(): Promise<Client[]> {
  if (isMockMode) return mockData.clients;
  const rows = await mapError(
    supabase!.from("clients").select("*").order("created_at", { ascending: false }).limit(200),
  ) as DbRow[];
  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? "",
    email: r.email ?? "",
    plan: r.plan ?? "starter",
    mrr: r.mrr ?? 0,
    status: (r.status ?? "active") as Client["status"],
    created_at: r.created_at ?? "",
  }));
}

export async function createClient(input: {
  name: string;
  email: string;
  plan: Client["plan"];
}): Promise<Client> {
  const row = await mapError(
    supabase!
      .from("clients")
      .insert({ name: input.name, email: input.email, plan: input.plan, mrr: PLAN_MRR[input.plan], status: "active" })
      .select()
      .single(),
  ) as DbRow;
  return {
    id: row.id,
    name: row.name ?? input.name,
    email: row.email ?? input.email,
    plan: row.plan ?? input.plan,
    mrr: Number(row.mrr ?? PLAN_MRR[input.plan]),
    status: (row.status ?? "active") as Client["status"],
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

// ---- Orders ----

export async function fetchOrders(): Promise<Order[]> {
  if (isMockMode) return mockData.orders;
  const rows = await mapError(
    supabase!.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
  ) as DbRow[];
  return (rows ?? []).map((r) => ({
    id: r.id,
    client_id: r.client_id ?? null,
    client_name: r.client_name ?? "Walk-in",
    amount: r.amount ?? 0,
    currency: r.currency ?? "AOA",
    method: r.method ?? "unknown",
    status: (r.status ?? "pending") as Order["status"],
    reference: r.reference ?? "",
    created_at: r.created_at ?? "",
  }));
}

export async function createOrder(input: {
  client_id: string | null;
  client_name: string;
  amount: number;
  method: string;
}): Promise<Order> {
  const reference = `manual-${crypto.randomUUID()}`;
  const row = await mapError(
    supabase!
      .from("orders")
      .insert({
        client_id: input.client_id,
        client_name: input.client_name,
        amount: input.amount,
        method: input.method,
        status: "pending",
        reference,
      })
      .select()
      .single(),
  ) as DbRow;
  return {
    id: row.id,
    client_id: row.client_id ?? null,
    client_name: row.client_name ?? "Walk-in",
    amount: Number(row.amount ?? 0),
    currency: row.currency ?? "AOA",
    method: row.method ?? "unknown",
    status: (row.status ?? "pending") as Order["status"],
    reference: row.reference ?? reference,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

export async function markOrderPaid(id: string): Promise<void> {
  await mapError(supabase!.from("orders").update({ status: "paid" }).eq("id", id));
}

// ---- Public lead capture (landing page form) ----

export async function submitLead(input: {
  company: string;
  contact_name: string;
  email: string;
  niche: string;
}): Promise<void> {
  const { error } = await supabase!.from("leads").insert({
    company: input.company,
    contact_name: input.contact_name,
    email: input.email,
    niche: input.niche,
    channel: "website",
    score: 55,
    status: "new",
  });
  if (error) throw new Error(error.message);
}

// ---- Activity feed ----

export async function fetchActivity(): Promise<Activity[]> {
  if (isMockMode) return mockData.activity;
  const rows = await mapError(
    supabase!.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50),
  ) as DbRow[];
  return (rows ?? [])
    .filter((r) => !/^Database initialized/i.test(String(r.message ?? "")))
    .map((r) => ({
      id: r.id,
      kind: (r.kind ?? "system") as Activity["kind"],
      message: r.message ?? "",
      created_at: r.created_at ?? new Date().toISOString(),
    }));
}

// ---- Agent learning memory (public read via RLS) ----

export type AgentMemoryRow = { agent: string; key: string; value: unknown; updated_at: string };

export async function fetchAgentMemory(): Promise<AgentMemoryRow[]> {
  if (isMockMode) return [];
  const rows = await mapError(
    supabase!.from("agent_memory").select("*").order("updated_at", { ascending: false }),
  ) as DbRow[];
  return (rows ?? []).map((r) => ({
    agent: r.agent ?? "unknown",
    key: r.key ?? "unknown",
    value: r.value,
    updated_at: r.updated_at ?? new Date().toISOString(),
  }));
}

// ---- Delivery QA (AI Manager registrations + Error Handler verdicts) ----

export async function fetchDeliveryStatus(): Promise<import("./engine").DeliveryRow[]> {
  const rows = await mapError(
    supabase!.from("delivery_status").select("*").order("created_at", { ascending: false }).limit(200),
  ) as Array<Record<string, unknown>>;
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    client_name: String(r.client_name ?? "Walk-in"),
    pack: String(r.pack ?? "unknown"),
    method: String(r.method ?? "unknown"),
    amount: Number(r.amount) || 0,
    qa_status: (r.qa_status === "passed" || r.qa_status === "failed" ? r.qa_status : "pending") as DeliveryRow["qa_status"],
    checks: isRecord(r.checks) ? Object.fromEntries(Object.entries(r.checks).map(([key, value]) => [key, Boolean(value)])) : {},
    notes: typeof r.notes === "string" ? r.notes : null,
    verified_at: typeof r.verified_at === "string" ? r.verified_at : null,
    created_at: String(r.created_at),
  }));
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
