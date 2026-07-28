-- Proposals: share link always available (quote / invoice parity)
--
-- `share_token_enabled` on proposals defaulted to `false`, mirroring
-- the pre-2026-05-27 quote / invoice / contract model where the flag
-- only flipped to `true` as a side effect of emailing the couple (or
-- clicking "Mark as sent"). The share token is minted on insert so the
-- URL exists from creation, but `get_public_proposal` (and the
-- sign-contract branch) filter on `share_token_enabled = true` and so
-- 404 a link copied from a draft.
--
-- Proposals landed (20260710) after
-- `20260527000000_share_token_enabled_by_default.sql` flipped the other
-- surfaces, so they never got that treatment. MCs want to copy a
-- proposal's share link and hand it out themselves (WhatsApp / SMS /
-- iMessage) without going through our email path. This applies the same
-- two changes that migration made to quotes / invoices / contracts:
--
-- 1. Flip the column default `false` -> `true` so every new proposal
--    has a live share link the moment it is created.
-- 2. Back-fill existing rows so proposals created under the old model
--    also get live links. The token is an unguessable server-minted
--    UUID, so enabling visibility leaks nothing to anyone who could not
--    already URL-guess into it, and the public page still shows the
--    couple the proposal's real status.

alter table public.proposals alter column share_token_enabled set default true;
update public.proposals set share_token_enabled = true where share_token_enabled = false;
