-- Phase 5 residual pass (R2): a deleted couple's emails keep their row,
-- not their personal details.
--
-- 20261023200000 made couple_emails.couple_id ON DELETE SET NULL, so a
-- couple's deletion no longer resets the tenant's daily cap (the rows ARE
-- the count). The rows it left behind still held the couple's address and
-- the subject (which usually names them), kept after the MC deliberately
-- deleted the couple, read by nothing and deletable by no one. Keeping
-- personal information that serves no purpose after deletion is weak
-- under APP 11.2.
--
-- The cap reads only user_id, source, transport, status and sent_at, so
-- everything else that can identify the couple is scrubbed the moment
-- couple_id goes null:
--   to_email            -> '(couple deleted)' (the column is NOT NULL)
--   subject             -> ''                 (NOT NULL too)
--   template_name       -> null (manual sends name it after the couple)
--   error               -> null (transports echo the address back)
--   provider_message_id -> null (stops webhook matches on a dead row)
--   attempt_key         -> null. Not in the ruling's list, but the key is
--                         `<step>:<address>:<hash>`, so it carries the
--                         address too. Null is safe: the key only makes a
--                         replay of the same step's send collapse, and the
--                         couple's workflow is gone with the couple; the
--                         unique index allows any number of nulls.
--
-- A BEFORE UPDATE OF couple_id row trigger, because the set-null is an RI
-- action: it runs as an UPDATE of couple_id and fires this trigger, with
-- no application code in the path. Only the transition from a couple to
-- none scrubs, so no other update is touched. Clients have no UPDATE
-- policy on this table, so the only writers are RI and the service role.
-- Security invoker (it only rewrites NEW), empty search_path, and no
-- client can execute it directly.

create or replace function public.couple_emails_scrub_on_couple_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.couple_id is not null and new.couple_id is null then
    new.to_email := '(couple deleted)';
    new.subject := '';
    new.template_name := null;
    new.error := null;
    new.provider_message_id := null;
    new.attempt_key := null;
  end if;
  return new;
end;
$$;

comment on function public.couple_emails_scrub_on_couple_delete() is
  'When a couple is deleted (couple_id set null), scrubs the couple''s personal details from the '
  'couple_emails rows left behind. The row stays: it is the tenant''s daily-cap count.';

revoke all on function public.couple_emails_scrub_on_couple_delete() from public, anon, authenticated;

drop trigger if exists couple_emails_scrub_on_couple_delete on public.couple_emails;
create trigger couple_emails_scrub_on_couple_delete
  before update of couple_id on public.couple_emails
  for each row
  execute function public.couple_emails_scrub_on_couple_delete();

-- Rows orphaned between 20261023200000 and this migration: scrub them the
-- same way. Idempotent (a scrubbed row already matches), and a no-op on a
-- replay from zero.
update public.couple_emails
   set to_email = '(couple deleted)',
       subject = '',
       template_name = null,
       error = null,
       provider_message_id = null,
       attempt_key = null
 where couple_id is null
   and to_email <> '(couple deleted)';

select public.ensure_require_mfa_policies();
select public.ensure_shadow_triggers();
