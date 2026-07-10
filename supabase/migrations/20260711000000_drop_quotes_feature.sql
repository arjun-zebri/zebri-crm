-- Drop the quotes feature (Proposals Phase H — the final step).
--
-- All quote CODE was removed in the previous commit; this migration
-- retires the data layer. Order matters: every function that still
-- references the quote tables is replaced with a quote-free version
-- BEFORE the drops, so the migration replays cleanly from zero and
-- the live DB never holds a broken function.
--
-- Existing user automations that reference quote triggers/actions
-- are ARCHIVED (never silently broken): the automations UI renders
-- retired types with a "references the retired Quotes feature" state.
--
-- @ALLOW_DESTRUCTIVE: quotes feature fully replaced by proposals; owner-approved drop of quote tables + columns (2026-07-10).

-- ────────────────────────────────────────────────────────────────
-- 1. Archive automations referencing retired quote types
-- ────────────────────────────────────────────────────────────────

update automations set status = 'archived'
where status <> 'archived'
  and (
    trigger_type in (
      'quote_created', 'quote_sent', 'quote_accepted', 'quote_declined',
      'quote_due', 'quote_overdue', 'quote_viewed_but_not_responded'
    )
    or id in (
      select automation_id from automation_actions
      where type in ('send_quote', 'create_invoice_from_quote')
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 2. Quote-free sign_contract (proposal branch only)
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
  v_invoice_id uuid;
  v_proposal record;
  v_deposit_pct numeric;
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

  -- Auto-create a deposit invoice from the linked ACCEPTED PROPOSAL
  -- (preferred — the recorded agreement, terms included).
  if v_contract.proposal_id is not null then
    select p.*, po.deposit_percent as option_deposit_percent
    into v_proposal
    from public.proposals p
    left join public.proposal_options po on po.id = p.accepted_option_id
    where p.id = v_contract.proposal_id and p.status = 'accepted';

    if found then
      select id into v_invoice_id
      from public.invoices
      where proposal_id = v_contract.proposal_id;

      if v_invoice_id is null then
        v_deposit_pct := coalesce(v_proposal.option_deposit_percent, 25);
        insert into public.invoices (
          user_id, couple_id, proposal_id, title, status,
          invoice_number, subtotal, deposit_percent,
          share_token, share_token_enabled
        ) values (
          v_proposal.user_id,
          v_proposal.couple_id,
          v_proposal.id,
          'Deposit invoice for ' || coalesce(v_proposal.title, v_proposal.proposal_number),
          'draft',
          public.generate_invoice_number(v_proposal.user_id),
          round(v_proposal.subtotal * v_deposit_pct / 100, 2),
          v_deposit_pct,
          gen_random_uuid(),
          true
        ) returning id into v_invoice_id;
      end if;
    end if;
  end if;

  -- Follow-up task for the MC.
  insert into public.tasks (user_id, related_couple_id, title, status)
  values (
    v_contract.user_id, v_contract.couple_id,
    'Contract signed — follow up with couple',
    'todo'
  );

  return jsonb_build_object('ok', true, 'contract_id', v_contract.id);
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. Quote-free get_portal_data (payments: proposals + invoices)
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
      'proposals', coalesce(
        (select jsonb_agg(jsonb_build_object('id', pr.id, 'title', pr.title, 'proposal_number', pr.proposal_number,
            'status', pr.status, 'subtotal', pr.subtotal,
            'share_token', pr.share_token, 'share_token_enabled', pr.share_token_enabled)
          order by pr.created_at desc)
          from proposals pr where pr.couple_id = v_couple_id),
        '[]'::jsonb
      ),
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
-- 4. Drop quote functions, triggers, columns, tables
-- ────────────────────────────────────────────────────────────────

drop trigger if exists quotes_emit_lifecycle on public.quotes;
drop function if exists public.tg_quotes_emit_lifecycle();
drop function if exists get_public_quote(uuid);
drop function if exists accept_quote(uuid);
drop function if exists decline_quote(uuid);
drop function if exists generate_quote_number(uuid);

alter table invoices drop column if exists quote_id;
alter table contracts drop column if exists quote_id;

drop table if exists quote_items;
drop table if exists quotes;
drop table if exists quote_template_items;
drop table if exists quote_templates;
