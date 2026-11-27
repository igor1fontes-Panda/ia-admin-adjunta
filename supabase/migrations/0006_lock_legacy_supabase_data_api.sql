-- Restrict the legacy Supabase Data API surface.
-- The current application data plane is Neon + server-side API routes (Better Auth/Clerk).
-- Legacy bots may continue using the server-only service_role key.
-- Do NOT apply to production until the service-role integrations and rollback are verified.

begin;

-- Remove broad inherited access from browser-facing roles. The app's current
-- browser does not query Supabase directly; all current dashboard reads/writes
-- use authenticated /api/* routes backed by Neon.
revoke all privileges on table
  public.leads,
  public.clients,
  public.orders,
  public.activity_log,
  public.agent_memory,
  public.delivery_status
from public, anon, authenticated;

-- Preserve the documented server-only bot integration.
grant select, insert, update, delete on table
  public.leads,
  public.clients,
  public.orders,
  public.activity_log,
  public.agent_memory,
  public.delivery_status
to service_role;

-- These tables remain protected by RLS as defense in depth. service_role
-- bypasses RLS by design; anon/authenticated have no table privileges.
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.activity_log enable row level security;
alter table public.agent_memory enable row level security;
alter table public.delivery_status enable row level security;

commit;
