-- Phase 0.8b: §7.4 fix — back-fill entitlement fields into auth.users.raw_app_meta_data
--
-- Until now every entitlement decision (admin, paywall, Stripe billing/Connect
-- identity, beta pricing) read from `auth.users.raw_user_meta_data`. That JSONB
-- column is writable by the user via `supabase.auth.updateUser({ data: … })`
-- so an attacker could self-elevate to admin, set `subscription_status:active`
-- to bypass the paywall, or alter `stripe_connect_account_id` to redirect payouts.
--
-- This migration copies the existing values into `raw_app_meta_data` (which IS
-- server-only writable). Going forward, the entitlements helper
-- (`@/lib/auth/entitlements`) treats `app_metadata.account_type` as the
-- "migrated" sentinel and reads exclusively from app_metadata once present.
--
-- Idempotent: WHERE clause makes re-runs no-ops; jsonb_strip_nulls keeps the
-- resulting object tidy by removing entries whose source value was null.
-- Safe re: schema (UPDATE only — no data is dropped or truncated).

update auth.users
set raw_app_meta_data = jsonb_strip_nulls(
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    -- Sentinel — default to 'vendor' so EVERY user is marked migrated.
    'account_type',
      coalesce(
        raw_app_meta_data->>'account_type',
        raw_user_meta_data->>'account_type',
        'vendor'
      ),

    -- Subscription / paywall fields.
    'subscription_status', raw_user_meta_data->>'subscription_status',
    'subscription_plan',   raw_user_meta_data->>'subscription_plan',
    'is_subscribed',       raw_user_meta_data->'is_subscribed',
    'trial_end',           raw_user_meta_data->>'trial_end',
    'subscription_end',    raw_user_meta_data->>'subscription_end',
    'is_beta_user',        raw_user_meta_data->'is_beta_user',

    -- Stripe billing / Connect identities (set by webhooks / Connect callback).
    'stripe_customer_id',         raw_user_meta_data->>'stripe_customer_id',
    'stripe_subscription_id',     raw_user_meta_data->>'stripe_subscription_id',
    'stripe_connect_account_id',  raw_user_meta_data->>'stripe_connect_account_id',
    'stripe_connect_enabled',     raw_user_meta_data->'stripe_connect_enabled'
  )
)
-- Only operate on users not yet migrated. Cheap re-run guard.
where (raw_app_meta_data->>'account_type') is null;


-- ─── auth.users INSERT trigger ─────────────────────────────────────────
-- New signups (via supabase.auth.signUp({ options: { data: {…} } })) put
-- fields in user_metadata. Without this trigger their app_metadata would
-- be empty and the entitlements helper would treat them as "not migrated"
-- — falling back to attacker-writable user_metadata for security reads.
-- The trigger copies the same set of entitlement fields on INSERT only;
-- subsequent UPDATEs are NOT mirrored so user_metadata can never poison
-- app_metadata after the row exists.

create or replace function public.sync_signup_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.raw_app_meta_data := jsonb_strip_nulls(
    coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'account_type',
        coalesce(
          new.raw_app_meta_data->>'account_type',
          new.raw_user_meta_data->>'account_type',
          'vendor'
        ),
      'subscription_status', new.raw_user_meta_data->>'subscription_status',
      'subscription_plan',   new.raw_user_meta_data->>'subscription_plan',
      'is_subscribed',       new.raw_user_meta_data->'is_subscribed',
      'trial_end',           new.raw_user_meta_data->>'trial_end',
      'subscription_end',    new.raw_user_meta_data->>'subscription_end',
      'is_beta_user',        new.raw_user_meta_data->'is_beta_user',
      'stripe_customer_id',         new.raw_user_meta_data->>'stripe_customer_id',
      'stripe_subscription_id',     new.raw_user_meta_data->>'stripe_subscription_id',
      'stripe_connect_account_id',  new.raw_user_meta_data->>'stripe_connect_account_id',
      'stripe_connect_enabled',     new.raw_user_meta_data->'stripe_connect_enabled'
    )
  );
  return new;
end;
$$;

drop trigger if exists sync_signup_app_metadata_on_insert on auth.users;
create trigger sync_signup_app_metadata_on_insert
  before insert on auth.users
  for each row execute function public.sync_signup_app_metadata();


-- ─── Re-author enforce_starter_couple_limit to read from app_metadata ──
-- The 20260508100000 version read subscription_status/plan from
-- raw_user_meta_data — which is user-writable, so an attacker could set
-- subscription_plan='pro' and bypass the 5-couple cap. The fix: read
-- from raw_app_meta_data (server-only-writable). A coalesced fallback
-- to user_metadata stays in for the transition window while in-flight
-- JWT-aware code still trusts the old shape; gated on "app_metadata
-- not yet migrated for this user" — i.e. the same sentinel the JS
-- helper uses (account_type absent in app_metadata).

create or replace function public.enforce_starter_couple_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  app_meta jsonb;
  user_meta jsonb;
  is_migrated boolean;
  status text;
  plan text;
  couple_count int;
begin
  select coalesce(raw_app_meta_data, '{}'::jsonb), coalesce(raw_user_meta_data, '{}'::jsonb)
    into app_meta, user_meta
  from auth.users
  where id = new.user_id;

  is_migrated := (app_meta ? 'account_type');

  if is_migrated then
    -- Trust app_metadata only. user_metadata is ignored to block §7.4 escalation.
    status := app_meta->>'subscription_status';
    plan := app_meta->>'subscription_plan';
  else
    -- Transition fallback for users not yet backfilled. Same semantics as
    -- the JS helper at @/lib/auth/entitlements.
    status := coalesce(app_meta->>'subscription_status', user_meta->>'subscription_status');
    plan := coalesce(app_meta->>'subscription_plan', user_meta->>'subscription_plan');
  end if;

  -- Paid plan (active or trialing) → no cap.
  if status in ('active', 'trialing') and plan in ('pro', 'max') then
    return new;
  end if;

  -- Starter cap: 5 couples.
  select count(*) into couple_count
  from public.couples
  where user_id = new.user_id;

  if couple_count >= 5 then
    raise exception 'STARTER_COUPLE_LIMIT'
      using hint = 'Upgrade to Pro or Max to add more couples.';
  end if;

  return new;
end;
$$;
