/**
 * Neon Postgres connection for the app (server + serverless).
 *
 * Uses the Neon serverless driver over HTTP — ideal for Vercel functions
 * (no TCP sockets, no connection pooling to manage) — wrapped by Drizzle.
 *
 * The DATABASE_URL / NEON_DATABASE_URL secret is provided by the user
 * (Neon Console → Dashboard → Connection Details → "Pooled" connection).
 * It is NEVER exposed to the browser; the frontend talks to this app's
 * /api/* routes only.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";

export const isDbConfigured = connectionString.length > 0;

if (!isDbConfigured && process.env.NODE_ENV === "production" && process.env.VERCEL) {
  // Fail loudly at runtime in production instead of serving auth errors.
  console.warn("[db] DATABASE_URL is not set — auth and data API will return 503.");
}

/** Raw Neon HTTP SQL client (tagged-template queries). Null when unconfigured —
 * `neon("")` throws, so it must never be constructed without a URL. */
export const sql = isDbConfigured ? neon(connectionString) : null;

/** Drizzle ORM client bound to the full schema. Null when unconfigured; API
 * routes guard with `if (!db) return dbUnavailable(res)` which also narrows
 * the type to non-null for the rest of the handler. */
export const db = sql ? drizzle(sql, { schema }) : null;

export { schema };
