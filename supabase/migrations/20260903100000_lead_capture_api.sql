-- Public lead-capture API.
--
-- 1. lead_capture_forms.allowed_origins: per-form CORS allowlist. Origins are
--    stored exactly as a browser sends them in the Origin header
--    (scheme://host[:port], lowercase, no path). The GIN index backs the
--    preflight lookup "is this origin registered on any form?", which has no
--    token to scope by (a CORS preflight carries no body).
-- 2. source_origin on form_submissions and couples: the origin of the site the
--    enquiry was posted from. Server-computed by the submit route (request
--    Origin for a third-party form, the embed's referrer origin for our own
--    iframe), never visitor-supplied. Null for the hosted page and for
--    server-side posts. lead_source stays 'website'; this answers "which site".
-- 3. submit_lead gains p_source_origin. The two-argument overload is dropped
--    because a defaulted third argument would make the two-argument call
--    ambiguous for PostgREST.
--
-- Not destructive: new nullable/defaulted columns, one function overload
-- replaced by a superset. DROP FUNCTION is not in the destructive gate.

alter table lead_capture_forms
  add column allowed_origins text[] not null default '{}';

create index lead_capture_forms_allowed_origins_idx
  on lead_capture_forms using gin (allowed_origins);

alter table form_submissions add column source_origin text;
alter table couples add column source_origin text;

drop function if exists public.submit_lead(uuid, jsonb);

create or replace function submit_lead(
  token uuid,
  p_payload jsonb,
  p_source_origin text default null
)
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
  v_origin text;
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

  -- Cap defensively; the route already reduces this to an origin.
  v_origin := nullif(left(btrim(coalesce(p_source_origin, '')), 200), '');

  -- Store the raw submission first so nothing is ever lost, even if the couple
  -- insert is blocked by the plan limit below.
  insert into form_submissions (user_id, payload, source_origin)
  values (f.user_id, p_payload, v_origin)
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
      event_date, venue, notes, referral_source, lead_source, status,
      source_origin
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
      v_status,
      v_origin
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

grant execute on function submit_lead(uuid, jsonb, text) to anon;
