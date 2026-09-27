-- supabase/migrations/20261002100000_revoke_emit_automation_event.sql
--
-- Close the `authenticated` execute grant on `emit_automation_event`
-- (R2 whole-branch security review, finding S-I1).
--
-- The foundation migration (20260604000000) granted execute to
-- `authenticated` on the theory that the AFTER triggers call it "as the
-- user". They do not: every trigger function that emits (the
-- `tg_*_emit_*` family, `tg_proposals_emit_lifecycle` included) and every
-- RPC that emits (`cancel_booking`, `reschedule_booking`, ...) is
-- `security definer`, so the execute check on the inner call runs as the
-- function owner, never as the session role. The only other legitimate
-- emitters are app-side and all use the service-role client (the tick's
-- time emitters, `lib/workflows/emitters/step-overdue.ts`, the Stripe
-- webhook). No client-side or user-scoped code path calls the RPC.
--
-- Left as it was, any signed-in user could call
-- `rpc('emit_automation_event', { p_user_id: <someone else>, ... })`
-- from the browser and write a forged event into another tenant's bus:
-- the function is `security definer` and inserts whatever `p_user_id` it
-- is handed, so `automation_events` RLS never sees the write. That event
-- would then start the victim's workflows (emails to their couples, stage
-- changes) on data the attacker chose. Revoking `authenticated` closes
-- the hole with no behaviour change for any real emitter.
--
-- `service_role` keeps its grant (re-granted explicitly so the migration
-- stands alone). Replayable: revoke and grant are idempotent. Not
-- destructive. Deployed by CI `supabase db push` only.

revoke execute on function public.emit_automation_event(uuid, text, uuid, text, jsonb, uuid)
  from public, anon, authenticated;

grant execute on function public.emit_automation_event(uuid, text, uuid, text, jsonb, uuid)
  to service_role;
