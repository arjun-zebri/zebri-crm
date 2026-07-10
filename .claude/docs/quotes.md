# Quotes — RETIRED (2026-07-10)

The quotes feature was removed and replaced by **Proposals**
(packages → send → accept → invoice). See `.claude/docs/proposals.md`
for the replacement's spec and rollout record.

- All quote UI/backend/automations code was deleted in the proposals
  rollout (phase G); the `quotes` / `quote_items` /
  `quote_templates` / `quote_template_items` tables, their public
  RPCs, and `invoices.quote_id` / `contracts.quote_id` drop in
  migration `20260711000000_drop_quotes_feature.sql` (phase H).
- Existing automations that referenced quote triggers/actions are
  archived by that migration; the automations UI shows the raw
  retired type slug for them.
- The branding "Quote" surface was renamed to "Proposal"; saved
  quote-surface block trees are read as the proposal surface's
  starting point (legacy `quote` key fallback).
