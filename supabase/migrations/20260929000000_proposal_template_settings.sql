-- Proposal Layout v2: per-template proposal settings.
--
-- `proposal_settings` (20260927000000_proposal_layout_v2.sql) holds one
-- account-wide row of proposal defaults: password protection, PDF
-- download, expiry days, deposit percent, link preview. A template can
-- now carry its own copy of that same shape, so one template can, say,
-- require a password or use a longer expiry while the rest of the account
-- keeps the defaults.
--
-- `settings` is a full snapshot, never a partial diff: the app validates
-- it with the same Zod schema as the account row (every field required),
-- so a stored value is always complete. NULL means "follow the account
-- defaults", and is what "Reset to account defaults" writes back.
--
-- No new RLS: this is a column on an already owner-only table. Additive
-- and idempotent (add column if not exists), safe to re-run.

alter table public.proposal_templates
  add column if not exists settings jsonb;

comment on column public.proposal_templates.settings is
  'Per-template proposal settings snapshot (same shape as proposal_settings). NULL = follow the account defaults.';
