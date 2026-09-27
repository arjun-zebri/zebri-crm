import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { jwtSessionId } from '@/lib/admin/shadow-sessions';
import type { Database } from '@/types/database';

import { runSql } from '../helpers/sql';
import {
  createTestUser,
  localSupabaseEnv,
  serviceClient,
  type DbClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * Shadow-mode write attribution (Phase 4, Task 25 and fix round 1),
 * against the real schema, triggers and RLS.
 *
 * A shadow session is built the way enterShadow builds one: a fresh
 * sign-in as the target, and an `admin_shadow_sessions` row written with
 * the service role under that session's JWT `session_id`. Writes then go
 * through that client exactly as the browser sends them.
 *
 * Every test opens its own session and counts only that session's rows,
 * so the tests pass in any order and alone.
 */
describe('shadow mode: every write is attributed to the admin', () => {
  const svc = serviceClient();
  const PASSWORD = 'test-password-12345';
  let admin: TestUser;
  let target: TestUser;
  let otherMc: TestUser;

  /** A new sign-in (so a new JWT session_id) as `user`. */
  async function signIn(user: TestUser): Promise<{ client: DbClient; sid: string }> {
    const { url, anonKey } = localSupabaseEnv();
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD });
    expect(error).toBeNull();
    const sid = jwtSessionId(data.session?.access_token);
    if (!sid) throw new Error('test session has no session_id claim');
    return { client, sid };
  }

  type SessionState = 'open' | 'ended' | 'expired';

  /** Sign in as `user` and record it as a shadow session in `state`. */
  async function shadow(state: SessionState = 'open', user: TestUser = target) {
    const s = await signIn(user);
    const now = Date.now();
    const H = 3600_000;
    const { error } = await svc.from('admin_shadow_sessions').insert({
      session_id: s.sid,
      admin_id: admin.id,
      target_user_id: user.id,
      ...(state === 'expired'
        ? { started_at: new Date(now - 9 * H).toISOString(), expires_at: new Date(now - H).toISOString() }
        : {}),
      ...(state === 'ended' ? { ended_at: new Date(now - 60_000).toISOString() } : {}),
    });
    expect(error).toBeNull();
    return s;
  }

  async function rowsFor(sid: string) {
    const { data, error } = await svc
      .from('admin_audit_log')
      .select('actor_id, target_user_id, action, details, created_at')
      .eq('action', 'shadow_mutation')
      .eq('details->>shadow_session_id', sid)
      .order('created_at', { ascending: true });
    expect(error).toBeNull();
    return (data ?? []).map((r) => ({ ...r, details: r.details as Record<string, unknown> }));
  }

  async function rowsForTarget(userId: string) {
    const { data } = await svc
      .from('admin_audit_log')
      .select('id')
      .eq('target_user_id', userId)
      .eq('action', 'shadow_mutation');
    return data ?? [];
  }

  async function insertContact(client: DbClient, userId: string, name: string): Promise<string> {
    const { data, error } = await client
      .from('contacts')
      .insert({ user_id: userId, name, category: 'photographer' })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  beforeAll(async () => {
    const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };
    admin = await createTestUser({}, { account_type: 'admin' });
    target = await createTestUser({}, pro);
    otherMc = await createTestUser({}, pro);
  });

  afterAll(async () => {
    const ids = [target?.id, otherMc?.id].filter(Boolean) as string[];
    await svc.from('admin_audit_log').delete().in('target_user_id', ids);
    await svc.from('admin_shadow_sessions').delete().in('target_user_id', ids);
    await admin?.cleanup();
    await target?.cleanup();
    await otherMc?.cleanup();
  });

  it('a normal session (no shadow row) writes no audit row', async () => {
    const plain = await signIn(target);
    await insertContact(plain.client, target.id, 'Own write');
    expect(await rowsFor(plain.sid)).toEqual([]);
  });

  it('a write while shadowing names both the admin and the impersonated MC', async () => {
    const s = await shadow();
    const contactId = await insertContact(s.client, target.id, 'Added by support');

    const rows = await rowsFor(s.sid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor_id: admin.id,
      target_user_id: target.id,
      action: 'shadow_mutation',
      details: {
        table: 'public.contacts',
        op: 'INSERT',
        row_id: contactId,
        shadow_session_id: s.sid,
        after_end: false,
      },
    });
    // Ids only: the log never copies MC data.
    expect(Object.keys(rows[0]!.details).sort()).toEqual(
      ['after_end', 'op', 'row_id', 'shadow_session_id', 'table'],
    );
    expect(JSON.stringify(rows[0]!.details)).not.toContain('Added by support');
  });

  it('updates and deletes are logged too', async () => {
    const s = await shadow();
    const contactId = await insertContact(s.client, target.id, 'Edit me');
    expect((await s.client.from('contacts').update({ name: 'Edited' }).eq('id', contactId)).error).toBeNull();
    expect((await s.client.from('contacts').delete().eq('id', contactId)).error).toBeNull();

    expect((await rowsFor(s.sid)).map((r) => r.details.op)).toEqual(['INSERT', 'UPDATE', 'DELETE']);
  });

  it('logs what the admin did, not the rows other triggers wrote in response', async () => {
    const s = await shadow();
    const contactId = await insertContact(s.client, target.id, 'Knock-on probe');

    // The knock-on row really was written (so this cannot pass vacuously)...
    const { data: events } = await svc
      .from('automation_events')
      .select('id')
      .eq('source_table', 'contacts')
      .eq('source_id', contactId);
    expect(events?.length ?? 0).toBeGreaterThan(0);
    // ...and only the contact is in the log.
    expect((await rowsFor(s.sid)).map((r) => r.details.table)).toEqual(['public.contacts']);
  });

  it('a write inside an RPC the session calls is logged', async () => {
    const s = await shadow();
    const { error } = await s.client.rpc('increment_ai_copilot_usage');
    expect(error).toBeNull();
    expect((await rowsFor(s.sid)).map((r) => r.details.table)).toEqual(['public.ai_copilot_usage']);
  });

  it('a table with no id column logs its primary-key columns', async () => {
    const s = await shadow();
    const { error } = await s.client.from('user_branding').upsert({ user_id: target.id });
    expect(error).toBeNull();
    const rows = await rowsFor(s.sid);
    expect(rows[0]?.details).toMatchObject({ table: 'public.user_branding', row_id: { user_id: target.id } });
  });

  it("another MC's writes are never attributed", async () => {
    const other = await signIn(otherMc);
    await insertContact(other.client, otherMc.id, 'Unrelated');
    expect(await rowsFor(other.sid)).toEqual([]);
    expect(await rowsForTarget(otherMc.id)).toEqual([]);
  });

  it('a session row naming a different target does not attribute the JWT user', async () => {
    const other = await signIn(otherMc);
    // otherMc's real session id recorded against `target`: the trigger
    // also requires the JWT's user to be the recorded target.
    const { error } = await svc.from('admin_shadow_sessions').insert({
      session_id: other.sid,
      admin_id: admin.id,
      target_user_id: target.id,
    });
    expect(error).toBeNull();
    await insertContact(other.client, otherMc.id, 'Still unrelated');
    expect(await rowsFor(other.sid)).toEqual([]);
  });

  it('a write after exit is still logged, flagged after_end, and stamps the alert throttle', async () => {
    const s = await shadow('ended');
    await insertContact(s.client, target.id, 'After exit 1');
    const first = await svc
      .from('admin_shadow_sessions')
      .select('after_end_alerted_at')
      .eq('session_id', s.sid)
      .single();
    await insertContact(s.client, target.id, 'After exit 2');

    const rows = await rowsFor(s.sid);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.details.after_end === true && r.actor_id === admin.id)).toBe(true);

    // The Slack alert is throttled by this stamp: set by the first write,
    // left alone by the second within the hour.
    const second = await svc
      .from('admin_shadow_sessions')
      .select('after_end_alerted_at')
      .eq('session_id', s.sid)
      .single();
    expect(first.data?.after_end_alerted_at).not.toBeNull();
    expect(second.data?.after_end_alerted_at).toBe(first.data?.after_end_alerted_at);
  });

  it('a write after expiry is still logged, flagged after_end', async () => {
    const s = await shadow('expired');
    await insertContact(s.client, target.id, 'After expiry');
    const rows = await rowsFor(s.sid);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details.after_end).toBe(true);
  });

  it('account changes during an open session log key names only, and flag bank details', async () => {
    const s = await shadow();
    // Bank details change only through the guarded RPC since Task 23c
    // (auth.updateUser is refused by the lock_payment_details trigger).
    // The RPC's UPDATE sets the bank key and this updateUser the tagline;
    // one statement each, so two rows.
    const { error } = await s.client.rpc('set_my_payment_details', { p_details: { bank_bsb: '062-000' } });
    expect(error).toBeNull();
    const { error: taglineError } = await s.client.auth.updateUser({ data: { tagline: 'Hi' } });
    expect(taglineError).toBeNull();

    const rows = (await rowsFor(s.sid)).filter((r) => r.details.table === 'auth.users');
    expect(rows).toHaveLength(2);
    const bank = rows.find((r) => (r.details.changed_keys as string[]).includes('user_metadata.bank_bsb'));
    const tagline = rows.find((r) => (r.details.changed_keys as string[]).includes('user_metadata.tagline'));
    expect(bank).toMatchObject({
      actor_id: admin.id,
      target_user_id: target.id,
      details: {
        op: 'UPDATE',
        changed_keys: ['user_metadata.bank_bsb'],
        attribution: 'during_session',
        sensitive: true,
      },
    });
    expect(tagline).toMatchObject({
      details: { changed_keys: ['user_metadata.tagline'], attribution: 'during_session', sensitive: false },
    });
    // Never the values.
    expect(JSON.stringify(bank!.details)).not.toContain('062-000');
  });

  it('turning on 2FA during an open session is logged', async () => {
    const s = await shadow();
    const { error } = await s.client.auth.mfa.enroll({ factorType: 'totp' });
    expect(error).toBeNull();
    const rows = (await rowsFor(s.sid)).filter((r) => r.details.table === 'auth.mfa_factors');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details).toMatchObject({ op: 'INSERT', attribution: 'during_session' });
  });

  it('after exit, an account change through the still-live target session is logged and flagged', async () => {
    const mc = await createTestUser({}, { account_type: 'vendor' });
    try {
      // Ended shadow session whose auth session was never revoked: the
      // copied-token case. The change goes through GoTrue with no JWT
      // session visible to the database.
      const s = await shadow('ended', mc);
      // Through the RPC: the only path for bank details since Task 23c.
      const { error } = await s.client.rpc('set_my_payment_details', {
        p_details: { bank_account_number: '12345678' },
      });
      expect(error).toBeNull();

      const rows = (await rowsFor(s.sid)).filter((r) => r.details.table === 'auth.users');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actor_id: admin.id,
        target_user_id: mc.id,
        details: {
          changed_keys: ['user_metadata.bank_account_number'],
          attribution: 'unrevoked_shadow_session',
          after_end: true,
          sensitive: true,
        },
      });
      expect(JSON.stringify(rows[0]!.details)).not.toContain('12345678');
    } finally {
      await svc.from('admin_audit_log').delete().eq('target_user_id', mc.id);
      await mc.cleanup();
    }
  });

  it('after exit, once the target session is revoked, account changes are not attributed', async () => {
    const mc = await createTestUser({}, { account_type: 'vendor' });
    try {
      const s = await shadow('ended', mc);
      // Revoking the session deletes its auth.sessions row.
      expect((await s.client.auth.signOut({ scope: 'local' })).error).toBeNull();
      // Any account edit will do; bank keys are locked to the RPC (Task 23c).
      const { error } = await svc.auth.admin.updateUserById(mc.id, { user_metadata: { tagline: 'Mine' } });
      expect(error).toBeNull();
      expect(await rowsForTarget(mc.id)).toEqual([]);
    } finally {
      await mc.cleanup();
    }
  });

  // Phase 4 fix wave (review I2): only the service role can write
  // app_metadata, so after exit such a change is Stripe or an admin
  // tool, never the kept token. It must not be pinned on support.
  it('after exit, an app_metadata change (a Stripe webhook shape) is not attributed', async () => {
    const mc = await createTestUser({}, { account_type: 'vendor' });
    try {
      await shadow('ended', mc);
      const { error } = await svc.auth.admin.updateUserById(mc.id, {
        app_metadata: { account_type: 'vendor', subscription_status: 'past_due' },
      });
      expect(error).toBeNull();
      expect(await rowsForTarget(mc.id)).toEqual([]);
    } finally {
      await svc.from('admin_audit_log').delete().eq('target_user_id', mc.id);
      await mc.cleanup();
    }
  });

  it('after exit, a change to both keeps the user_metadata key and drops the app_metadata one', async () => {
    const mc = await createTestUser({}, { account_type: 'vendor' });
    try {
      const s = await shadow('ended', mc);
      runSql(`
        update auth.users
           set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"tagline":"x"}',
               raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"subscription_status":"past_due"}'
         where id = '${mc.id}';
      `);
      const rows = (await rowsFor(s.sid)).filter((r) => r.details.table === 'auth.users');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.details).toMatchObject({
        changed_keys: ['user_metadata.tagline'],
        attribution: 'unrevoked_shadow_session',
        after_end: true,
      });
    } finally {
      await svc.from('admin_audit_log').delete().eq('target_user_id', mc.id);
      await mc.cleanup();
    }
  });

  it('during an open session an app_metadata change is still logged', async () => {
    const mc = await createTestUser({}, {
      account_type: 'vendor',
      subscription_status: 'active',
      subscription_plan: 'pro',
    });
    try {
      const s = await shadow('open', mc);
      const { error } = await svc.auth.admin.updateUserById(mc.id, {
        app_metadata: { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'starter' },
      });
      expect(error).toBeNull();
      const rows = (await rowsFor(s.sid)).filter((r) => r.details.table === 'auth.users');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.details).toMatchObject({
        changed_keys: ['app_metadata.subscription_plan'],
        attribution: 'during_session',
      });
    } finally {
      await svc.from('admin_audit_log').delete().eq('target_user_id', mc.id);
      await mc.cleanup();
    }
  });

  it('a logging failure never blocks the account update, and JSON-null metadata is handled', async () => {
    const mc = await createTestUser({}, { account_type: 'vendor' });
    try {
      await shadow('open', mc);
      // In one rolled-back transaction: make every audit insert fail, then
      // update the MC's account the way GoTrue would. The update must land.
      const out = runSql(`
        begin;
        alter table public.admin_audit_log add constraint t25_force_fail check (false) not valid;
        -- The flag set_my_payment_details() sets (Task 23c lock).
        select set_config('zebri.payment_details_write', 'on', true);
        update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"bank_bsb":"999-999"}'
         where id = '${mc.id}';
        select 'saved:' || (raw_user_meta_data ->> 'bank_bsb') from auth.users where id = '${mc.id}';
        alter table public.admin_audit_log drop constraint t25_force_fail;
        update auth.users set raw_user_meta_data = 'null'::jsonb where id = '${mc.id}';
        select 'null_ok:' || jsonb_typeof(raw_user_meta_data) from auth.users where id = '${mc.id}';
        select 'logged:' || count(*) from public.admin_audit_log
         where target_user_id = '${mc.id}' and details ->> 'table' = 'auth.users';
        rollback;
      `);
      const lines = out.split('\n');
      expect(lines).toContain('saved:999-999');
      expect(lines).toContain('null_ok:null');
      // The failed insert logged nothing; the JSON-null change logged its keys.
      expect(lines).toContain('logged:1');
    } finally {
      await mc.cleanup();
    }
  });

  it('account changes with no open session log nothing', async () => {
    const lonely = await createTestUser({}, { account_type: 'vendor' });
    try {
      const { error } = await lonely.client.auth.updateUser({ data: { tagline: 'Alone' } });
      expect(error).toBeNull();
      expect(await rowsForTarget(lonely.id)).toEqual([]);
    } finally {
      await lonely.cleanup();
    }
  });

  it('an MC cannot read, plant or close shadow sessions, read the log, or call the internals', async () => {
    const s = await signIn(otherMc);
    const read = await s.client.from('admin_shadow_sessions').select('*');
    expect(read.error?.message).toMatch(/permission denied/);

    const plant = await s.client.from('admin_shadow_sessions').insert({
      session_id: s.sid,
      admin_id: admin.id,
      target_user_id: otherMc.id,
    });
    expect(plant.error?.message).toMatch(/permission denied/);

    const close = await s.client
      .from('admin_shadow_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('target_user_id', otherMc.id);
    expect(close.error?.message).toMatch(/permission denied/);

    const log = await s.client.from('admin_audit_log').select('*');
    expect(log.error).toBeNull();
    expect(log.data).toEqual([]);

    // Internal functions: the client may not call them at all.
    const rpc = s.client.rpc as unknown as (
      fn: string,
      args?: object,
    ) => Promise<{ error: { message: string } | null }>;
    const internals: Array<[string, object]> = [
      ['ensure_shadow_triggers', {}],
      ['shadow_alert_slack', { p_text: 'x' }],
      ['open_shadow_session_for', { p_user_id: otherMc.id }],
    ];
    for (const [fn, args] of internals) {
      const res = await rpc.call(s.client, fn, args);
      expect(res.error, fn).not.toBeNull();
    }
  });

  // Owner ruling 2026-09-27: support visits are logged for Zebri, never
  // shown to the MC. The Settings card and its my_support_access() read
  // are gone (20261024800000), so a shadowed MC must have no path to
  // their own history while the internal log still holds it.
  it('a shadowed MC cannot read their own support history, which is still logged', async () => {
    const mc = await createTestUser({}, {
      account_type: 'vendor',
      subscription_status: 'active',
      subscription_plan: 'pro',
    });
    try {
      const visit = await shadow('open', mc);
      await insertContact(visit.client, mc.id, 'Added during the visit');
      expect(
        (await svc.from('admin_shadow_sessions').update({ ended_at: new Date().toISOString() }).eq('session_id', visit.sid)).error,
      ).toBeNull();

      // The internal record is intact: the session and its change.
      const sessions = await svc.from('admin_shadow_sessions').select('session_id').eq('target_user_id', mc.id);
      expect(sessions.data?.map((r) => r.session_id)).toContain(visit.sid);
      expect((await rowsFor(visit.sid)).length).toBeGreaterThan(0);

      // The MC sees none of it, by any route.
      const rpc = mc.client.rpc as unknown as (fn: string) => Promise<{ error: { message: string } | null }>;
      expect((await rpc.call(mc.client, 'my_support_access')).error).not.toBeNull();
      const read = await mc.client.from('admin_shadow_sessions').select('*');
      expect(read.error?.message).toMatch(/permission denied/);
      const log = await mc.client.from('admin_audit_log').select('*');
      expect(log.error).toBeNull();
      expect(log.data).toEqual([]);
    } finally {
      await svc.from('admin_audit_log').delete().eq('target_user_id', mc.id);
      await mc.cleanup();
    }
  });
});
