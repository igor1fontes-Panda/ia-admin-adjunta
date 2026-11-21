-- Only users explicitly promoted in Supabase app_metadata may access operational data.
-- Never use raw_user_meta_data for authorization: users can edit it themselves.

 drop policy if exists "leads_admin_all" on public.leads;
 create policy "leads_admin_all" on public.leads
   for all to authenticated
   using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
   with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

 drop policy if exists "clients_admin_all" on public.clients;
 create policy "clients_admin_all" on public.clients
   for all to authenticated
   using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
   with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

 drop policy if exists "orders_admin_all" on public.orders;
 create policy "orders_admin_all" on public.orders
   for all to authenticated
   using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
   with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

 drop policy if exists "activity_admin_all" on public.activity_log;
 create policy "activity_admin_all" on public.activity_log
   for all to authenticated
   using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
   with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Agent memory is internal operational data: no anonymous reads, and only
-- explicitly promoted administrators may inspect or modify it.
alter table public.agent_memory
  drop constraint if exists agent_memory_agent_check;
alter table public.agent_memory
  add constraint agent_memory_agent_check
  check (agent in ('lead_qualifier', 'growth_marketing', 'error_handler', 'insight_engine'));

drop policy if exists "agent_memory_public_read" on public.agent_memory;
drop policy if exists "agent_memory_admin_all" on public.agent_memory;
create policy "agent_memory_admin_all" on public.agent_memory
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
