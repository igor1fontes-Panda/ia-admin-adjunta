-- Run after 0006_lock_legacy_supabase_data_api.sql in an isolated Supabase DB.
-- This is a privilege contract test, not a production migration.

do $$
declare
  t text;
  tbls text[] := array[
    'public.leads',
    'public.clients',
    'public.orders',
    'public.activity_log',
    'public.agent_memory',
    'public.delivery_status'
  ];
  role_name text;
  privilege_name text;
begin
  foreach t in array tbls loop
    if not (select c.relrowsecurity from pg_class c where c.oid = t::regclass) then
      raise exception 'RLS is not enabled on %', t;
    end if;

    foreach role_name in array array['anon', 'authenticated'] loop
      foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if has_table_privilege(role_name, t, privilege_name) then
          raise exception 'Unexpected % privilege for % on %', privilege_name, role_name, t;
        end if;
      end loop;
    end loop;

    foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('service_role', t, privilege_name) then
        raise exception 'Missing service_role % privilege on %', privilege_name, t;
      end if;
    end loop;
  end loop;

  if not (select rolbypassrls from pg_roles where rolname = 'service_role') then
    raise exception 'service_role is expected to bypass RLS for server-only bot operations';
  end if;
end $$;
