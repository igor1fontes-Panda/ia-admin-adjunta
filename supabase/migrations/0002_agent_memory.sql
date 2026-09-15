-- Agent learning memory — REAL outcomes only.
-- Each agent persists what it LEARNED from real data: which channels convert,
-- which incident fixes work, and the current sales strategy.
-- Idempotent: safe to run multiple times.

-- ============ TABLE ============

create table if not exists public.agent_memory (
  agent text not null check (agent in ('lead_qualifier','insight_engine','error_handler')),
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (agent, key)
);

-- ============ ROW LEVEL SECURITY ============

alter table public.agent_memory enable row level security;

drop policy if exists "agent_memory_admin_all" on public.agent_memory;
create policy "agent_memory_admin_all" on public.agent_memory
  for all to authenticated using (true) with check (true);

-- Anonymous: read-only. Strategy/learning is public by design — the bots
-- write it with the service-role key (bypasses RLS).
drop policy if exists "agent_memory_public_read" on public.agent_memory;
create policy "agent_memory_public_read" on public.agent_memory
  for select to anon using (true);

-- ============ REALTIME ============

do $$
begin
  alter publication supabase_realtime add table public.agent_memory;
exception
  when duplicate_object then null;
  when insufficient_privilege then null; -- toggle in Dashboard → Database → Replication
end $$;

-- ============ INDEX ============

create index if not exists agent_memory_agent_idx on public.agent_memory (agent);
