-- Attach the restrictive require_mfa policy to the outreach tables.
--
-- Why a migration of its own: the outreach tables were written before the
-- database-level two-factor rule (20261019000000) landed, so their create
-- migrations don't call the helper. ensure_require_mfa_policies() is
-- idempotent; it only adds the policy where it is missing.
select public.ensure_require_mfa_policies();
