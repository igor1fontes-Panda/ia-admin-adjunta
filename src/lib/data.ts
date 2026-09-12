import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Client, Lead, Metric, Order } from "../types";
import { computeMetrics } from "./engine";

/**
 * REAL DATA ONLY — no demo mode, no simulations.
 * The app requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
 * If they are missing, components render a setup checklist instead of fake data.
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
  const rows = await mapError<any[]>(
    supabase!.from("leads").select("*").order("created_at", { ascending: false }).limit(200),
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    company: r.company,
    contact_name: r.contact_name,
    email: r.email,
    niche: r.niche,
    channel: r.channel,
    score: r.score ?? 50,
    status: r.status,
    ai_action: r.ai_action ?? null,
    created_at: r.created_at,
  }));
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  await mapError(supabase!.from("leads").update({ status }).eq("id", id));
}

// ---- Clients ----

const PLAN_MRR: Record<Client["plan"], number> = { starter: 1250, professional: 2916, enterprise: 8333 };

export async function fetchClients(): Promise<Client[]> {
  const rows = await mapError<any[]>(
    supabase!.from("clients").select("*").order("created_at", { ascending: false }).limit(200),
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    plan: r.plan,
    mrr: r.mrr,
    status: r.status,
    created_at: r.created_at,
  }));
}

export async function createClient(input: {
  name: string;
  email: string;
  plan: Client["plan"];
}): Promise<Client> {
  const row = await mapError<any>(
    supabase!
      .from("clients")
      .insert({ name: input.name, email: input.email, plan: input.plan, mrr: PLAN_MRR[input.plan], status: "active" })
      .select()
      .single(),
  );
  return row;
}

// ---- Orders ----

export async function fetchOrders(): Promise<Order[]> {
  const rows = await mapError<any[]>(
    supabase!.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
  );
  return (rows ?? []).map((r) => ({
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
}

export async function createOrder(input: {
  client_id: string | null;
  client_name: string;
  amount: number;
  method: string;
}): Promise<Order> {
  const reference = String(923012293 + Math.floor(Math.random() * 999999));
  const row = await mapError<any>(
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
  );
  return row;
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
  const rows = await mapError<any[]>(
    supabase!.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50),
  );
  return (rows ?? []).map((r) => ({ id: r.id, kind: r.kind, message: r.message, created_at: r.created_at }));
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
