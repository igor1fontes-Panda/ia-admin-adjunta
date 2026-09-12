-- Fontes AI Admin Adjunta — production schema
-- Run in Supabase SQL Editor (or `supabase db push`).

-- ============ TABLES ============

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null,
  email text not null,
  niche text not null default 'SaaS',
  channel text not null default 'website',
  score int not null default 50 check (score between 0 and 100),
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost')),
  ai_action text,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  plan text not null default 'starter' check (plan in ('starter','professional','enterprise')),
  mrr numeric(12,2) not null default 0,
  status text not null default 'active' check (status in ('active','trialing','churned')),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'AOA',
  method text not null default 'multicaixa',
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  reference text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'system' check (kind in ('bot','system','sale','lead')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists activity_created_idx on public.activity_log (created_at desc);

-- ============ ROW LEVEL SECURITY ============
-- Authenticated users (the admin) get full access to business data.
-- Anonymous visitors can only insert leads via the public website form
-- and read nothing.

alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.activity_log enable row level security;

-- Authenticated: full control
create policy "leads_admin_all" on public.leads
  for all to authenticated using (true) with check (true);
create policy "clients_admin_all" on public.clients
  for all to authenticated using (true) with check (true);
create policy "orders_admin_all" on public.orders
  for all to authenticated using (true) with check (true);
create policy "activity_admin_all" on public.activity_log
  for all to authenticated using (true) with check (true);

-- Anonymous: public lead capture only (never read)
create policy "leads_public_insert" on public.leads
  for insert to anon with check (true);

-- ============ SERVICE-ROLE HELPER (bots use service key, bypasses RLS) ============
-- Bots run with SUPABASE_SERVICE_ROLE_KEY and need no extra policies.

-- ============ SEED ============

insert into public.activity_log (kind, message) values
  ('system', 'Database initialized — Fontes AI Admin Adjunta production schema v1.0')
on conflict do nothing;
