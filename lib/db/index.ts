import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Neon Postgres connection for the Next.js surface (lib/auth + src/app/api/*).
 *
 * Module-load must never throw: `next build` collects page data in
 * credential-less environments, and `src/app/page.tsx` imports `lib/auth` →
 * `lib/db` at build time. Unset DATABASE_URL degrades to `pool: null` /
 * `db: null` (the API surface answers 503), matching the null-safe pattern
 * of the Vite-side `db/index.ts`.
 */
const connectionString = process.env.DATABASE_URL ?? process.env.NEON_POSTGRES_URL ?? "";

export const isDbConfigured = connectionString.length > 0;

export const pool = isDbConfigured ? new Pool({ connectionString }) : null;

export const db = pool ? drizzle(pool, { schema }) : null;
