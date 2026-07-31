-- ZEB-2 - embeddable lead-capture forms.
--
-- One form per MC (unique user_id). The capture_token is the public
-- capability for the /lead/[token] surface, mirroring couples.portal_token
-- and couple_questionnaires.share_token. Ingest goes through the
-- submit_lead SECURITY DEFINER RPC (granted to anon) which derives the
-- owning user_id from the token, so the anon client never touches the
-- table directly and cross-tenant writes are impossible.

create table lead_capture_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  capture_token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default true,
  -- couple_statuses.slug the lead lands in; null falls back to first by position.
  target_status_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_capture_forms_capture_token_idx on lead_capture_forms(capture_token);

alter table lead_capture_forms enable row level security;
create policy "lead_capture_forms_user_isolation"
  on lead_capture_forms for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- touch_updated_at() already exists (contracts migration).
create trigger lead_capture_forms_touch_updated_at
  before update on lead_capture_forms
  for each row execute function touch_updated_at();

-- "How did you hear about me" answer, surfaced across the couple UI.
alter table couples add column referral_source text;

-- get_lead_form - anon read for rendering the public form. Returns null for a
-- missing/disabled token (no existence leak); merges the MC branding scalars.
create or replace function get_lead_form(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'enabled', f.enabled,
    'business_name', coalesce(
      u.raw_user_meta_data->>'business_name',
      u.raw_user_meta_data->>'display_name',
      ''
    )
  ) || coalesce(_user_branding(f.user_id), '{}'::jsonb)
  into result
  from lead_capture_forms f
  join auth.users u on u.id = f.user_id
  where f.capture_token = token
    and f.enabled = true;

  return result;
end;
$$;

-- submit_lead - anon ingest. Validates the token, resolves the landing
-- status, and inserts a couple owned by the token issuer with
-- lead_source='website'. The Starter couple-limit trigger surfaces as a
-- typed plan_limit result rather than a 500 so the route can notify the MC.
create or replace function submit_lead(token uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  f record;
  v_status text;
  v_name text;
  v_email text;
begin
  select * into f
  from lead_capture_forms
  where capture_token = token and enabled = true;

  if not found then
    return '{"error":"not_found"}'::jsonb;
  end if;

  v_name := nullif(btrim(coalesce(p_payload->>'name', '')), '');
  if v_name is null then
    return '{"error":"invalid"}'::jsonb;
  end if;

  -- Landing status: chosen slug if it still exists, else first by position,
  -- else a safe literal so ingest never fails on a statusless account.
  select cs.slug into v_status
  from couple_statuses cs
  where cs.user_id = f.user_id and cs.slug = f.target_status_slug;

  if v_status is null then
    select cs.slug into v_status
    from couple_statuses cs
    where cs.user_id = f.user_id
    order by cs.position asc, cs.created_at asc
    limit 1;
  end if;
  v_status := coalesce(v_status, 'new');

  v_email := nullif(btrim(coalesce(p_payload->>'email', '')), '');

  begin
    insert into couples (
      user_id, name, primary_name, secondary_name,
      email, primary_email, phone, primary_phone,
      event_date, venue, notes, referral_source, lead_source, status
    ) values (
      f.user_id,
      v_name, v_name,
      nullif(btrim(coalesce(p_payload->>'partner_name', '')), ''),
      v_email, v_email,
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
      (nullif(btrim(coalesce(p_payload->>'wedding_date', '')), ''))::date,
      nullif(btrim(coalesce(p_payload->>'venue', '')), ''),
      nullif(btrim(coalesce(p_payload->>'message', '')), ''),
      nullif(btrim(coalesce(p_payload->>'referral_source', '')), ''),
      'website',
      v_status
    );
  exception
    when others then
      if sqlerrm = 'STARTER_COUPLE_LIMIT' then
        return jsonb_build_object(
          'error', 'plan_limit',
          'mc_email', (select email from auth.users where id = f.user_id),
          'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
        );
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'mc_email', (select email from auth.users where id = f.user_id),
    'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
  );
end;
$$;

grant execute on function get_lead_form(uuid) to anon;
grant execute on function submit_lead(uuid, jsonb) to anon;
