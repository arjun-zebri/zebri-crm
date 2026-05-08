-- Lookup table mapping Stripe customer IDs to Supabase user IDs.
-- Webhook handlers fall back to this table when the Stripe event metadata
-- does not include supabase_user_id, so we never lose track of paying users.

create table public.stripe_customers (
  stripe_customer_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create index idx_stripe_customers_user_id on public.stripe_customers(user_id);

alter table public.stripe_customers enable row level security;
-- No policies: service role bypasses RLS, all client access denied.
