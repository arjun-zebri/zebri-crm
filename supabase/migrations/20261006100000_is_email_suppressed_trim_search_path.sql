-- Fold whitespace in the send-path suppression lookup, and pin its
-- search_path (Phase 2 whole-phase fix wave, M4 and M10), and correct the
-- couples.do_not_email column comment (M7).
--
-- M4. `is_email_suppressed` (20261006000000) folded case on both sides but
-- not surrounding whitespace. The unsubscribe token trims at mint time, but
-- a couple row, a contact, or a provider-reported address can carry a stray
-- space, and a comparison that reads ' sarah@example.com' and
-- 'sarah@example.com' as two addresses sends to someone who unsubscribed.
-- `btrim` on both sides fixes that, with tab, CR and LF named alongside
-- the space because plain `btrim(x)` strips spaces only. The predicate no
-- longer matches the `(user_id, lower(email), reason)` expression index
-- exactly, but the index's leading `user_id` column still narrows the scan
-- to one tenant's suppression list, which is small.
--
-- M10. The function had no `set search_path`, which the Supabase advisor
-- flags as `function_search_path_mutable`. It is security invoker, so this
-- was never exploitable, but pinning it costs nothing and silences the
-- advisor. The body already schema-qualifies its one table.
--
-- `create or replace` keeps the signature, the comment's subject and the
-- grants (execute revoked from public and anon in 20261006000000), so
-- nothing about who may call it changes.
--
-- Non-destructive: replaces one function body and one column comment. No
-- @ALLOW_DESTRUCTIVE marker needed.

create or replace function public.is_email_suppressed(
  p_user_id uuid,
  p_email text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.email_suppression
    where user_id = p_user_id
      and lower(btrim(email, E' \t\r\n')) = lower(btrim(p_email, E' \t\r\n'))
  );
$$;

comment on function public.is_email_suppressed(uuid, text) is
  'True when this owner has any suppression row (unsubscribed, bounced or complained) for this address, compared case-insensitively and ignoring surrounding whitespace. Read by the automated send path before dispatch.';

-- Doc drift (M7). The column comment written in 20261004000000 says the
-- bounce/complaint webhook keeps this flag in sync. It does not: the webhook
-- writes email_suppression only. The send path checks both, so a bounced
-- address is still never mailed; the comment just has to say what is true.
comment on column public.couples.do_not_email is
  'Denormalised opt-out flag for this couple''s own address, so the couple UI and the send path can check one boolean without a join. email_suppression is the source of truth. Set by the unsubscribe routes (page form and RFC 8058 one-click) on every couple of the owner whose stored email is the unsubscribed address; the Resend bounce/complaint webhook writes email_suppression only and does not set it. Stops automated mail to the couple''s own addresses only, never to their vendors.';
