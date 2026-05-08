-- Enforce the 5-couple cap for users on Starter (free) tier.
-- A user is on Starter unless their auth.users.raw_user_meta_data has
-- subscription_status in ('active','trialing') AND subscription_plan in ('pro','max').
-- Existing rows are unaffected — only new inserts are checked.

create or replace function public.enforce_starter_couple_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  meta jsonb;
  status text;
  plan text;
  couple_count int;
begin
  select raw_user_meta_data into meta
  from auth.users
  where id = new.user_id;

  status := meta->>'subscription_status';
  plan := meta->>'subscription_plan';

  -- Paid plan (active or trialing) → no cap
  if status in ('active', 'trialing') and plan in ('pro', 'max') then
    return new;
  end if;

  -- Starter cap: 5 couples
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

drop trigger if exists enforce_starter_couple_limit on public.couples;
create trigger enforce_starter_couple_limit
  before insert on public.couples
  for each row execute function public.enforce_starter_couple_limit();
