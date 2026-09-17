-- Delivery & Quality Assurance — real per-client delivery records.
-- Ops Manager registers every sold pack automatically (status 'pending');
-- the Error Handler runs REAL functional checks on paid packs and records
-- the verdict. No simulation: a pending row is an honest "not yet delivered".

create table if not exists public.delivery_status (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  client_name text not null default 'Walk-in',
  pack text not null default 'unknown',
  method text not null default 'unknown',
  amount numeric(12,2) not null default 0,
  qa_status text not null default 'pending' check (qa_status in ('pending','passed','failed')),
  checks jsonb not null default '{}'::jsonb,
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.delivery_status is 'Automatic delivery QA: one row per sold pack, verified by the Error Handler bot.';

alter table public.delivery_status enable row level security;

drop policy if exists "delivery_status read for authenticated" on public.delivery_status;
create policy "delivery_status read for authenticated"
  on public.delivery_status for select
  to authenticated
  using (true);

-- Service-role (bots) bypasses RLS; no anon access: only staff see QA state.

create index if not exists idx_delivery_status_order on public.delivery_status(order_id);
create index if not exists idx_delivery_status_status on public.delivery_status(qa_status);
