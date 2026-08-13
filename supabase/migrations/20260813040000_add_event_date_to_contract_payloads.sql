-- Trigger sweep: contract payloads gain the couple's `event_date`.
--
-- Every contract trigger (created / sent / signed / declined /
-- revoked / expired) previously offered filters with nothing behind
-- them and matched everything. The one narrowing with real data is
-- the wedding date — "contract signed and the wedding is inside 30
-- days" — so both contract emit functions now join the couple and
-- stamp `event_date` on the payload, the same enrichment the couple
-- and invoice triggers carry.
--
-- Replaces both functions: `tg_contracts_emit_lifecycle` (insert +
-- timestamp transitions, body otherwise verbatim from
-- 20260604000100) and `tg_contracts_emit_status_flip` (revoke /
-- expire, body otherwise verbatim from 20260605000100).
-- Not destructive: one key is added to emitted jsonb.

create or replace function public.tg_contracts_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date date;
begin
  select c.event_date into v_event_date
  from public.couples c
  where c.id = new.couple_id;

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
        'status', new.status,
        'event_date', v_event_date
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
          'signer_name', new.signer_name,
          'event_date', v_event_date
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
          'declined_reason', new.declined_reason,
          'event_date', v_event_date
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
          'contract_number', new.contract_number,
          'event_date', v_event_date
        ),
        new.couple_id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

create or replace function public.tg_contracts_emit_status_flip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date date;
begin
  select c.event_date into v_event_date
  from public.couples c
  where c.id = new.couple_id;

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
        'prev_status', old.status,
        'event_date', v_event_date
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
        'expires_at', new.expires_at,
        'event_date', v_event_date
      ),
      new.couple_id
    );
  end if;

  return new;
end;
$$;
