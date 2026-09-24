/**
 * Drizzle schema — Fontes AI Admin Adjunta
 * Target: Neon Postgres (serverless).
 *
 * Business tables mirror the Supabase migrations (0001..0005) one-to-one so
 * the dashboard, bots and engine logic behave identically. Better Auth adds
 * its own user/session/account/verification tables in the same database.
 *
 * Conventions kept from the Supabase era: snake_case columns, uuid PKs,
 * timestamptz created_at, enum values enforced in the API layer.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

// ============ BETTER AUTH TABLES ============
// Required columns per Better Auth's core schema (user/session/account/verification).

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_email_unique").on(t.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("session_token_unique").on(t.token), index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const schema = {
  leads,
  clients,
  orders,
  activity_log: activityLog,
  agent_memory: agentMemory,
  delivery_status: deliveryStatus,
  user,
  session,
  account,
  verification,
};
