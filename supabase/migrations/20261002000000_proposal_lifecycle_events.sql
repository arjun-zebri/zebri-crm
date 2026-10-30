-- supabase/migrations/20261002000000_proposal_lifecycle_events.sql
--
-- Proposal lifecycle events on the automation bus (roadmap spec R2, section 5.1)
-- and the daily expiry job (section 5.3).
--
-- One trigger emits all five events, from the DB and never from app
-- code, because three of the transitions (opened, accepted, declined)
-- happen inside security definer RPCs the app only sees the result of
-- (decision L6). Every guard compares old and new, so an `updated_at`
-- touch or a `version` bump never re-emits.
--
-- `proposal_accepted` fires when `accepted_at` is stamped, which the
-- finalize RPC does after the contract is signed, not when a package is
-- chosen (decision L7). Owner previews never stamp `first_viewed_at`
-- (only `get_public_proposal` does), so `proposal_opened` is couple-only.
--
-- `share_token` rides along on every payload: the DB does not know the
-- app origin, so the variable resolver builds `{{proposal.link}}` from
-- it (lib/automations/variables.ts). `automation_events` is owner-only
-- under RLS and the owner can already read the token from the row.
--
-- `event_date` uses `_workflow_couple_wedding_date` (20260905000100),
-- the earliest of the couple's `events` rows falling back to the legacy
-- `couples.event_date`, instead of a plain `couples.event_date` lookup:
-- that helper is the source of truth every other trigger and the email
-- variable resolver already resolve the wedding date through, and reusing
-- it keeps a proposal's `{{event.date}}` consistent with a couple's or a
-- contract's on the same wedding.
--
-- Not destructive. Deployed by CI `supabase db push` only.

create or replace function public.tg_proposals_emit_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_date      date;
  v_base            jsonb;
  v_option_title    text;
  v_option_subtotal numeric;
  v_invoice_total   numeric;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  v_event_date := public._workflow_couple_wedding_date(new.couple_id);

  v_base := jsonb_build_object(
    'proposal_id', new.id,
    'couple_id', new.couple_id,
    'proposal_number', new.proposal_number,
    'title', new.title,
    'share_token', new.share_token,
    'event_date', v_event_date
  );

  -- Sent: the link becoming resolvable is the send. The send route and
  -- the send_proposal action both flip this flag; a proposal reverted to
  -- draft has it cleared, so re-sending re-emits, which is right.
  if new.share_token_enabled and not old.share_token_enabled then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_sent',
      v_base || jsonb_build_object('expires_at', new.expires_at),
      new.couple_id
    );
  end if;

  if new.first_viewed_at is not null and old.first_viewed_at is null then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_opened',
      v_base,
      new.couple_id
    );
  end if;

  if new.accepted_at is not null and old.accepted_at is null then
    -- Both pointer reads are parentage-matched, not just id-matched: this
    -- body runs as definer, so a pointer aimed at another tenant's option
    -- or invoice would otherwise copy that row's title and total onto this
    -- tenant's bus. An unowned pointer yields nulls instead.
    select o.title, o.subtotal into v_option_title, v_option_subtotal
    from public.proposal_options o
    where o.id = new.accepted_option_id
      and o.proposal_id = new.id;
    -- finalize_proposal_acceptance writes invoice_id in the same UPDATE
    -- as accepted_at, and that invoice's subtotal is what the couple is
    -- paying (add-ons and loading included). The option subtotal is the
    -- fallback for an acceptance recorded without an invoice.
    select i.subtotal into v_invoice_total
    from public.invoices i
    where i.id = new.invoice_id
      and i.user_id = new.user_id;
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_accepted',
      v_base || jsonb_build_object(
        'accepted_option_id', new.accepted_option_id,
        'option_title', v_option_title,
        'total', coalesce(v_invoice_total, v_option_subtotal)
      ),
      new.couple_id
    );
  end if;

  if new.declined_at is not null and old.declined_at is null then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_declined',
      v_base || jsonb_build_object(
        'declined_reason', new.declined_reason,
        'declined_message', new.declined_message
      ),
      new.couple_id
    );
  end if;

  if new.status = 'expired' and old.status is distinct from 'expired' then
    perform public.emit_automation_event(
      new.user_id, 'proposals', new.id, 'proposal_expired',
      v_base || jsonb_build_object('expires_at', new.expires_at),
      new.couple_id
    );
  end if;

  return new;
end;
$$;

-- Trigger functions are not callable as RPCs, but the default PUBLIC
-- execute grant is revoked anyway so only the trigger machinery can
-- reach a security-definer body that writes another table.
revoke execute on function public.tg_proposals_emit_lifecycle() from public, anon, authenticated;

drop trigger if exists proposals_emit_lifecycle on public.proposals;
create trigger proposals_emit_lifecycle
  after update on public.proposals
  for each row
  execute function public.tg_proposals_emit_lifecycle();

-- --- Expiry job -------------------------------------------------------
-- R1 owns the scheduler (20261001000000); this phase adds one job. Same
-- unschedule-then-schedule idiom so the migration replays cleanly, and
-- the same cron_call so the Vault secrets and the no-op-without-secrets
-- behaviour apply. 22:10 UTC sits between expire-contracts (22:00) and
-- booking-reminders (22:30).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'zebri:expire-proposals';
  perform cron.schedule(
    'zebri:expire-proposals',
    '10 22 * * *',
    format('select public.cron_call(%L)', '/api/cron/expire-proposals')
  );
end;
$$;
