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
