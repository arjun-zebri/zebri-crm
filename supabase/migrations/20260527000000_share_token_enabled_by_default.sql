-- Phase 3.1 follow-up: share link always available
--
-- Previously, `share_token_enabled` defaulted to `false` on quotes,
-- invoices and contracts — the toggle flipped to `true` only when
-- the MC clicked "Send to couple" (a side effect of the email-send
-- route). The token itself was minted on insert, so the URL existed
-- from creation, but the public RPCs (`get_public_quote`,
-- `get_public_invoice`, `get_public_contract`) filter on
-- `share_token_enabled = true` and would 404 a link copied from a
-- draft.
--
-- MCs asked to be able to copy the share link the moment a doc is
-- created — they often share via WhatsApp / SMS / iMessage rather
-- than the in-product email, and shouldn't have to "send" through
-- our email path to make the URL functional.
--
-- Two changes per table:
--
-- 1. Flip the column default from `false` to `true` so every new
--    insert has a live share link.
-- 2. Back-fill existing draft rows where `share_token_enabled =
--    false` so historical drafts MCs created in the old model also
--    get live links. The share token itself is unguessable (UUID
--    minted server-side); enabling visibility on a draft doesn't
--    leak anything to anyone who couldn't already URL-guess into
--    it, and the in-product status pill still shows "Draft" to the
--    couple if they hit the link.
--
-- Portal tokens already always-enabled (see
-- `20260501000000_portal_always_enabled.sql`); no change needed.

alter table public.quotes alter column share_token_enabled set default true;
update public.quotes set share_token_enabled = true where share_token_enabled = false;

alter table public.invoices alter column share_token_enabled set default true;
update public.invoices set share_token_enabled = true where share_token_enabled = false;

alter table public.contracts alter column share_token_enabled set default true;
update public.contracts set share_token_enabled = true where share_token_enabled = false;
