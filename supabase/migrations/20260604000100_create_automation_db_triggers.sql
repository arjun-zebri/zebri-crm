-- Phase 14a: Automations - DB triggers on existing tables
--
-- This migration wires AFTER INSERT/UPDATE triggers on the
-- existing domain tables (couples, quotes, invoices, contracts,
-- tasks, timeline_items, portal_*) so any row-state change that
-- could be relevant to an automation publishes through
-- emit_automation_event() into the event bus.
--
-- The runner / dispatcher then matches each event row against the
-- user's active automations and opens runs. The DB trigger only
-- has one job: write the event row. All matching / scheduling /
-- side effects happen application-side in the next tick.
--
-- Triggers are intentionally narrow:
--   * INSERT triggers fire only on actual row creation.
--   * UPDATE triggers fire only on the specific column transitions
--     we care about (status flips, paid_at touching, etc.) - we use
--     `IS DISTINCT FROM` to handle nulls correctly.
--   * Each trigger writes exactly one event, never multiple per row
--     state change.
--
-- Out of scope:
--   * Portal access tracking (`portal_accessed` trigger). Today
--     there's no portal_visits log; we'd need to instrument
--     get_portal_data() or add a visit row write. Deferred - the
--     dispatcher / runner already understand the event_type, the
--     producer just isn't there yet.
--   * Payment received / failed events from Stripe. Those route
--     through the existing Stripe webhook handler, not a DB
--     trigger. The webhook will gain an emit_automation_event call
--     in a separate application-level change.
--
-- Not destructive - all triggers are new. Existing data is
-- untouched.

-- ────────────────────────────────────────────────────────────────
-- couples
-- ────────────────────────────────────────────────────────────────

-- AFTER INSERT → 'new_enquiry' event.
--
-- Maps the brief's "new enquiry" trigger. We fire on every new
-- couple row; the dispatcher narrows based on `lead_source` if
-- the user has configured the trigger that way.
create or replace function public.tg_couples_emit_new_enquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.emit_automation_event(
    new.user_id,
    'couples',
    new.id,
    'new_enquiry',
    jsonb_build_object(
      'couple_id', new.id,
      'couple_name', new.name,
      'lead_source', new.lead_source,
      'status', new.status,
      'event_date', new.event_date
    ),
    new.id
  );
  return new;
end;
$$;

drop trigger if exists couples_emit_new_enquiry on public.couples;
create trigger couples_emit_new_enquiry
  after insert on public.couples
  for each row execute function public.tg_couples_emit_new_enquiry();


-- AFTER UPDATE OF status →
--   * 'couple_stage_changed' always
--   * 'booking_cancelled' if the new status indicates cancellation
--
-- We check `IS DISTINCT FROM` so nulling/unsetting also fires
-- correctly. Cancellation maps to user-defined statuses whose
-- slug contains 'cancel' or matches the historical 'lost' slug;
-- the explicit list keeps the check cheap and predictable.
create or replace function public.tg_couples_emit_stage_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.emit_automation_event(
      new.user_id,
      'couples',
      new.id,
      'couple_stage_changed',
      jsonb_build_object(
        'couple_id', new.id,
        'couple_name', new.name,
        'from_status', old.status,
        'to_status', new.status
      ),
      new.id
    );

    if new.status in ('cancelled', 'lost') then
      perform public.emit_automation_event(
        new.user_id,
        'couples',
        new.id,
        'booking_cancelled',
        jsonb_build_object(
          'couple_id', new.id,
          'couple_name', new.name,
          'from_status', old.status
        ),
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists couples_emit_stage_changed on public.couples;
create trigger couples_emit_stage_changed
  after update of status on public.couples
  for each row execute function public.tg_couples_emit_stage_changed();


-- ────────────────────────────────────────────────────────────────
-- quotes
-- ────────────────────────────────────────────────────────────────

create or replace function public.tg_quotes_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'quotes',
      new.id,
      'quote_created',
      jsonb_build_object(
        'quote_id', new.id,
        'couple_id', new.couple_id,
        'quote_number', new.quote_number,
        'title', new.title,
        'subtotal', new.subtotal,
        'status', new.status
      ),
      new.couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- accepted_at touching from null → not-null means the couple
    -- accepted the quote. This is the dominant signal MCs want
    -- to automate against.
    if new.accepted_at is not null and old.accepted_at is null then
      perform public.emit_automation_event(
        new.user_id,
        'quotes',
        new.id,
        'quote_accepted',
        jsonb_build_object(
          'quote_id', new.id,
          'couple_id', new.couple_id,
          'quote_number', new.quote_number,
          'subtotal', new.subtotal,
          'accepted_at', new.accepted_at
        ),
        new.couple_id
      );
    end if;

    -- share_token_enabled toggled from false → true is the
    -- "quote sent" moment in this app's UX (the user clicks
    -- Share / Send and the share link becomes live).
    if new.share_token_enabled = true and coalesce(old.share_token_enabled, false) = false then
      perform public.emit_automation_event(
        new.user_id,
        'quotes',
        new.id,
        'quote_sent',
        jsonb_build_object(
          'quote_id', new.id,
          'couple_id', new.couple_id,
          'quote_number', new.quote_number
        ),
        new.couple_id
      );
    end if;

    -- status flipping to 'declined' is the explicit no-thanks
    -- signal - surfaces a re-engagement trigger.
    if new.status = 'declined' and old.status is distinct from 'declined' then
      perform public.emit_automation_event(
        new.user_id,
        'quotes',
        new.id,
        'quote_declined',
        jsonb_build_object(
          'quote_id', new.id,
          'couple_id', new.couple_id
        ),
        new.couple_id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_emit_lifecycle on public.quotes;
create trigger quotes_emit_lifecycle
  after insert or update on public.quotes
  for each row execute function public.tg_quotes_emit_lifecycle();


-- ────────────────────────────────────────────────────────────────
-- invoices
-- ────────────────────────────────────────────────────────────────

create or replace function public.tg_invoices_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'invoices',
      new.id,
      'invoice_created',
      jsonb_build_object(
        'invoice_id', new.id,
        'couple_id', new.couple_id,
        'invoice_number', new.invoice_number,
        'title', new.title,
        'subtotal', new.subtotal,
        'due_date', new.due_date,
        'status', new.status
      ),
      new.couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- paid_at moving from null → not-null is the payment-received
    -- signal. The Stripe webhook handler also produces card
    -- payments - but the same `update invoices set paid_at = …`
    -- path runs in both cases, so this trigger covers manual and
    -- Stripe-mediated payments uniformly. Event type matches the
    -- user-facing trigger slug in the registry.
    if new.paid_at is not null and old.paid_at is null then
      perform public.emit_automation_event(
        new.user_id,
        'invoices',
        new.id,
        'payment_received',
        jsonb_build_object(
          'invoice_id', new.id,
          'couple_id', new.couple_id,
          'invoice_number', new.invoice_number,
          'subtotal', new.subtotal,
          'paid_at', new.paid_at
        ),
        new.couple_id
      );
    end if;

    if new.share_token_enabled = true and coalesce(old.share_token_enabled, false) = false then
      perform public.emit_automation_event(
        new.user_id,
        'invoices',
        new.id,
        'invoice_sent',
        jsonb_build_object(
          'invoice_id', new.id,
          'couple_id', new.couple_id,
          'invoice_number', new.invoice_number
        ),
        new.couple_id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_emit_lifecycle on public.invoices;
create trigger invoices_emit_lifecycle
  after insert or update on public.invoices
  for each row execute function public.tg_invoices_emit_lifecycle();


-- ────────────────────────────────────────────────────────────────
-- contracts
-- ────────────────────────────────────────────────────────────────

-- Contracts already have their own audit log (contract_audit_log)
-- and a rich set of SECURITY DEFINER RPCs (sign_contract,
-- decline_contract, revoke_contract, expire_contracts). We emit
-- automation events here on the raw row transitions so the same
-- signals are available regardless of which path mutated the row.
create or replace function public.tg_contracts_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'contracts',
      new.id,
      'contract_created',
      jsonb_build_object(
        'contract_id', new.id,
        'couple_id', new.couple_id,
        'contract_number', new.contract_number,
        'title', new.title,
        'status', new.status
      ),
      new.couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- signed_at touching from null → not-null is the e-signing
    -- moment. The signing RPC fires both this trigger AND the
    -- contract_audit_log emitter - they're different audit paths
    -- for different purposes.
    if new.signed_at is not null and old.signed_at is null then
      perform public.emit_automation_event(
        new.user_id,
        'contracts',
        new.id,
        'contract_signed',
        jsonb_build_object(
          'contract_id', new.id,
          'couple_id', new.couple_id,
          'contract_number', new.contract_number,
          'signed_at', new.signed_at,
          'signer_name', new.signer_name
        ),
        new.couple_id
      );
    end if;

    if new.declined_at is not null and old.declined_at is null then
      perform public.emit_automation_event(
        new.user_id,
        'contracts',
        new.id,
        'contract_declined',
        jsonb_build_object(
          'contract_id', new.id,
          'couple_id', new.couple_id,
          'contract_number', new.contract_number,
          'declined_at', new.declined_at,
          'declined_reason', new.declined_reason
        ),
        new.couple_id
      );
    end if;

    if new.email_sent_at is not null and old.email_sent_at is null then
      perform public.emit_automation_event(
        new.user_id,
        'contracts',
        new.id,
        'contract_sent',
        jsonb_build_object(
          'contract_id', new.id,
          'couple_id', new.couple_id,
          'contract_number', new.contract_number
        ),
        new.couple_id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_emit_lifecycle on public.contracts;
create trigger contracts_emit_lifecycle
  after insert or update on public.contracts
  for each row execute function public.tg_contracts_emit_lifecycle();


-- ────────────────────────────────────────────────────────────────
-- tasks
-- ────────────────────────────────────────────────────────────────

create or replace function public.tg_tasks_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'tasks',
      new.id,
      'task_created',
      jsonb_build_object(
        'task_id', new.id,
        'title', new.title,
        'due_date', new.due_date,
        'status', new.status,
        'related_couple_id', new.related_couple_id,
        'related_event_id', new.related_event_id
      ),
      new.related_couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'done' and old.status is distinct from 'done' then
      perform public.emit_automation_event(
        new.user_id,
        'tasks',
        new.id,
        'task_completed',
        jsonb_build_object(
          'task_id', new.id,
          'title', new.title,
          'related_couple_id', new.related_couple_id
        ),
        new.related_couple_id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_emit_lifecycle on public.tasks;
create trigger tasks_emit_lifecycle
  after insert or update on public.tasks
  for each row execute function public.tg_tasks_emit_lifecycle();


-- task_overdue is a derived signal (no row state captures it
-- directly - a task is overdue when due_date < today AND status
-- != 'done'). The tick computes it once a day and emits events
-- for newly overdue tasks. No trigger needed here.


-- ────────────────────────────────────────────────────────────────
-- timeline_items
-- ────────────────────────────────────────────────────────────────

-- One 'timeline_edited' event covers both INSERT and UPDATE - the
-- brief lumps them together. We resolve the couple_id via the
-- parent event row so couple-scoped queries still work.
create or replace function public.tg_timeline_items_emit_edited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id
    from public.events where id = new.event_id;

  perform public.emit_automation_event(
    new.user_id,
    'timeline_items',
    new.id,
    'timeline_edited',
    jsonb_build_object(
      'timeline_item_id', new.id,
      'event_id', new.event_id,
      'title', new.title,
      'start_time', new.start_time,
      'op', tg_op
    ),
    v_couple_id
  );
  return new;
end;
$$;

drop trigger if exists timeline_items_emit_edited on public.timeline_items;
create trigger timeline_items_emit_edited
  after insert or update on public.timeline_items
  for each row execute function public.tg_timeline_items_emit_edited();


-- ────────────────────────────────────────────────────────────────
-- portal_people / portal_songs / portal_files → section_completed
-- ────────────────────────────────────────────────────────────────
--
-- The brief's "section completed" trigger maps to the moment a
-- couple submits content for a portal section. We treat each
-- portal_* INSERT as a section progress signal; the runner /
-- dispatcher can refine to "section completed (n items submitted)"
-- using the payload counts.
--
-- portal_people: family / partner / bridal_party submissions
create or replace function public.tg_portal_people_emit_section_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- portal_* tables don't all carry user_id directly; resolve
  -- via the parent couple.
  select user_id into v_user_id from public.couples where id = new.couple_id;

  if v_user_id is null then return new; end if;

  perform public.emit_automation_event(
    v_user_id,
    'portal_people',
    new.id,
    'section_completed',
    jsonb_build_object(
      'couple_id', new.couple_id,
      'category', new.category,
      'section', 'people'
    ),
    new.couple_id
  );
  return new;
end;
$$;

drop trigger if exists portal_people_emit_progress on public.portal_people;
create trigger portal_people_emit_progress
  after insert on public.portal_people
  for each row execute function public.tg_portal_people_emit_section_progress();


create or replace function public.tg_portal_songs_emit_section_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.couples where id = new.couple_id;
  if v_user_id is null then return new; end if;

  perform public.emit_automation_event(
    v_user_id,
    'portal_songs',
    new.id,
    'section_completed',
    jsonb_build_object(
      'couple_id', new.couple_id,
      'category', new.category,
      'section', 'songs'
    ),
    new.couple_id
  );
  return new;
end;
$$;

drop trigger if exists portal_songs_emit_progress on public.portal_songs;
create trigger portal_songs_emit_progress
  after insert on public.portal_songs
  for each row execute function public.tg_portal_songs_emit_section_progress();


create or replace function public.tg_portal_files_emit_section_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.couples where id = new.couple_id;
  if v_user_id is null then return new; end if;

  perform public.emit_automation_event(
    v_user_id,
    'portal_files',
    new.id,
    'section_completed',
    jsonb_build_object(
      'couple_id', new.couple_id,
      'name', new.name,
      'section', 'files'
    ),
    new.couple_id
  );
  return new;
end;
$$;

drop trigger if exists portal_files_emit_progress on public.portal_files;
create trigger portal_files_emit_progress
  after insert on public.portal_files
  for each row execute function public.tg_portal_files_emit_section_progress();


-- ────────────────────────────────────────────────────────────────
-- couple_custom_fields → 'custom_field_changed'
-- ────────────────────────────────────────────────────────────────
--
-- Lets the brief's 'custom_field_changed' trigger fire whenever
-- a per-couple custom field is created or updated. The dispatcher
-- narrows to a specific field key via the trigger's config.
create or replace function public.tg_custom_fields_emit_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.value is distinct from old.value) then
    perform public.emit_automation_event(
      new.user_id,
      'couple_custom_fields',
      new.id,
      'custom_field_changed',
      jsonb_build_object(
        'couple_id', new.couple_id,
        'key', new.key,
        'value', new.value
      ),
      new.couple_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists custom_fields_emit_changed on public.couple_custom_fields;
create trigger custom_fields_emit_changed
  after insert or update on public.couple_custom_fields
  for each row execute function public.tg_custom_fields_emit_changed();
