import { describe, expect, it } from 'vitest';

import { runSql } from '../helpers/sql';

/**
 * Ratchet (Phase 4, Task 25 and fix round 1): every public base table
 * carries the `zz_log_shadow_mutation` trigger, so a write made while an
 * admin is shadowing an MC is always attributed, and every public table
 * has RLS on.
 *
 * Coverage is "every table minus an explicit allowlist", not "every RLS
 * table": a table created without RLS used to be skipped by both the
 * attach loop and this test. `ensure_shadow_triggers()` attaches any
 * table that is missing it; the deploy workflows run it after every push.
 */
describe('shadow-mutation trigger coverage', () => {
  /** Tables that must NOT carry the trigger, each with its reason. */
  const ALLOWLIST: Record<string, string> = {
    admin_audit_log: 'the trigger writes it; logging it would recurse',
    admin_shadow_sessions: 'the trigger reads it and stamps after_end_alerted_at on it',
  };
  const allowlisted = Object.keys(ALLOWLIST)
    .map((t) => `'${t}'`)
    .join(', ');

  // tgtype bits: 1 = row, 2 = before, 4 = insert, 8 = delete, 16 = update.
  const missingSql = `
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and not c.relispartition
       and c.relname not in (${allowlisted})
       and not exists (
         select 1 from pg_trigger g
          where g.tgrelid = c.oid
            and g.tgname = 'zz_log_shadow_mutation'
            and g.tgenabled <> 'D'
            and g.tgtype & (1 | 4 | 8 | 16) = (1 | 4 | 8 | 16)
            and g.tgtype & 2 = 0
            and g.tgfoid = 'public.log_shadow_mutation()'::regprocedure
            and pg_get_triggerdef(g.oid) like '%WHEN ((pg_trigger_depth() = 0))%'
       )
     order by 1
  `;

  it('every public base table (minus the allowlist) has the trigger, enabled, depth-0, on I/U/D', () => {
    expect(runSql(`${missingSql};`).split('\n').filter(Boolean)).toEqual([]);
  });

  it('every public table has RLS on', () => {
    const noRls = runSql(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
       order by 1;
    `);
    expect(noRls.split('\n').filter(Boolean)).toEqual([]);
  });

  it('a new table without RLS is caught, and ensure_shadow_triggers() fixes it', () => {
    // One transaction, rolled back, so nothing persists.
    const out = runSql(`
      begin;
      create table public.t25_scratch_probe (id uuid primary key);
      select 'missing:' || coalesce(string_agg(relname, ','), '') from (${missingSql}) m(relname);
      select 'attached:' || public.ensure_shadow_triggers();
      select 'missing_after:' || coalesce(string_agg(relname, ','), '') from (${missingSql}) m(relname);
      select 'again:' || public.ensure_shadow_triggers();
      rollback;
    `);
    const lines = out.split('\n');
    expect(lines).toContain('missing:t25_scratch_probe');
    expect(lines).toContain('attached:1');
    expect(lines).toContain('missing_after:');
    expect(lines).toContain('again:0');
  });

  it('ensure_shadow_triggers() replaces a same-named trigger that calls the wrong function', () => {
    const out = runSql(`
      begin;
      create table public.t25_wrong_fn_probe (id uuid primary key);
      create function public.t25_noop() returns trigger language plpgsql as $f$ begin return null; end $f$;
      create trigger zz_log_shadow_mutation after insert or update or delete on public.t25_wrong_fn_probe
        for each row when (pg_trigger_depth() = 0) execute function public.t25_noop();
      select 'attached:' || public.ensure_shadow_triggers();
      select 'missing_after:' || coalesce(string_agg(relname, ','), '') from (${missingSql}) m(relname);
      rollback;
    `);
    const lines = out.split('\n');
    expect(lines).toContain('attached:1');
    expect(lines).toContain('missing_after:');
  });

  it('Slack key lists are sanitised and capped', () => {
    const keys = [
      'user_metadata.bank_x <!channel>',
      '<https://evil.example|click>',
      'a&b',
      'x'.repeat(200),
      ...Array.from({ length: 20 }, (_, i) => `k${i}`),
    ];
    const text = runSql(
      `select public.shadow_slack_key_list('${JSON.stringify(keys).replace(/'/g, "''")}'::jsonb);`,
    );
    expect(text).not.toMatch(/[<>&]/);
    expect(text).toMatch(/ and 14 more$/);
    for (const name of text.replace(/ and \d+ more$/, '').split(', ')) {
      expect(name.length).toBeLessThanOrEqual(40);
    }
    // Garbage in is not an error.
    expect(runSql(`select public.shadow_slack_key_list('null'::jsonb);`)).toBe('');
  });

  it('the allowlisted tables do not carry it', () => {
    const present = runSql(`
      select c.relname from pg_trigger g join pg_class c on c.oid = g.tgrelid
       where g.tgname = 'zz_log_shadow_mutation' and c.relname in (${allowlisted});
    `);
    expect(present).toBe('');
  });

  it('auth.users and auth.mfa_factors carry the account-change triggers', () => {
    const rows = runSql(`
      select tgrelid::regclass || ':' || tgname from pg_trigger
       where tgname in ('zz_log_shadow_auth_user', 'zz_log_shadow_mfa', 'zz_log_shadow_mfa_status')
         and tgenabled <> 'D'
       order by 1;
    `);
    expect(rows.split('\n')).toEqual([
      'auth.mfa_factors:zz_log_shadow_mfa',
      'auth.mfa_factors:zz_log_shadow_mfa_status',
      'auth.users:zz_log_shadow_auth_user',
    ]);
  });

  it('every shadow function is SECURITY DEFINER with an empty search_path and no client EXECUTE', () => {
    const rows = runSql(`
      select p.proname || '|' || p.prosecdef || '|' || array_to_string(p.proconfig, ',') || '|'
             || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '|'
             || has_function_privilege('anon', p.oid, 'EXECUTE')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('log_shadow_mutation', 'ensure_shadow_triggers', 'shadow_alert_slack',
                           'open_shadow_session_for', 'live_shadow_session_for',
                           'log_shadow_auth_user_change', 'log_shadow_mfa_change')
       order by 1;
    `);
    expect(rows.split('\n')).toEqual([
      'ensure_shadow_triggers|true|search_path=""|false|false',
      'live_shadow_session_for|true|search_path=""|false|false',
      'log_shadow_auth_user_change|true|search_path=""|false|false',
      'log_shadow_mfa_change|true|search_path=""|false|false',
      'log_shadow_mutation|true|search_path=""|false|false',
      'open_shadow_session_for|true|search_path=""|false|false',
      'shadow_alert_slack|true|search_path=""|false|false',
    ]);
  });
});
