-- Add an `is_starter` provenance flag to the reusable-template tables so
-- packages, quote templates, invoice templates and contract templates can
-- offer an opt-in starter catalog the same way email_templates already
-- does. The flag is a badge only: starter-sourced rows stay fully editable
-- and deletable.
--
-- Additive and non-destructive — no `@ALLOW_DESTRUCTIVE` marker required.
-- Existing owner-scoped RLS already covers the new column, so no policy
-- changes are needed. `email_templates` already has this column.

alter table packages add column if not exists is_starter boolean not null default false;
alter table quote_templates add column if not exists is_starter boolean not null default false;
alter table invoice_templates add column if not exists is_starter boolean not null default false;
alter table contract_templates add column if not exists is_starter boolean not null default false;
