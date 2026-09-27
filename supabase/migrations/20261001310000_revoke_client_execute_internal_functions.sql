-- Close client EXECUTE on five internal SECURITY DEFINER functions, and on
-- revoke_contract, whose only caller is now the service role (see below).
--
-- Postgres grants EXECUTE on every new function to PUBLIC, and Supabase
-- exposes every public-schema function at /rest/v1/rpc. A SECURITY DEFINER
-- function runs as its owner and bypasses RLS, so each of these was an
-- open door for anyone holding the public anon key:
--
--   bookings_due_for_reminder()        returned every tenant's confirmed
--                                      bookings with booker name, email and
--                                      manage_token (the capability that
--                                      cancels or reschedules a booking).
--   mark_booking_reminder_sent(uuid)   stamped any booking as reminded, so
--                                      its reminder email never goes out.
--   seed_default_contract_template(uuid)
--                                      wrote a template row into any user's
--                                      account.
--   emit_contract_audit_event(...)     wrote arbitrary rows (for example a
--                                      forged 'signed') into any tenant's
--                                      contract audit log. Explicitly
--                                      granted to authenticated.
--   expire_contracts()                 expired every tenant's overdue sent
--                                      contracts on demand. Explicitly
--                                      granted to anon, because the cron
--                                      route called it with a session client.
--
-- The earlier migrations granted service_role but never revoked the PUBLIC
-- default. Revoking from PUBLIC alone would not be enough for the two
-- explicit grants, so anon and authenticated are revoked by name too.
--
-- Callers after this migration (checked on main):
--   - app/api/cron/booking-reminders: service-role client already.
--   - app/api/cron/expire-contracts: switched to the service-role client in
--     the same change, still gated by isCronAuthorized.
--   - app/api/email/send-contract and lib/contracts/notify: service-role
--     client for emit_contract_audit_event.
--   - revoke_contract (SECURITY INVOKER, calls emit_contract_audit_event):
--     its only app caller, revokeContractAction, now checks ownership with
--     the user's client and calls it with the service-role client. A client
--     call would fail on the nested audit write anyway, so its own client
--     EXECUTE is revoked below too, making the ACL say what is true: the
--     function is service-role only. RLS never protected it from the
--     service role, which is why the action checks ownership first.
--   - Every other SQL caller (sign_contract, sign_contract_v2,
--     decline_contract, decline_contract_v2, record_contract_view,
--     consume_signer_otp, mark_contract_reminder_sent, expire_contracts,
--     trigger_seed_contract_template) is SECURITY DEFINER, so it calls these
--     as the owner and needs no client grant. trigger_seed_contract_template
--     itself is left alone: it is a trigger function, not callable over RPC.
--
-- Non-destructive: privileges only; no data or definitions change.

revoke execute on function public.bookings_due_for_reminder()
  from public, anon, authenticated;
grant execute on function public.bookings_due_for_reminder() to service_role;

revoke execute on function public.mark_booking_reminder_sent(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_booking_reminder_sent(uuid) to service_role;

revoke execute on function public.seed_default_contract_template(uuid)
  from public, anon, authenticated;
grant execute on function public.seed_default_contract_template(uuid) to service_role;

revoke execute on function public.emit_contract_audit_event(
  uuid, text, text, text, text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.emit_contract_audit_event(
  uuid, text, text, text, text, text, text, integer, text
) to service_role;

revoke execute on function public.expire_contracts()
  from public, anon, authenticated;
grant execute on function public.expire_contracts() to service_role;

revoke execute on function public.revoke_contract(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_contract(uuid) to service_role;
