-- Stripe webhook fulfillment is idempotent on the provider session reference.
-- Apply this migration in the connected Supabase project before enabling live checkout.
create unique index if not exists orders_reference_unique on public.orders (reference);
