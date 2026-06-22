-- Phase 14a follow-up: extend the automation DB triggers
--
-- The original 20260604000100 migration wired emit_automation_event
-- onto couples / quotes / invoices / contracts / tasks /
-- timeline_items / portal_*. This migration extends that coverage to
-- the remaining domain tables the trigger picker exposes:
--
--   * events             → event_created, event_updated, event_deleted
--   * contacts           → contact_created, contact_updated
--   * couple_contacts    → contact_linked_to_couple
--   * contracts (status) → contract_revoked, contract_expired
--
-- All triggers follow the conventions in the original migration:
--   - SECURITY DEFINER + search_path = public
--   - IS DISTINCT FROM on status checks to handle nulls correctly
--   - Exactly one event per row state change
--   - Resolve the user_id via the parent row when the table doesn't
--     carry one directly (couple_contacts only carries user_id since
--     the rename, but the parent-resolution pattern is kept for the
--     few legacy rows that might have NULL user_id).
--
-- Not destructive - all triggers are new and don't replace any
-- existing behaviour.

-- ────────────────────────────────────────────────────────────────
-- events → event_created / event_updated / event_deleted
-- ────────────────────────────────────────────────────────────────

create or replace function public.tg_events_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'events',
      new.id,
      'event_created',
      jsonb_build_object(
        'event_id', new.id,
        'couple_id', new.couple_id,
        'event_type', new.event_type,
        'title', new.title,
        'date', new.date,
        'venue', new.venue,
        'status', new.status
      ),
      new.couple_id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- One 'event_updated' regardless of which column changed; the
    -- payload carries enough context for downstream automations to
    -- decide whether they care. We only suppress no-op rewrites
    -- where literally nothing changed.
    if new.date is distinct from old.date
       or new.venue is distinct from old.venue
       or new.title is distinct from old.title
       or new.event_type is distinct from old.event_type
       or new.status is distinct from old.status
       or new.timeline_notes is distinct from old.timeline_notes
    then
      perform public.emit_automation_event(
        new.user_id,
        'events',
        new.id,
        'event_updated',
        jsonb_build_object(
          'event_id', new.id,
          'couple_id', new.couple_id,
          'event_type', new.event_type,
          'title', new.title,
          'date', new.date,
          'venue', new.venue,
          'status', new.status,
          'prev_date', old.date,
          'prev_venue', old.venue,
          'prev_event_type', old.event_type
        ),
        new.couple_id
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.emit_automation_event(
      old.user_id,
      'events',
      old.id,
      'event_deleted',
      jsonb_build_object(
        'event_id', old.id,
        'couple_id', old.couple_id,
        'event_type', old.event_type,
        'title', old.title,
        'date', old.date,
        'venue', old.venue
      ),
      old.couple_id
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists events_emit_lifecycle on public.events;
create trigger events_emit_lifecycle
  after insert or update or delete on public.events
  for each row execute function public.tg_events_emit_lifecycle();


-- ────────────────────────────────────────────────────────────────
-- contacts → contact_created / contact_updated
-- ────────────────────────────────────────────────────────────────
--
-- DELETE is intentionally not emitted: contact deletion cascades
-- through couple_contacts and event_contacts and the downstream
-- "contact removed" semantics are rarely useful for automations.
-- If a need surfaces, mirror the events DELETE branch above.

create or replace function public.tg_contacts_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_automation_event(
      new.user_id,
      'contacts',
      new.id,
      'contact_created',
      jsonb_build_object(
        'contact_id', new.id,
        'name', new.name,
        'category', new.category,
        'email', new.email,
        'phone', new.phone
      ),
      null
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.name is distinct from old.name
       or new.category is distinct from old.category
       or new.email is distinct from old.email
       or new.phone is distinct from old.phone
       or new.notes is distinct from old.notes
       or new.status is distinct from old.status
    then
      perform public.emit_automation_event(
        new.user_id,
        'contacts',
        new.id,
        'contact_updated',
        jsonb_build_object(
          'contact_id', new.id,
          'name', new.name,
          'category', new.category,
          'prev_category', old.category,
          'status', new.status
        ),
        null
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists contacts_emit_lifecycle on public.contacts;
create trigger contacts_emit_lifecycle
  after insert or update on public.contacts
  for each row execute function public.tg_contacts_emit_lifecycle();


-- ────────────────────────────────────────────────────────────────
-- couple_contacts → contact_linked_to_couple
-- ────────────────────────────────────────────────────────────────
--
-- Fires when a contact is attached to a couple via the join table.
-- The trigger resolves the contact's category from contacts so the
-- payload can be filtered ("photographer linked", "celebrant
-- linked", …). couple_contacts already enforces user_id so RLS-safe
-- writes are guaranteed.

create or replace function public.tg_couple_contacts_emit_linked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
  v_name text;
begin
  select category, name into v_category, v_name
    from public.contacts where id = new.contact_id;

  perform public.emit_automation_event(
    new.user_id,
    'couple_contacts',
    new.id,
    'contact_linked_to_couple',
    jsonb_build_object(
      'couple_contact_id', new.id,
      'couple_id', new.couple_id,
      'contact_id', new.contact_id,
      'category', v_category,
      'name', v_name
    ),
    new.couple_id
  );
  return new;
end;
$$;

drop trigger if exists couple_contacts_emit_linked on public.couple_contacts;
create trigger couple_contacts_emit_linked
  after insert on public.couple_contacts
  for each row execute function public.tg_couple_contacts_emit_linked();


-- ────────────────────────────────────────────────────────────────
-- contracts (status) → contract_revoked / contract_expired
-- ────────────────────────────────────────────────────────────────
--
-- The original tg_contracts_emit_lifecycle fires on signed_at,
-- declined_at, and email_sent_at column transitions. revoke and
-- expire are status-only flips (no dedicated timestamp column), so
-- they live in a separate trigger to keep diffing simple - extending
-- the existing function would need either a CREATE OR REPLACE with
-- the full body or a chained conditional. A second AFTER UPDATE
-- trigger is cheaper to reason about and keeps the original
-- migration's body verbatim.

create or replace function public.tg_contracts_emit_status_flip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then
    perform public.emit_automation_event(
      new.user_id,
      'contracts',
      new.id,
      'contract_revoked',
      jsonb_build_object(
        'contract_id', new.id,
        'couple_id', new.couple_id,
        'contract_number', new.contract_number,
        'prev_status', old.status
      ),
      new.couple_id
    );
  end if;

  if new.status = 'expired' and old.status is distinct from 'expired' then
    perform public.emit_automation_event(
      new.user_id,
      'contracts',
      new.id,
      'contract_expired',
      jsonb_build_object(
        'contract_id', new.id,
        'couple_id', new.couple_id,
        'contract_number', new.contract_number,
        'expires_at', new.expires_at
      ),
      new.couple_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_emit_status_flip on public.contracts;
create trigger contracts_emit_status_flip
  after update of status on public.contracts
  for each row execute function public.tg_contracts_emit_status_flip();
