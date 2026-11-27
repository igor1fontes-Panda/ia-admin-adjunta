# Supabase legacy Data API lockdown — review notes

## Why this migration is proposed

The current Admin Adjunta browser data layer calls same-origin `/api/*` routes. Those routes validate Better Auth or Clerk sessions and read/write Neon through Drizzle. The browser does not call Supabase directly.

Legacy scheduled bots still have a fallback to Supabase using a server-only `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. Those server integrations must remain functional.

The existing Supabase migrations 0001 and 0002 grant broad `authenticated` access, and migration 0004 narrows those policies to a Supabase JWT `app_metadata.role=admin` claim. The current application session is Better Auth/Clerk, not a Supabase Auth JWT. Therefore, relying on that claim does not establish the current dashboard's access control. The proposed boundary is: no direct Data API table access for `anon` or `authenticated`; server-only service_role access remains for legacy bots.

## Files

- `supabase/migrations/0006_lock_legacy_supabase_data_api.sql`: candidate restriction.
- `supabase/tests/0006_lock_legacy_supabase_data_api.sql`: privilege contract test.

## Remote-state evidence captured 2026-11-27

A read-only query against the connected Supabase project found only five of the six expected business tables: `activity_log`, `agent_memory`, `clients`, `leads`, and `orders`. `delivery_status` is absent. The remote migration history also remains inconsistent with the repository migration sequence. Therefore this candidate migration depends on the missing `0005_delivery_qa.sql` being safely reconciled/applied first in an isolated environment. The candidate must not be applied to the current remote project as-is.

The same read-only privilege query confirmed `anon` and `authenticated` currently have table privileges (including SELECT/INSERT/UPDATE/DELETE) on those five tables, while `service_role` also has those privileges. This corroborates the need for a least-privilege correction, but does not itself prove that every privilege is exploitable through RLS; RLS policies also apply to non-bypass roles.

## Required pre-merge checks

1. Enumerate active GitHub Actions and external bot deployments using the Supabase service-role key.
2. Confirm no supported client depends on direct Supabase `anon` or `authenticated` table access.
3. Run migration and SQL test against an isolated Supabase database/branch.
4. Test service-role reads, inserts, updates and upserts used by the bots.
5. Test public lead submission through `POST /api/leads` (Neon path).
6. Confirm rollback procedure and current remote migration history.

## Explicit non-actions

- No migration has been applied to Supabase.
- No policies, grants, keys, users, or production settings have been changed.
- This proposal does not repair the remote migration history mismatch.
- Do not run the existing `scripts/fix-supabase-migrations.sh fix` against production as part of this PR.
