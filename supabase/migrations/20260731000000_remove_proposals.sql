-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
-- Remove the proposal feature in full: tables, FK columns, RPCs, and the
-- dead branding-block trees and orphaned automation rows that reference it.
-- Invoices become fully manual (signing a contract no longer creates one).

-- ────────────────────────────────────────────────────────────────
-- 1. Data cleanup — must land WITH the drops, not after.
-- ────────────────────────────────────────────────────────────────

-- Orphaned automations: any automation whose trigger is a proposal trigger,
-- or whose actions send/create-from a proposal. Their automation_actions,
-- automation_runs, automation_waits, automation_events, and
-- automation_audit_log children cascade via ON DELETE CASCADE. Deleting the
-- rows before the registry code loses these entries stops the automations
-- tick throwing on the first proposal-triggered row it meets.
-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
delete from public.automations
where trigger_type in (
  'proposal_sent', 'proposal_accepted', 'proposal_declined',
  'proposal_due', 'proposal_overdue'
)
or id in (
  select automation_id from public.automation_actions
  where type in ('send_proposal', 'create_invoice_from_proposal')
);

-- Strip the `proposal` key from every branding block tree. Leaving it would
-- keep dead trees that validate-blocks no longer has a schema for.
update public.user_branding
set branding_blocks = branding_blocks - 'proposal'
where branding_blocks ? 'proposal';

-- The enabled_surfaces column default (set by 20260717000000_branding_overhaul)
-- and existing rows still list the removed 'proposal' surface. Drop it from the
-- default and from every stored row so new and existing users see 5 surfaces.
alter table public.user_branding
  alter column enabled_surfaces
  set default '["invoice", "contract", "portal", "vendorTimeline", "questionnaire"]'::jsonb;

update public.user_branding
set enabled_surfaces = enabled_surfaces - 'proposal'
where enabled_surfaces ? 'proposal';

-- ────────────────────────────────────────────────────────────────
-- 2. Drop the proposal RPCs (their anon grants go with them).
-- ────────────────────────────────────────────────────────────────

drop function if exists public.get_public_proposal(uuid);
drop function if exists public.accept_proposal(uuid, uuid, jsonb);
drop function if exists public.decline_proposal(uuid);
drop function if exists public.generate_proposal_number(uuid);

-- ────────────────────────────────────────────────────────────────
-- 3. Rewrite sign_contract without the proposal→invoice branch.
--    Signing records the signature and creates nothing (invoices are
--    fully manual now). Signature + return shape are unchanged.
-- ────────────────────────────────────────────────────────────────

create or replace function public.sign_contract(
  token uuid,
  p_signer_name text,
  p_signer_ip text,
  p_signer_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_now timestamptz := now();
begin
  select * into v_contract
  from public.contracts
  where share_token = token
    and share_token_enabled = true
    and status = 'sent'
  for update;

  if v_contract is null then
    return jsonb_build_object('error', 'not_found_or_not_sent');
  end if;

  if v_contract.expires_at is not null and v_contract.expires_at < current_date then
    update public.contracts set status = 'expired' where id = v_contract.id;
    return jsonb_build_object('error', 'expired');
  end if;

  -- Audit row first — survives any later revoke.
  perform public.emit_contract_audit_event(
    p_contract_id := v_contract.id,
    p_event_type := 'signed',
    p_actor := 'couple',
    p_actor_ip := p_signer_ip,
    p_actor_user_agent := p_signer_user_agent,
    p_signer_name_typed := p_signer_name
  );

  update public.contracts
  set status = 'signed',
      signed_at = v_now,
      signer_name = p_signer_name,
      signer_ip = p_signer_ip,
      signer_user_agent = p_signer_user_agent
  where id = v_contract.id;

  -- Update couple status to 'confirmed' on first signed contract.
  update public.couples
  set status = 'confirmed'
  where id = v_contract.couple_id and status in ('lead', 'enquiry', 'quoted');

  -- No invoice is created on signing. Invoices are fully manual.

  -- Follow-up task for the MC.
  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract signed - follow up with couple',
    'todo'
  );

  return jsonb_build_object('ok', true, 'contract_id', v_contract.id);
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 4. Rewrite get_portal_data without the payments.proposals key.
--    Every other key is unchanged.
-- ────────────────────────────────────────────────────────────────

create or replace function public.get_portal_data(token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id        uuid;
  v_user_id          uuid;
  v_viewer           text;
  v_event_id         uuid;
  v_portal_sections  jsonb;
  result             jsonb;
begin
  select couple_id, owner_id, viewer into v_couple_id, v_user_id, v_viewer
  from _resolve_portal_couple(token);

  if v_couple_id is null then
    return null;
  end if;

  select id into v_event_id
  from events
  where couple_id = v_couple_id
  order by
    case when date >= current_date then 0 else 1 end,
    date asc
  limit 1;

  select portal_sections into v_portal_sections
  from public.user_branding
  where user_id = v_user_id;

  if v_portal_sections is null then
    select raw_user_meta_data -> 'portal_sections'
    into v_portal_sections
    from auth.users
    where id = v_user_id;
  end if;

  select jsonb_build_object(
    'viewer',           v_viewer,
    'couple_id',        v_couple_id,
    'couple_name',      c.name,
    'couple_email',     c.email,
    'primary_name',     c.primary_name,
    'primary_email',    c.primary_email,
    'primary_phone',    c.primary_phone,
    'secondary_name',   c.secondary_name,
    'secondary_email',  c.secondary_email,
    'secondary_phone',  c.secondary_phone,
    'enabled_sections', case
      when v_portal_sections is null then null
      else (
        select jsonb_agg(key order by key)
        from jsonb_each_text(v_portal_sections)
        where value = 'true'
      )
    end,
    'event', case when v_event_id is not null then
      jsonb_build_object('id', e.id, 'date', e.date::text, 'venue', e.venue)
    else null end,
    'events', coalesce(
      (select jsonb_agg(jsonb_build_object('id', ev.id, 'date', ev.date::text, 'venue', ev.venue, 'status', ev.status) order by ev.date asc)
        from events ev where ev.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'people', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', p.id, 'category', p.category, 'full_name', p.full_name,
          'phonetic', p.phonetic, 'role', p.role, 'audio_url', p.audio_url,
          'position', p.position, 'notes', p.notes, 'email', p.email, 'phone', p.phone)
        order by p.category, p.position, p.created_at)
        from portal_people p where p.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'contacts', coalesce(
      (select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name, 'category', ct.category,
          'email', ct.email, 'phone', ct.phone) order by ct.name)
        from couple_contacts cc
        join contacts ct on ct.id = cc.contact_id
        where cc.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'songs', coalesce(
      (select jsonb_agg(jsonb_build_object('id', s.id, 'category', s.category, 'title', s.title,
          'artist', s.artist, 'notes', s.notes, 'position', s.position)
        order by s.category, s.position, s.created_at)
        from portal_songs s where s.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'song_categories', coalesce(
      (select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'description', description, 'position', position) order by position)
        from portal_song_categories where couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'files', coalesce(
      (select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'file_url', f.file_url,
          'file_size', f.file_size, 'created_at', f.created_at) order by f.created_at)
        from portal_files f where f.couple_id = v_couple_id),
      '[]'::jsonb
    ),
    'vows', coalesce(
      (select jsonb_agg(jsonb_build_object('id', v.id, 'who', v.who, 'content', v.content)
        order by v.who)
        from vows v where v.couple_id = v_couple_id and v.who = v_viewer),
      '[]'::jsonb
    ),
    'timeline_items', coalesce(
      (select jsonb_agg(jsonb_build_object('id', ti.id, 'start_time', to_char(ti.start_time, 'HH24:MI'),
          'title', ti.title, 'description', ti.description,
          'duration_min', ti.duration_min, 'position', ti.position,
          'pending_review', ti.pending_review, 'event_id', ti.event_id)
        order by ti.start_time nulls last, ti.position)
        from timeline_items ti
        join events ev2 on ev2.id = ti.event_id
        where ev2.couple_id = v_couple_id and ti.internal = false),
      '[]'::jsonb
    ),
    'payments', jsonb_build_object(
      'invoices', coalesce(
        (select jsonb_agg(jsonb_build_object('id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
            'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
            'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled)
          order by inv.created_at desc)
          from invoices inv where inv.couple_id = v_couple_id),
        '[]'::jsonb
      )
    ),
    'contracts', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', ctr.id,
          'title', ctr.title,
          'contract_number', ctr.contract_number,
          'status', ctr.status,
          'share_token', ctr.share_token,
          'share_token_enabled', ctr.share_token_enabled,
          'email_sent_at', ctr.email_sent_at,
          'signed_at', ctr.signed_at
        ) order by ctr.created_at desc)
        from contracts ctr
        where ctr.couple_id = v_couple_id
          and ctr.status in ('sent', 'signed', 'declined', 'expired')
          and ctr.share_token_enabled = true),
      '[]'::jsonb
    ),
    'branding',        _user_branding(v_user_id),
    'branding_blocks', _user_branding_blocks(v_user_id, 'portal')
  )
  into result
  from couples c
  left join events e on e.id = v_event_id
  where c.id = v_couple_id;

  return result::json;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. Drop the FK columns.
-- ────────────────────────────────────────────────────────────────

-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
alter table public.invoices drop column if exists proposal_id;
-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
alter table public.contracts drop column if exists proposal_id;

-- ────────────────────────────────────────────────────────────────
-- 6. Drop the tables. `proposals` and `proposal_options` reference each
--    other (proposal_options.proposal_id ↔ proposals.accepted_option_id),
--    so a plain ordered drop deadlocks; cascade clears the mutual FKs.
-- ────────────────────────────────────────────────────────────────

-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
drop table if exists public.proposal_option_items cascade;
-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
drop table if exists public.proposal_options cascade;
-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
drop table if exists public.proposals cascade;

-- Trigger functions that were attached to the proposals table. The table drop
-- above cascades its triggers but leaves these functions orphaned, so drop
-- them now that no trigger depends on them.
drop function if exists public.tg_proposals_emit_lifecycle();
drop function if exists public.touch_proposals_updated_at();
