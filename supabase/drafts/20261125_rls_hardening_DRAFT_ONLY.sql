-- DRAFT ONLY — DO NOT APPLY TO THE CONNECTED PROJECT YET.
-- Prepared after a read-only comparison of the Supabase live policies.
-- Preconditions before applying:
--   1. Reconcile the remote migration history with local migrations 0003–0005.
--   2. Confirm all service workloads use SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY.
--   3. Confirm an administrator's Supabase JWT carries app_metadata.role = 'admin'.
--   4. Test this migration against a disposable Supabase project and verify rollback.
--
-- Intended policy model:
--   * anon: no direct access to operational tables.
--   * authenticated: full CRUD only when the signed Supabase JWT has
--     app_metadata.role = 'admin'.
--   * service_role: retains its normal RLS bypass for trusted server workloads.
--
-- The current app's dashboard/auth/data API has moved to Better Auth + Neon.
-- The Python insight engine still reads/writes Supabase using the service key.
-- Do not replace that service key with an anon/publishable key.

begin;

-- Remove legacy public policies first.
drop policy if exists "agent_memory_public_read" on public.agent_memory;
drop policy if exists "leads_public_insert" on public.leads;

-- Recreate explicit administrator-only policies. The claim is read from
-- app_metadata, which users cannot modify through ordinary user metadata APIs.
drop policy if exists "agent_memory_admin_all" on public.agent_memory;
create policy "agent_memory_admin_all"
  on public.agent_memory
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "leads_admin_all" on public.leads;
create policy "leads_admin_all"
  on public.leads
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "clients_admin_all" on public.clients;
create policy "clients_admin_all"
  on public.clients
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
  on public.orders
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "activity_admin_all" on public.activity_log;
create policy "activity_admin_all"
  on public.activity_log
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Remove broad table grants from the public/anonymous API role. The trusted
-- service_role is intentionally not modified and continues to bypass RLS.
revoke all on table
  public.agent_memory,
  public.leads,
  public.clients,
  public.orders,
  public.activity_log
from anon;

-- Authenticated users need table privileges for RLS to evaluate; the policies
-- above still deny all rows and writes unless app_metadata.role = 'admin'.
grant select, insert, update, delete on table
  public.agent_memory,
  public.leads,
  public.clients,
  public.orders,
  public.activity_log
to authenticated;

commit;
