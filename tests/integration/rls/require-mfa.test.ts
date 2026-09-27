import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { jwtSessionId } from '@/lib/admin/shadow-sessions';
import type { Database } from '@/types/database';

import { totp } from '../../e2e/fixtures/totp';
import {
  anonClient,
  createTestUser,
  localSupabaseEnv,
  serviceClient,
  type DbClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * Two-factor sign-in enforced by the database (Phase 4, Task 23b), against
 * real local Supabase auth, RLS and Storage.
 *
 * The threat: a password thief signs in with the publishable key and gets
 * an `aal1` token for an MC who has 2FA on. The Next gate never sees
 * their PostgREST, Storage or RPC calls, so the `require_mfa` restrictive
 * policies and the guards in definer RPCs must refuse them. An MC without
 * a factor, a session that completed TOTP, an open shadow session, the
 * couple-facing token RPCs and the service role must all be unaffected.
 */
describe('require_mfa: an aal1 session of a 2FA MC gets nothing from the database', () => {
  const svc = serviceClient();
  const PASSWORD = 'test-password-12345';
  const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };

  let mfaMc: TestUser;
  let plainMc: TestUser;
  let admin: TestUser;
  let enrolling: TestUser | undefined;
  /** mfaMc's enrolment client: it verified TOTP, so its session is aal2. */
  let aal2: DbClient;
  let seededContactId: string;
  let portalToken: string;

  /** A fresh password-only sign-in: an aal1 session with its own session_id. */
  async function passwordOnly(user: TestUser): Promise<{ client: DbClient; sid: string; aal: unknown }> {
    const { url, anonKey } = localSupabaseEnv();
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD });
    expect(error).toBeNull();
    const token = data.session?.access_token;
    const sid = jwtSessionId(token);
    if (!sid) throw new Error('test session has no session_id claim');
    const aal = JSON.parse(Buffer.from(token!.split('.')[1]!, 'base64url').toString()).aal;
    return { client, sid, aal };
  }

  async function contactNames(client: DbClient): Promise<string[]> {
    const { data, error } = await client.from('contacts').select('name');
    expect(error).toBeNull();
    return (data ?? []).map((r) => r.name);
  }

  beforeAll(async () => {
    admin = await createTestUser({}, { account_type: 'admin' });
    mfaMc = await createTestUser({}, pro);
    plainMc = await createTestUser({}, pro);

    const { data: contact, error: contactError } = await svc
      .from('contacts')
      .insert({ user_id: mfaMc.id, name: 'Seeded before 2FA', category: 'photographer' })
      .select('id')
      .single();
    expect(contactError).toBeNull();
    seededContactId = contact!.id;

    const { data: couple, error: coupleError } = await svc
      .from('couples')
      .insert({ user_id: mfaMc.id, name: 'Portal Couple', portal_token_enabled: true })
      .select('portal_token')
      .single();
    expect(coupleError).toBeNull();
    portalToken = couple!.portal_token as string;

    // A file in a PRIVATE bucket (reads go through RLS, unlike the public
    // `branding` bucket), written before 2FA is on.
    const seeded = await svc.storage
      .from('email-template-files')
      // The bucket only accepts PDFs, Word files and images.
      .upload(`${mfaMc.id}/t23b-private.pdf`, new Blob(['private'], { type: 'application/pdf' }), {
        upsert: true,
        contentType: 'application/pdf',
      });
    expect(seeded.error).toBeNull();

    // Turn 2FA on the way the Settings card does: enrol, then verify one
    // code. The verifying client's session is upgraded to aal2.
    aal2 = mfaMc.client;
    const { data: enrolled, error: enrollError } = await aal2.auth.mfa.enroll({ factorType: 'totp' });
    expect(enrollError).toBeNull();
    const { error: verifyError } = await aal2.auth.mfa.challengeAndVerify({
      factorId: enrolled!.id,
      code: totp(enrolled!.totp.secret),
    });
    expect(verifyError).toBeNull();
  });

  afterAll(async () => {
    const ids = [mfaMc?.id, plainMc?.id].filter(Boolean) as string[];
    await svc.from('admin_audit_log').delete().in('target_user_id', ids);
    await svc.from('admin_shadow_sessions').delete().in('target_user_id', ids);
    for (const u of [mfaMc, plainMc]) {
      if (u) await svc.storage.from('branding').remove([`${u.id}/t23b-probe.txt`]);
    }
    if (mfaMc) await svc.storage.from('email-template-files').remove([`${mfaMc.id}/t23b-private.pdf`]);
    await enrolling?.cleanup();
    await admin?.cleanup();
    await mfaMc?.cleanup();
    await plainMc?.cleanup();
  });

  describe('2FA MC, password only (aal1)', () => {
    it('is really an aal1 session', async () => {
      expect((await passwordOnly(mfaMc)).aal).toBe('aal1');
    });

    it('reads zero rows', async () => {
      const { client } = await passwordOnly(mfaMc);
      expect(await contactNames(client)).toEqual([]);
      const { data } = await client.from('couples').select('id');
      expect(data).toEqual([]);
    });

    it('cannot insert, update or delete', async () => {
      const { client } = await passwordOnly(mfaMc);
      const insert = await client
        .from('contacts')
        .insert({ user_id: mfaMc.id, name: 'Written by a password thief', category: 'photographer' });
      // 42501: new row violates row-level security policy.
      expect(insert.error?.code).toBe('42501');

      const update = await client.from('contacts').update({ name: 'Tampered' }).eq('id', seededContactId).select('id');
      expect(update.data ?? []).toEqual([]);
      const del = await client.from('contacts').delete().eq('id', seededContactId).select('id');
      expect(del.data ?? []).toEqual([]);

      const { data: still } = await svc.from('contacts').select('name').eq('id', seededContactId).single();
      expect(still?.name).toBe('Seeded before 2FA');
    });

    it('a guarded definer RPC raises 42501', async () => {
      const { client } = await passwordOnly(mfaMc);
      const usage = await client.rpc('increment_ai_copilot_usage');
      expect(usage.error?.code).toBe('42501');
      expect(usage.error?.message).toBe('second factor required');
    });

    it('cannot write to Storage', async () => {
      const { client } = await passwordOnly(mfaMc);
      const { error } = await client.storage
        .from('branding')
        .upload(`${mfaMc.id}/t23b-probe.txt`, new Blob(['aal1']), { upsert: true });
      expect(error).not.toBeNull();
    });

    it('cannot read or list a private bucket', async () => {
      const { client } = await passwordOnly(mfaMc);
      const bucket = client.storage.from('email-template-files');
      const download = await bucket.download(`${mfaMc.id}/t23b-private.pdf`);
      expect(download.data).toBeNull();
      expect(download.error).not.toBeNull();
      const list = await bucket.list(mfaMc.id);
      expect((list.data ?? []).map((o) => o.name)).not.toContain('t23b-private.pdf');
    });

    it('still reaches the couple-facing token RPCs (they never act for the MC)', async () => {
      const { client } = await passwordOnly(mfaMc);
      const { data, error } = await client.rpc('get_portal_data', { token: portalToken });
      expect(error).toBeNull();
      expect(JSON.stringify(data)).toContain('Portal Couple');
    });
  });

  describe('2FA MC after verifying TOTP (aal2)', () => {
    it('reads, writes and calls RPCs normally', async () => {
      expect(await contactNames(aal2)).toContain('Seeded before 2FA');
      const insert = await aal2
        .from('contacts')
        .insert({ user_id: mfaMc.id, name: 'Written at aal2', category: 'photographer' })
        .select('id')
        .single();
      expect(insert.error).toBeNull();
      expect((await aal2.rpc('increment_ai_copilot_usage')).error).toBeNull();
    });

    it('reads and lists the private bucket', async () => {
      const bucket = aal2.storage.from('email-template-files');
      const download = await bucket.download(`${mfaMc.id}/t23b-private.pdf`);
      expect(download.error).toBeNull();
      expect(await download.data!.text()).toBe('private');
      const list = await bucket.list(mfaMc.id);
      expect((list.data ?? []).map((o) => o.name)).toContain('t23b-private.pdf');
    });

    it('writes to Storage', async () => {
      const { error } = await aal2.storage
        .from('branding')
        .upload(`${mfaMc.id}/t23b-probe.txt`, new Blob(['aal2']), { upsert: true });
      expect(error).toBeNull();
    });
  });

  describe('MC with no factor', () => {
    it('is unaffected at aal1', async () => {
      const { client, aal } = await passwordOnly(plainMc);
      expect(aal).toBe('aal1');
      const insert = await client
        .from('contacts')
        .insert({ user_id: plainMc.id, name: 'No 2FA, still fine', category: 'photographer' })
        .select('id')
        .single();
      expect(insert.error).toBeNull();
      expect(await contactNames(client)).toContain('No 2FA, still fine');
      expect((await client.rpc('increment_ai_copilot_usage')).error).toBeNull();
      const { error } = await client.storage
        .from('branding')
        .upload(`${plainMc.id}/t23b-probe.txt`, new Blob(['plain']), { upsert: true });
      expect(error).toBeNull();
    });
  });

  describe('MC with only an unverified factor (mid-enrolment)', () => {
    it('is not locked out at aal1: reads, writes, the guarded RPC and Storage all work', async () => {
      enrolling = await createTestUser({}, pro);
      const { client, aal } = await passwordOnly(enrolling);
      expect(aal).toBe('aal1');
      // Enrol but never verify, as the Settings card does between showing
      // the QR code and the MC typing the first code.
      const { data: factor, error: enrollError } = await client.auth.mfa.enroll({ factorType: 'totp' });
      expect(enrollError).toBeNull();
      const { data: listed } = await svc.auth.admin.mfa.listFactors({ userId: enrolling.id });
      expect(listed?.factors.find((f) => f.id === factor!.id)?.status).toBe('unverified');

      const insert = await client
        .from('contacts')
        .insert({ user_id: enrolling.id, name: 'Mid-enrolment write', category: 'photographer' })
        .select('id')
        .single();
      expect(insert.error).toBeNull();
      expect(await contactNames(client)).toContain('Mid-enrolment write');
      expect((await client.rpc('increment_ai_copilot_usage')).error).toBeNull();
      const upload = await client.storage
        .from('branding')
        .upload(`${enrolling.id}/t23b-probe.txt`, new Blob(['enrolling']), { upsert: true });
      expect(upload.error).toBeNull();
      await svc.storage.from('branding').remove([`${enrolling.id}/t23b-probe.txt`]);
    });
  });

  describe('shadow sessions', () => {
    async function recordShadow(sid: string, extra: Record<string, string> = {}) {
      const { error } = await svc.from('admin_shadow_sessions').insert({
        session_id: sid,
        admin_id: admin.id,
        target_user_id: mfaMc.id,
        ...extra,
      });
      expect(error).toBeNull();
    }

    it('an open shadow session is waived at aal1, and loses it at Exit', async () => {
      const s = await passwordOnly(mfaMc);
      await recordShadow(s.sid);
      expect(await contactNames(s.client)).toContain('Seeded before 2FA');
      const insert = await s.client
        .from('contacts')
        .insert({ user_id: mfaMc.id, name: 'Added by support', category: 'photographer' });
      expect(insert.error).toBeNull();

      // exitShadow stamps ended_at; the same token is refused from then on.
      const { error } = await svc
        .from('admin_shadow_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('session_id', s.sid);
      expect(error).toBeNull();
      expect(await contactNames(s.client)).toEqual([]);
      const after = await s.client
        .from('contacts')
        .insert({ user_id: mfaMc.id, name: 'After exit', category: 'photographer' });
      expect(after.error?.code).toBe('42501');
    });

    it('an expired shadow session is not waived', async () => {
      const s = await passwordOnly(mfaMc);
      const H = 3600_000;
      await recordShadow(s.sid, {
        started_at: new Date(Date.now() - 9 * H).toISOString(),
        expires_at: new Date(Date.now() - H).toISOString(),
      });
      expect(await contactNames(s.client)).toEqual([]);
    });

    it("a row with this session's id but another target does not waive it", async () => {
      const own = await passwordOnly(mfaMc);
      // session_id matches the JWT; the recorded target is someone else.
      const { error } = await svc.from('admin_shadow_sessions').insert({
        session_id: own.sid,
        admin_id: admin.id,
        target_user_id: plainMc.id,
      });
      expect(error).toBeNull();
      expect(await contactNames(own.client)).toEqual([]);
    });

    it('demoting the admin ends the waiver at once', async () => {
      const demotable = await createTestUser({}, { account_type: 'admin' });
      try {
        const s = await passwordOnly(mfaMc);
        const { error } = await svc.from('admin_shadow_sessions').insert({
          session_id: s.sid,
          admin_id: demotable.id,
          target_user_id: mfaMc.id,
        });
        expect(error).toBeNull();
        expect(await contactNames(s.client)).toContain('Seeded before 2FA');

        // Demote the way updateEntitlements does: app_metadata only. The
        // shadow row stays open; the waiver must still stop.
        const demoted = await svc.auth.admin.updateUserById(demotable.id, {
          app_metadata: { account_type: 'vendor' },
        });
        expect(demoted.error).toBeNull();
        expect(await contactNames(s.client)).toEqual([]);

        // user_metadata is user-writable and must not count as admin.
        await svc.auth.admin.updateUserById(demotable.id, { user_metadata: { account_type: 'admin' } });
        expect(await contactNames(s.client)).toEqual([]);
      } finally {
        await svc.from('admin_shadow_sessions').delete().eq('admin_id', demotable.id);
        await demotable.cleanup();
      }
    });

    it("a shadow row for another MC's session does not waive this one", async () => {
      const own = await passwordOnly(mfaMc);
      const other = await passwordOnly(plainMc);
      // A row naming mfaMc as target but keyed on plainMc's session id:
      // it must not help mfaMc's own aal1 session.
      await recordShadow(other.sid);
      expect(await contactNames(own.client)).toEqual([]);
    });
  });

  describe('paths that never carry an MC session', () => {
    it('anon token RPCs work', async () => {
      const { data, error } = await anonClient().rpc('get_portal_data', { token: portalToken });
      expect(error).toBeNull();
      expect(JSON.stringify(data)).toContain('Portal Couple');
    });

    it('the service role reads and writes the 2FA MC data', async () => {
      const { data, error } = await svc.from('contacts').select('id').eq('user_id', mfaMc.id);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });
  });
});
