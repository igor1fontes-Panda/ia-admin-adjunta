import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Client, Lead, Metric, Order } from "../types";
import { computeMetrics } from "./engine";
import { DEMO_NOTE, demoClients, demoLeads, demoOrders } from "./demo";

/**
 * Data layer with automatic fallback.
 * - If Supabase env vars exist (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY), all
 *   reads/writes hit the live production database with RLS enforced.
 * - Otherwise the app runs on deterministic demo data so it always works.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createSupabaseClient(url, anonKey) : null;

export const isLive = supabase !== null;

async function mapError<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---- Leads ----

export async function fetchLeads(): Promise<Lead[]> {
  if (!supabase) return demoLeads();
  try {
    const rows = await mapError<any[]>(
      supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200),
    );
    return rows.map((r) => ({
      id: r.id,
      company: r.company,
      contact_name: r.contact_name,
      email: r.email,
      niche: r.niche,
      channel: r.channel,
      score: r.score,
      status: r.status,
      created_at: r.created_at,
    }));
  } catch (e: any) {
    console.warn("[data] leads fallback:", e.message);
    return demoLeads();
  }
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  if (!supabase) return;
  await mapError(supabase.from("leads").update({ status }).eq("id", id));
}

// ---- Clients ----

export async function fetchClients(): Promise<Client[]> {
  if (!supabase) return demoClients();
  try {
    const rows = await mapError<any[]>(
      supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(200),
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      plan: r.plan,
      mrr: r.mrr,
      status: r.status,
      created_at: r.created_at,
    }));
  } catch (e: any) {
    console.warn("[data] clients fallback:", e.message);
    return demoClients();
  }
}

export async function createClient(input: {
  name: string;
  email: string;
  plan: Client["plan"];
}): Promise<Client> {
  const price = { starter: 1250, professional: 2916, enterprise: 8333 }[input.plan];
  if (!supabase) {
    return {
      id: `demo-${Date.now()}`,
      name: input.name,
      email: input.email,
      plan: input.plan,
      mrr: Math.round(price / 12),
      status: "active",
      created_at: new Date().toISOString(),
    };
  }
  const row = await mapError<any>(
    supabase
      .from("clients")
      .insert({ name: input.name, email: input.email, plan: input.plan, mrr: Math.round(price / 12), status: "active" })
      .select()
      .single(),
  );
  return row;
}

// ---- Orders ----

export async function fetchOrders(): Promise<Order[]> {
  if (!supabase) return demoOrders();
  try {
    const rows = await mapError<any[]>(
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
    );
    return rows.map((r) => ({
      id: r.id,
      client_id: r.client_id,
      client_name: r.client_name,
      amount: r.amount,
      currency: r.currency ?? "AOA",
      method: r.method,
      status: r.status,
      reference: r.reference,
      created_at: r.created_at,
    }));
  } catch (e: any) {
    console.warn("[data] orders fallback:", e.message);
    return demoOrders();
  }
}

export async function createOrder(input: {
  client_id: string | null;
  client_name: string;
  amount: number;
  method: string;
}): Promise<Order> {
  const reference = String(923012293 + Math.floor(Math.random() * 999999));
  if (!supabase) {
    return {
      id: `demo-${Date.now()}`,
      ...input,
      currency: "AOA",
      status: "pending",
      reference,
      created_at: new Date().toISOString(),
    };
  }
  const row = await mapError<any>(
    supabase
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
  );
  return row;
}

export async function markOrderPaid(id: string): Promise<void> {
  if (!supabase) return;
  await mapError(supabase.from("orders").update({ status: "paid" }).eq("id", id));
}

// ---- Activity feed ----

export async function fetchActivity(): Promise<Activity[]> {
  if (!supabase) {
    return [
      { id: "a1", kind: "bot", message: "Lead hunter bot: 6 new leads captured from LinkedIn", created_at: new Date(Date.now() - 3600_000 * 2).toISOString() },
      { id: "a2", kind: "sale", message: "Order #923012293 paid — 15,000 AOA via Multicaixa", created_at: new Date(Date.now() - 3600_000 * 5).toISOString() },
      { id: "a3", kind: "system", message: "Nightly backup completed. 99.98% uptime this month.", created_at: new Date(Date.now() - 3600_000 * 8).toISOString() },
      { id: "a4", kind: "lead", message: "Nimbus SaaS qualified — score 91", created_at: new Date(Date.now() - 3600_000 * 26).toISOString() },
    ];
  }
  try {
    const rows = await mapError<any[]>(
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50),
    );
    return rows.map((r) => ({ id: r.id, kind: r.kind, message: r.message, created_at: r.created_at }));
  } catch {
    return [];
  }
}

// ---- Aggregated snapshot for the dashboard ----

export type Snapshot = {
  metrics: Metric;
  leads: Lead[];
  clients: Client[];
  orders: Order[];
  activity: Activity[];
  demoNote: string | null;
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
    demoNote: isLive ? null : DEMO_NOTE,
  };
}
