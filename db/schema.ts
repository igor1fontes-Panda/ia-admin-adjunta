/**
 * Drizzle schema — Fontes AI Admin Adjunta
 * Target: Neon Postgres (serverless).
 *
 * Drizzle maps only the six public business tables. Neon Managed Auth owns
 * identities and sessions in the separate neon_auth schema; it is not managed here.
 *
 * Conventions kept from the Supabase era: snake_case columns, uuid PKs,
 * timestamptz created_at, enum values enforced in the API layer.
 */
import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// ============ BUSINESS TABLES ============

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    company: text("company").notNull(),
    contact_name: text("contact_name").notNull(),
    email: text("email").notNull(),
    niche: text("niche").notNull().default("SaaS"),
    channel: text("channel").notNull().default("website"),
    score: integer("score").notNull().default(50),
    status: text("status").notNull().default("new"),
    ai_action: text("ai_action"),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("leads_created_idx").on(t.created_at)],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    plan: text("plan").notNull().default("starter"),
    mrr: numeric("mrr", { precision: 12, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("clients_created_idx").on(t.created_at)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    client_id: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    client_name: text("client_name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("AOA"),
    method: text("method").notNull().default("multicaixa"),
    status: text("status").notNull().default("pending"),
    reference: text("reference").notNull(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("orders_created_idx").on(t.created_at), uniqueIndex("orders_reference_unique").on(t.reference)],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull().default("system"),
    message: text("message").notNull(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("activity_created_idx").on(t.created_at)],
);

export const agentMemory = pgTable(
  "agent_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent: text("agent").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_memory_agent_key_unique").on(t.agent, t.key)],
);

export const deliveryStatus = pgTable(
  "delivery_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    client_id: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    order_id: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    client_name: text("client_name").notNull().default("Walk-in"),
    pack: text("pack").notNull().default("unknown"),
    method: text("method").notNull().default("unknown"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    qa_status: text("qa_status").notNull().default("pending"),
    checks: jsonb("checks").notNull().default({}),
    notes: text("notes"),
    verified_at: timestamp("verified_at", { withTimezone: true, mode: "string" }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("idx_delivery_status_order").on(t.order_id), index("idx_delivery_status_status").on(t.qa_status)],
);

/** Drizzle maps only the six public business tables. Authentication is owned
 * by Neon Managed Auth and its neon_auth schema; no auth migrations are run here. */
export const schema = {
  leads,
  clients,
  orders,
  activity_log: activityLog,
  agent_memory: agentMemory,
  delivery_status: deliveryStatus,
};
