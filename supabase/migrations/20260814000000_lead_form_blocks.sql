-- Website form (block-based) - extends ZEB-2 lead capture.
--
-- Builds on 20260803000000_add_lead_capture_forms.sql. Three changes:
--   1. New form_submissions table: the raw enquiry payload is stored owner-
--      isolated so a lead is never lost, even when the couple insert is blocked
--      by the Starter plan limit. The SECURITY DEFINER submit_lead RPC owns the
--      inserts, so anon never touches the table and cross-tenant writes are
--      impossible (mirrors the lead_capture_forms ingest posture).
--   2. get_lead_form now returns the saved `lead` surface block tree so the
--      public /lead/[token] page can render the MC-designed form.
--   3. submit_lead stores the submission first, folds custom fields into the
--      couple notes, then links the created couple back to the submission.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

-- 1. form_submissions - owner-isolated raw enquiry storage.
create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references couples(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index form_submissions_user_id_idx on form_submissions(user_id);
create index form_submissions_created_at_idx on form_submissions(created_at desc);

alter table form_submissions enable row level security;
create policy "form_submissions_user_isolation" on form_submissions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No anon grant on form_submissions: the SECURITY DEFINER submit_lead RPC owns
-- every insert, so the anon client never touches the table directly.

-- 2. get_lead_form - anon read for rendering the public form. Adds the saved
-- `lead` surface block tree so the public page can render the MC-designed form.
-- Returns null for a missing/disabled token (no existence leak); merges the MC
-- branding scalars.
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
    ),
    -- The saved `lead` surface block tree, or JSON null when the MC has not
    -- customised the form (public page falls back to its fixed field set).
    'blocks', coalesce(
      (select branding_blocks->'lead' from user_branding where user_id = f.user_id),
      'null'::jsonb
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

grant execute on function get_lead_form(uuid) to anon;

-- 3. submit_lead - anon ingest. Stores the raw submission FIRST so a lead is
-- never lost, then attempts the couple insert and links couple_id back. Custom
-- fields (p_payload->'custom') fold into the couple notes as "Label: value"
-- lines. The Starter couple-limit trigger surfaces as a typed plan_limit result
-- rather than a 500, and the stored submission is kept (couple_id stays null).
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
  v_submission_id uuid;
  v_couple_id uuid;
  v_notes text;
  v_custom jsonb;
  v_item jsonb;
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

  -- Store the raw submission first so nothing is ever lost, even if the couple
  -- insert is blocked by the plan limit below.
  insert into form_submissions (user_id, payload)
  values (f.user_id, p_payload)
  returning id into v_submission_id;

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

  -- Notes = the message, then any custom "Label: value" lines. `custom` is a
  -- jsonb array of {label,value}; guard the type so a malformed payload cannot
  -- break ingest.
  v_notes := nullif(btrim(coalesce(p_payload->>'message', '')), '');
  v_custom := p_payload->'custom';
  if jsonb_typeof(v_custom) = 'array' then
    for v_item in select * from jsonb_array_elements(v_custom) loop
      v_notes := btrim(concat_ws(E'\n', v_notes,
        concat(coalesce(v_item->>'label', ''), ': ', coalesce(v_item->>'value', ''))));
    end loop;
  end if;

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
      nullif(v_notes, ''),
      nullif(btrim(coalesce(p_payload->>'referral_source', '')), ''),
      'website',
      v_status
    )
    returning id into v_couple_id;
  exception
    when others then
      if sqlerrm = 'STARTER_COUPLE_LIMIT' then
        -- Keep the stored submission (couple_id stays null) so the lead is not
        -- lost; the route notifies the MC about the blocked enquiry.
        return jsonb_build_object(
          'error', 'plan_limit',
          'mc_email', (select email from auth.users where id = f.user_id),
          'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
        );
      end if;
      raise;
  end;

  -- Link the created couple back to its submission.
  update form_submissions set couple_id = v_couple_id where id = v_submission_id;

  return jsonb_build_object(
    'ok', true,
    'mc_email', (select email from auth.users where id = f.user_id),
    'business_name', coalesce((select raw_user_meta_data->>'business_name' from auth.users where id = f.user_id), '')
  );
end;
$$;

grant execute on function submit_lead(uuid, jsonb) to anon;
