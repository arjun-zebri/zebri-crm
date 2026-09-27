import { describe, expect, it } from 'vitest';

import { runSql } from '../helpers/sql';

/**
 * Ratchet (Phase 4, Task 23b): database-level two-factor enforcement
 * cannot lapse unseen.
 *
 * 1. Every public table with RLS on carries the `require_mfa` RESTRICTIVE
 *    policy for `authenticated`, calling `mfa_satisfied()` in both USING
 *    and WITH CHECK. `ensure_require_mfa_policies()` attaches any that is
 *    missing; the deploy workflows run it after every push.
 * 2. Every SECURITY DEFINER function that `authenticated` can execute
 *    (definer functions bypass RLS, so the policy never reaches them) is
 *    either guarded by `mfa_satisfied()` as its first check, or listed
 *    below with the reason it is safe without one. A new definer RPC fails
 *    this test until its author picks one.
 */
describe('require_mfa coverage', () => {
  /**
   * The only accepted USING / WITH CHECK text, as pg_get_expr (and so
   * pg_policies) prints `(select public.mfa_satisfied())`. Whether the
   * call prints with `public.` depends on the deparsing search_path, so
   * the query strips that one prefix and compares the rest exactly (M3).
   */
  const EXPR = '( SELECT mfa_satisfied() AS mfa_satisfied)';

  const missingSql = `
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and c.relrowsecurity
       and not exists (
         select 1 from pg_policy p
          where p.polrelid = c.oid
            and p.polname = 'require_mfa'
            and not p.polpermissive
            and p.polcmd = '*'
            and p.polroles = array['authenticated'::regrole::oid]
            and replace(pg_get_expr(p.polqual, p.polrelid), 'public.mfa_satisfied()', 'mfa_satisfied()') = '${EXPR}'
            and replace(pg_get_expr(p.polwithcheck, p.polrelid), 'public.mfa_satisfied()', 'mfa_satisfied()') = '${EXPR}'
       )
     order by 1
  `;

  it('every RLS table has the restrictive require_mfa policy', () => {
    expect(runSql(`${missingSql};`).split('\n').filter(Boolean)).toEqual([]);
  });

  it('storage.objects has it too', () => {
    const row = runSql(`
      select polpermissive::text || '|' || polcmd::text || '|' || array_to_string(polroles::regrole[], ',')
        from pg_policy where polrelid = 'storage.objects'::regclass and polname = 'require_mfa';
    `);
    expect(row).toBe('false|*|authenticated');
  });

  it('a new RLS table is caught, and ensure_require_mfa_policies() fixes it idempotently', () => {
    const out = runSql(`
      begin;
      create table public.t23b_scratch_probe (id uuid primary key);
      alter table public.t23b_scratch_probe enable row level security;
      select 'missing:' || coalesce(string_agg(relname, ','), '') from (${missingSql}) m(relname);
      select 'attached:' || public.ensure_require_mfa_policies();
      select 'missing_after:' || coalesce(string_agg(relname, ','), '') from (${missingSql}) m(relname);
      select 'again:' || public.ensure_require_mfa_policies();
      rollback;
    `);
    const lines = out.split('\n');
    expect(lines).toContain('missing:t23b_scratch_probe');
    expect(lines).toContain('attached:1');
    expect(lines).toContain('missing_after:');
    expect(lines).toContain('again:0');
  });

  it('ensure_require_mfa_policies() replaces a permissive or wrong same-named policy', () => {
    const out = runSql(`
      begin;
      create table public.t23b_wrong_probe (id uuid primary key);
      alter table public.t23b_wrong_probe enable row level security;
      create policy require_mfa on public.t23b_wrong_probe for all to authenticated using (true) with check (true);
      select 'attached:' || public.ensure_require_mfa_policies();
      select 'missing_after:' || coalesce(string_agg(relname, ','), '') from (${missingSql}) m(relname);
      rollback;
    `);
    const lines = out.split('\n');
    expect(lines).toContain('attached:1');
    expect(lines).toContain('missing_after:');
  });

  it('ensure_require_mfa_policies() replaces a policy whose expression only contains mfa_satisfied()', () => {
    const out = runSql(`
      begin;
      create table public.t23b_loose_probe (id uuid primary key);
      alter table public.t23b_loose_probe enable row level security;
      create policy require_mfa on public.t23b_loose_probe as restrictive for all to authenticated
        using ((select public.mfa_satisfied()) or true) with check ((select public.mfa_satisfied()));
      select 'missing:' || coalesce(string_agg(relname, ','), '') from (${missingSql}) m(relname);
      select 'attached:' || public.ensure_require_mfa_policies();
      select 'qual:' || replace(pg_get_expr(polqual, polrelid), 'public.', '')
        from pg_policy where polrelid = 'public.t23b_loose_probe'::regclass and polname = 'require_mfa';
      rollback;
    `);
    const lines = out.split('\n');
    expect(lines).toContain('missing:t23b_loose_probe');
    expect(lines).toContain('attached:1');
    expect(lines).toContain(`qual:${EXPR}`);
  });

  it('mfa_satisfied() and the ensure function have the intended shape and grants', () => {
    const rows = runSql(`
      select p.proname || '|' || p.prosecdef || '|' || p.provolatile::text || '|'
             || array_to_string(p.proconfig, ',') || '|'
             || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '|'
             || has_function_privilege('anon', p.oid, 'EXECUTE')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('mfa_satisfied', 'ensure_require_mfa_policies')
       order by 1;
    `);
    expect(rows.split('\n')).toEqual([
      'ensure_require_mfa_policies|true|v|search_path=""|false|false',
      'mfa_satisfied|true|s|search_path=""|true|false',
    ]);
  });

  it('mfa_satisfied() is true with no JWT (migrations, cron, service role)', () => {
    expect(runSql('select public.mfa_satisfied();')).toBe('t');
  });

  /**
   * Definer functions `authenticated` can execute that deliberately have
   * no guard. Trigger functions are excluded by the query (Postgres
   * refuses to call them outside a trigger). Keyed by
   * `name(identity args)`.
   *
   * Local note: the grant repair run after `supabase db reset` on the dev
   * machine (see testing.md) grants EXECUTE on every public function, so
   * locally this list also contains functions whose migrations revoke
   * client EXECUTE. Those carry the "service role only" reason.
   */
  const TOKEN_RPC = 'couple-facing RPC gated by an unguessable token; never acts for auth.uid(), and anon can call it anyway';
  const SERVICE_ONLY = 'service role only: its migration revokes EXECUTE from anon and authenticated (only the local grant repair re-opens it)';
  const ALLOWLIST: Record<string, string> = {
    // The predicate itself: one boolean about the caller's own session.
    'mfa_satisfied()': 'the predicate itself; returns one boolean about the caller\'s own session',

    // Token-gated public surfaces.
    '_resolve_contract_token(p_token uuid)': TOKEN_RPC,
    '_resolve_portal_couple(p_token uuid)': TOKEN_RPC,
    'accept_proposal(p_token uuid, p_option_id uuid, p_addon_selection jsonb)': TOKEN_RPC,
    'cancel_booking(p_manage_token uuid)': TOKEN_RPC,
    'decline_contract(token uuid, p_reason text, p_actor_ip text, p_actor_user_agent text)': TOKEN_RPC,
    'decline_contract_v2(p_token uuid, p_payload jsonb)': TOKEN_RPC,
    'decline_proposal(p_token uuid, p_reason text, p_message text)': TOKEN_RPC,
    'delete_portal_file(p_token uuid, p_id uuid)': TOKEN_RPC,
    'delete_portal_person(p_token uuid, p_id uuid)': TOKEN_RPC,
    'delete_portal_song(p_token uuid, p_id uuid)': TOKEN_RPC,
    'delete_portal_timeline_item(p_token uuid, p_id uuid)': TOKEN_RPC,
    'delete_portal_vow(p_token uuid, p_id uuid)': TOKEN_RPC,
    'get_booking_by_manage_token(token uuid)': TOKEN_RPC,
    'get_lead_form(token uuid)': TOKEN_RPC,
    'get_portal_data(token uuid)': TOKEN_RPC,
    'get_portal_milestones(token uuid)': TOKEN_RPC,
    'get_portal_packages(p_token uuid)': TOKEN_RPC,
    'get_portal_questionnaires(token uuid)': TOKEN_RPC,
    'get_public_booking_page(token uuid)': TOKEN_RPC,
    'get_public_contract(token uuid)': TOKEN_RPC,
    'get_public_invoice(token uuid)': TOKEN_RPC,
    'get_public_proposal(token uuid)': TOKEN_RPC,
    'get_public_proposal_layout(token uuid)': TOKEN_RPC,
    'get_public_questionnaire(token uuid)': TOKEN_RPC,
    'get_public_timeline(token uuid)': TOKEN_RPC,
    'get_vendor_timeline(token uuid)': TOKEN_RPC,
    'record_contract_view(token uuid, p_actor_ip text, p_actor_user_agent text)': TOKEN_RPC,
    // Reads auth.uid() only to skip recording the MC's own preview.
    'record_proposal_events(p_token uuid, p_session_id text, p_events jsonb)': TOKEN_RPC,
    'reschedule_booking(p_manage_token uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone)': TOKEN_RPC,
    'save_portal_contact(p_token uuid, p_name text, p_email text, p_phone text, p_category text, p_notes text)': TOKEN_RPC,
    'save_portal_couple_details(p_token uuid, p_primary_name text, p_primary_email text, p_primary_phone text, p_secondary_name text, p_secondary_email text, p_secondary_phone text)': TOKEN_RPC,
    'save_portal_event(p_token uuid, p_id uuid, p_date text, p_venue text)': TOKEN_RPC,
    'save_portal_file(p_token uuid, p_id uuid, p_name text, p_file_url text, p_file_size integer)': TOKEN_RPC,
    'save_portal_package(p_token uuid, p_package_id uuid)': TOKEN_RPC,
    'save_portal_person(p_token uuid, p_id uuid, p_category text, p_full_name text, p_phonetic text, p_role text, p_audio_url text, p_position integer)': TOKEN_RPC,
    'save_portal_person(p_token uuid, p_id uuid, p_category text, p_full_name text, p_phonetic text, p_role text, p_audio_url text, p_position integer, p_notes text)': TOKEN_RPC,
    'save_portal_person(p_token uuid, p_id uuid, p_category text, p_full_name text, p_phonetic text, p_role text, p_audio_url text, p_position integer, p_notes text, p_email text, p_phone text)': TOKEN_RPC,
    'save_portal_song(p_token uuid, p_id uuid, p_category text, p_title text, p_artist text, p_notes text, p_position integer)': TOKEN_RPC,
    'save_portal_timeline_item(p_token uuid, p_id uuid, p_start_time text, p_title text, p_description text, p_duration_min integer, p_event_id uuid)': TOKEN_RPC,
    'save_portal_vow(p_token uuid, p_id uuid, p_content text)': TOKEN_RPC,
    'save_questionnaire_progress(token uuid, p_responses jsonb)': TOKEN_RPC,
    'sign_contract(token uuid, p_signer_name text, p_signer_ip text, p_signer_user_agent text)': TOKEN_RPC,
    'sign_contract_v2(p_token uuid, p_payload jsonb)': TOKEN_RPC,
    'submit_booking(token uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_timezone text, p_name text, p_email text, p_partner_name text, p_phone text, p_notes text)': TOKEN_RPC,
    'submit_lead(token uuid, p_payload jsonb, p_source_origin text)': TOKEN_RPC,
    'submit_questionnaire(token uuid, p_responses jsonb)': TOKEN_RPC,
    'verify_contract_hash(p_hash text)': 'public certificate lookup by document hash; returns no MC data beyond the certificate',
    'is_valid_portal_token(token_value text)': 'boolean token check used by Storage policies; no MC data',
    'is_own_couple(couple_id_value text)':
      'boolean "is this couple mine" used by Storage policies; exposes nothing, and the storage.objects require_mfa policy gates the objects themselves',

    // Service role only in every migrated project.
    'admin_user_last_seen()': SERVICE_ONLY,
    'backfill_invoice_payment_stages()': SERVICE_ONLY,
    'seed_default_payment_schedule(p_user_id uuid)': SERVICE_ONLY,
    'issue_signer_otp(p_token uuid, p_code_hash text, p_code_salt text, p_ttl_seconds integer)': SERVICE_ONLY,
    'peek_signer_otp(p_token uuid)': SERVICE_ONLY,
    'fail_signer_otp(p_otp_id uuid, p_max_attempts integer)': SERVICE_ONLY,
    'consume_signer_otp(p_otp_id uuid, p_actor_ip text, p_actor_user_agent text)': SERVICE_ONLY,

    // Fixed 2026-09-25 (migration 20261001310000, the
    // fix/exit-shadow-takeover hotfix's "P0 function grants" slice — see
    // security.md). These five never act for auth.uid(), so a guard
    // would not have protected the MC anyway; the real hole was that
    // Postgres's PUBLIC EXECUTE default (plus two explicit grants to
    // anon/authenticated) let any client call them directly. The
    // migration revokes client EXECUTE and grants service_role only.
    // They still show up in this ratchet because the local grant-repair
    // script run after `supabase db reset` re-grants EXECUTE on every
    // function to authenticated (see the local note above SERVICE_ONLY).
    'bookings_due_for_reminder()': SERVICE_ONLY,
    'mark_booking_reminder_sent(p_booking_id uuid)': SERVICE_ONLY,
    'seed_default_contract_template(p_user_id uuid)': SERVICE_ONLY,
    'expire_contracts()': SERVICE_ONLY,
    'emit_contract_audit_event(p_contract_id uuid, p_event_type text, p_actor text, p_actor_ip text, p_actor_user_agent text, p_signer_name_typed text, p_decline_reason text, p_reminder_number integer, p_revoked_from_status text)':
      SERVICE_ONLY,

    // Present only on the shared local database (video-meetings branch,
    // not in this branch's migrations). Token-gated public RPCs.
    'accept_meeting_consent(p_token text, p_name text)': `${TOKEN_RPC} (video-meetings branch)`,
    'get_meeting_join(p_token text)': `${TOKEN_RPC} (video-meetings branch)`,
  };

  /**
   * The guard must be the FIRST statement after `begin` (M4): a guard
   * placed after a write would let the write happen first. Matched on
   * `prosrc` (the body between the dollar quotes), optional `declare`
   * block allowed before `begin`.
   */
  const GUARD =
    /^\s*(declare[\s\S]*?)?begin\s+if\s+not\s+public\.mfa_satisfied\(\)\s+then\s+raise\s+exception\s+using\s+errcode\s*=\s*'42501'/i;

  /** Any read of the caller's identity (M5). */
  const READS_IDENTITY = /auth\.(uid|jwt|email|role)\(\)|request\.jwt/;

  function definerFunctions(): Array<{ sig: string; src: string }> {
    const out = runSql(`
      select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || E'\\x1f'
             || replace(replace(p.prosrc, E'\\n', ' '), E'\\x1e', ' ') || E'\\x1e'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.prosecdef
         and p.prorettype <> 'trigger'::regtype
         and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       order by 1;
    `);
    return out
      .split('\x1e')
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => {
        const [sig, src] = r.split('\x1f');
        return { sig: sig!.trim(), src: src ?? '' };
      });
  }

  it('finds the definer functions (the query is not vacuous)', () => {
    const sigs = definerFunctions().map((f) => f.sig);
    expect(sigs).toContain('increment_ai_copilot_usage()');
    expect(sigs).toContain('get_portal_data(token uuid)');
  });

  it('every authenticated-executable definer function is guarded or allowlisted with a reason', () => {
    const unaccounted = definerFunctions()
      .filter((f) => !GUARD.test(f.src) && !ALLOWLIST[f.sig])
      .map((f) => f.sig);
    expect(unaccounted).toEqual([]);
  });

  it('the functions that act for auth.uid() carry the guard', () => {
    const bySig = new Map(definerFunctions().map((f) => [f.sig, f.src]));
    for (const sig of [
      'increment_ai_copilot_usage()',
      // Task 23c: the only writer of the MC's bank details and ABN.
      'set_my_payment_details(p_details jsonb)',
    ]) {
      expect(GUARD.test(bySig.get(sig) ?? ''), sig).toBe(true);
    }
  });

  it('no allowlisted function is also guarded (one or the other)', () => {
    const both = definerFunctions()
      .filter((f) => GUARD.test(f.src) && ALLOWLIST[f.sig])
      .map((f) => f.sig);
    expect(both).toEqual([]);
  });

  it('the guard pattern rejects a guard that is not the first statement', () => {
    const late = `declare v int; begin insert into t values (1); if not public.mfa_satisfied() then raise exception using errcode = '42501', message = 'x'; end if; end;`;
    const first = ` declare v int; begin if not public.mfa_satisfied() then raise exception using errcode = '42501', message = 'x'; end if; insert into t values (1); end;`;
    expect(GUARD.test(late)).toBe(false);
    expect(GUARD.test(first)).toBe(true);
  });

  it('the only allowlisted functions that read the caller identity are the known ones', () => {
    // A token RPC that starts acting for the signed-in user needs a guard,
    // not an allowlist entry.
    const readsUid = definerFunctions()
      .filter((f) => ALLOWLIST[f.sig] && READS_IDENTITY.test(f.src))
      .map((f) => f.sig)
      .sort();
    expect(readsUid).toEqual([
      'is_own_couple(couple_id_value text)',
      'mfa_satisfied()',
      'record_proposal_events(p_token uuid, p_session_id text, p_events jsonb)',
    ]);
  });
});
