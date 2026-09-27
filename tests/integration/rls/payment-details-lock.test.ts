import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { jwtSessionId } from '@/lib/admin/shadow-sessions';
import type { Database } from '@/types/database';

import { totp } from '../../e2e/fixtures/totp';
import { runSql } from '../helpers/sql';
import {
  anonClient,
  createTestUser,
  localSupabaseEnv,
  serviceClient,
  type DbClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * Payment details locked behind two-factor (Phase 4, Task 23c), against
 * real local Supabase auth.
 *
 * The threat (Task 23b review I1): a password thief signs in (aal1) as an
 * MC with 2FA on and calls `auth.updateUser({ data: { bank_bsb } })`.
 * GoTrue accepts aal1 for that, and the public invoice then tells couples
 * to pay the thief. The `lock_payment_details` trigger on auth.users must
 * refuse that write, and `set_my_payment_details` (the only writer) must
 * refuse the same session, while every legitimate save keeps working.
 */
describe('payment details: only the 2FA-guarded RPC can change them', () => {
  const svc = serviceClient();
  const PASSWORD = 'test-password-12345';
  const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };
  const ORIGINAL = {
    bank_account_name: 'Original Events',
    bank_bsb: '062-000',
    bank_account_number: '12345678',
    abn: '51 824 753 556',
  };

  let mfaMc: TestUser;
  let plainMc: TestUser;
  let admin: TestUser;
  /** mfaMc's enrolment client: it verified TOTP, so its session is aal2. */
  let aal2: DbClient;
  let invoiceToken: string;

  /** A fresh password-only sign-in: an aal1 session with its own session_id. */
  async function passwordOnly(user: TestUser): Promise<{ client: DbClient; sid: string; aal: unknown }> {
    const { url, anonKey } = localSupabaseEnv();
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD });
    expect(error).toBeNull();
    const token = data.session!.access_token;
    const sid = jwtSessionId(token);
    if (!sid) throw new Error('test session has no session_id claim');
    const aal = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).aal;
    return { client, sid, aal };
  }

  /**
   * How GoTrue reports a write the lock trigger aborted: its generic 500
   * for a database error. The raw-SQL case below pins the trigger's own
   * message; this pins that GoTrue failed on the write, not on something
   * earlier such as auth.
   */
  function expectLockRefusal(error: unknown) {
    expect(error).toMatchObject({ status: 500, code: 'unexpected_failure', message: 'Error updating user' });
  }

  /** The stored metadata, read past RLS and GoTrue. */
  async function storedMeta(user: TestUser): Promise<Record<string, unknown>> {
    const { data, error } = await svc.auth.admin.getUserById(user.id);
    expect(error).toBeNull();
    return data.user!.user_metadata ?? {};
  }

  beforeAll(async () => {
    admin = await createTestUser({}, { account_type: 'admin' });
    // Created with the details already set: signup is an INSERT, which
    // the BEFORE UPDATE lock does not see.
    mfaMc = await createTestUser({ ...ORIGINAL, tagline: 'Hello' }, pro);
    plainMc = await createTestUser({}, pro);

    aal2 = mfaMc.client;
    const { data: enrolled, error: enrollError } = await aal2.auth.mfa.enroll({ factorType: 'totp' });
    expect(enrollError).toBeNull();
    const { error: verifyError } = await aal2.auth.mfa.challengeAndVerify({
      factorId: enrolled!.id,
      code: totp(enrolled!.totp.secret),
    });
    expect(verifyError).toBeNull();

    const { data: couple, error: coupleError } = await svc
      .from('couples')
      .insert({ user_id: mfaMc.id, name: 'Paying Couple', status: 'booked' })
      .select('id')
      .single();
    expect(coupleError).toBeNull();
    const { data: invoice, error: invoiceError } = await svc
      .from('invoices')
      .insert({
        user_id: mfaMc.id,
        couple_id: couple!.id,
        title: 'MC services',
        invoice_number: 'INV-23C',
        status: 'sent',
        subtotal: 1000,
        share_token_enabled: true,
      })
      .select('share_token')
      .single();
    expect(invoiceError).toBeNull();
    invoiceToken = invoice!.share_token as string;
  });

  afterAll(async () => {
    const ids = [mfaMc?.id, plainMc?.id].filter(Boolean) as string[];
    await svc.from('admin_audit_log').delete().in('target_user_id', ids);
    await svc.from('admin_shadow_sessions').delete().in('target_user_id', ids);
    await admin?.cleanup();
    await mfaMc?.cleanup();
    await plainMc?.cleanup();
  });

  describe('2FA MC, password only (aal1)', () => {
    it('is really an aal1 session', async () => {
      expect((await passwordOnly(mfaMc)).aal).toBe('aal1');
    });

    it('cannot change bank details through auth.updateUser, and nothing is stored', async () => {
      const { client } = await passwordOnly(mfaMc);
      const { error } = await client.auth.updateUser({
        data: { bank_bsb: '999-999', bank_account_number: '87654321' },
      });
      expectLockRefusal(error);
      const meta = await storedMeta(mfaMc);
      expect(meta.bank_bsb).toBe(ORIGINAL.bank_bsb);
      expect(meta.bank_account_number).toBe(ORIGINAL.bank_account_number);
    });

    it('cannot change the ABN or clear the account name through auth.updateUser either', async () => {
      const { client } = await passwordOnly(mfaMc);
      expectLockRefusal((await client.auth.updateUser({ data: { abn: '11 111 111 111' } })).error);
      expectLockRefusal((await client.auth.updateUser({ data: { bank_account_name: null } })).error);
      const meta = await storedMeta(mfaMc);
      expect(meta.abn).toBe(ORIGINAL.abn);
      expect(meta.bank_account_name).toBe(ORIGINAL.bank_account_name);
    });

    it('is refused by the RPC with 42501', async () => {
      const { client } = await passwordOnly(mfaMc);
      const { error } = await client.rpc('set_my_payment_details', { p_details: { bank_bsb: '999-999' } });
      expect(error).toMatchObject({ code: '42501', message: 'second factor required' });
      expect((await storedMeta(mfaMc)).bank_bsb).toBe(ORIGINAL.bank_bsb);
    });

    it('can still save unrelated metadata, resending the unchanged bank keys too', async () => {
      const { client } = await passwordOnly(mfaMc);
      const meta = await storedMeta(mfaMc);
      const { error } = await client.auth.updateUser({ data: { ...meta, tagline: 'Resent everything' } });
      expect(error).toBeNull();
      const after = await storedMeta(mfaMc);
      expect(after.tagline).toBe('Resent everything');
      expect(after.bank_bsb).toBe(ORIGINAL.bank_bsb);
    });
  });

  describe('2FA MC after the second factor (aal2)', () => {
    it('changes only the keys sent, and the public invoice shows the new values', async () => {
      const { data, error } = await aal2.rpc('set_my_payment_details', {
        p_details: { bank_bsb: ' 083-004 ', bank_account_number: '987654321' },
      });
      expect(error).toBeNull();
      expect(data).toEqual({
        bank_account_name: ORIGINAL.bank_account_name,
        bank_bsb: '083-004',
        bank_account_number: '987654321',
        abn: ORIGINAL.abn,
      });
      const meta = await storedMeta(mfaMc);
      expect(meta).toMatchObject({ bank_bsb: '083-004', bank_account_number: '987654321', tagline: 'Resent everything' });

      const { data: invoice, error: invoiceError } = await anonClient().rpc('get_public_invoice', { token: invoiceToken });
      expect(invoiceError).toBeNull();
      expect(invoice).toMatchObject({
        bank_bsb: '083-004',
        bank_account_number: '987654321',
        bank_account_name: ORIGINAL.bank_account_name,
      });
    });

    it('validates the shape of a changed value (22023) and stores nothing', async () => {
      for (const [key, value, message] of [
        ['bank_bsb', '12345', 'BSB must be 6 digits'],
        ['bank_account_number', '12', 'Account number must be 4 to 10 digits'],
        ['abn', '123', 'ABN must be 11 digits'],
        ['bank_account_name', 'x'.repeat(201), 'Account name must be 200 characters or fewer'],
      ] as const) {
        const { error } = await aal2.rpc('set_my_payment_details', { p_details: { [key]: value } });
        expect(error, key).toMatchObject({ code: '22023', message });
      }
      const unknown = await aal2.rpc('set_my_payment_details', { p_details: { tagline: 'x' } });
      expect(unknown.error).toMatchObject({ code: '22023', message: 'unknown payment detail: tagline' });
      const notText = await aal2.rpc('set_my_payment_details', { p_details: { bank_bsb: 62000 } });
      expect(notText.error).toMatchObject({ code: '22023', message: 'bank_bsb must be text' });
      expect((await storedMeta(mfaMc)).bank_bsb).toBe('083-004');
    });

    it('trims every kind of whitespace, as the form does (fix round 1, M5)', async () => {
      const { data, error } = await aal2.rpc('set_my_payment_details', {
        p_details: { abn: '\t51 824 753 556\n', bank_account_name: '\u00a0Original Events\u00a0' },
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ abn: '51 824 753 556', bank_account_name: 'Original Events' });
    });

    it('clears a key sent as null or empty', async () => {
      const { data, error } = await aal2.rpc('set_my_payment_details', { p_details: { abn: '' } });
      expect(error).toBeNull();
      expect((data as Record<string, unknown>).abn).toBeNull();
      expect('abn' in (await storedMeta(mfaMc))).toBe(false);

      // The profile save that follows a clear resends "" or null for it:
      // not a change, so not refused.
      const { error: resend } = await aal2.auth.updateUser({ data: { abn: '' } });
      expect(resend).toBeNull();
    });
  });

  describe('MC with no factor', () => {
    it('uses the RPC at aal1', async () => {
      const { client, aal } = await passwordOnly(plainMc);
      expect(aal).toBe('aal1');
      const { data, error } = await client.rpc('set_my_payment_details', {
        p_details: { bank_account_name: 'Plain MC', bank_bsb: '062000', bank_account_number: '1234', abn: '51824753556' },
      });
      expect(error).toBeNull();
      expect(data).toEqual({
        bank_account_name: 'Plain MC',
        bank_bsb: '062000',
        bank_account_number: '1234',
        abn: '51824753556',
      });
    });

    it('still cannot change them through auth.updateUser', async () => {
      const { error } = await plainMc.client.auth.updateUser({ data: { bank_bsb: '111-111' } });
      expectLockRefusal(error);
      expect((await storedMeta(plainMc)).bank_bsb).toBe('062000');
    });
  });

  describe('every other writer', () => {
    it('the service role (GoTrue admin API) is refused too', async () => {
      const { error } = await svc.auth.admin.updateUserById(plainMc.id, { user_metadata: { bank_bsb: '222-222' } });
      expectLockRefusal(error);
      expect((await storedMeta(plainMc)).bank_bsb).toBe('062000');
    });

    it('a direct UPDATE is refused without the flag, and allowed with it (the support path)', () => {
      expect(() =>
        runSql(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"bank_bsb":"333-333"}' where id = '${plainMc.id}';`),
      ).toThrow(/payment details can only be changed from Settings/);
      const out = runSql(`
        begin;
        select set_config('zebri.payment_details_write', 'on', true);
        update auth.users set raw_user_meta_data = raw_user_meta_data || '{"bank_bsb":"333-333"}' where id = '${plainMc.id}';
        select 'saved:' || (raw_user_meta_data ->> 'bank_bsb') from auth.users where id = '${plainMc.id}';
        rollback;
      `);
      expect(out.split('\n')).toContain('saved:333-333');
    });

    it('the service role cannot call the RPC (no EXECUTE; it has no auth.uid() to act for anyway)', async () => {
      const { error } = await svc.rpc('set_my_payment_details', { p_details: { bank_bsb: '444-444' } });
      expect(error?.code).toBe('42501');
      expect(error?.message).toMatch(/permission denied for function set_my_payment_details/);
    });
  });

  describe('stripe_connect_enabled on the public RPCs (fix round 1, I1 part 2)', () => {
    let connected: TestUser;
    let connectedInvoiceToken: string;
    let connectedProposalToken: string;

    /** What the couple's invoice and proposal say about card payment. */
    async function publicFlags(): Promise<[unknown, unknown]> {
      const anon = anonClient();
      const invoice = await anon.rpc('get_public_invoice', { token: connectedInvoiceToken });
      expect(invoice.error).toBeNull();
      const proposal = await anon.rpc('get_public_proposal', { token: connectedProposalToken });
      expect(proposal.error).toBeNull();
      return [
        (invoice.data as Record<string, unknown>).stripe_connect_enabled,
        (proposal.data as Record<string, unknown>).stripe_connect_enabled,
      ];
    }

    beforeAll(async () => {
      // Connect is on in app_metadata, where the webhook writes it.
      connected = await createTestUser({}, { ...pro, stripe_connect_enabled: true });
      const { data: couple } = await svc
        .from('couples')
        .insert({ user_id: connected.id, name: 'Card Couple', status: 'booked' })
        .select('id')
        .single();
      const { data: invoice, error: invoiceError } = await svc
        .from('invoices')
        .insert({
          user_id: connected.id,
          couple_id: couple!.id,
          title: 'Card invoice',
          invoice_number: 'INV-23C-CARD',
          status: 'sent',
          subtotal: 1000,
          share_token_enabled: true,
        })
        .select('share_token')
        .single();
      expect(invoiceError).toBeNull();
      connectedInvoiceToken = invoice!.share_token as string;
      const { data: proposal, error: proposalError } = await svc
        .from('proposals')
        .insert({
          user_id: connected.id,
          couple_id: couple!.id,
          title: 'Card proposal',
          proposal_number: 'PR-23C-CARD',
          intro_note: { type: 'doc', content: [] },
          share_token_enabled: true,
          status: 'sent',
        })
        .select('share_token')
        .single();
      expect(proposalError).toBeNull();
      connectedProposalToken = proposal!.share_token as string;
    });

    afterAll(async () => {
      await connected?.cleanup();
    });

    it('comes from app_metadata', async () => {
      expect(await publicFlags()).toEqual([true, true]);
    });

    it('an aal1 user_metadata flip does not change it', async () => {
      const { error } = await connected.client.auth.updateUser({ data: { stripe_connect_enabled: false } });
      expect(error).toBeNull();
      expect(await publicFlags()).toEqual([true, true]);
    });

    it('a garbage value in either bag never breaks the invoice or the proposal', async () => {
      const { error } = await connected.client.auth.updateUser({ data: { stripe_connect_enabled: 'x' } });
      expect(error).toBeNull();
      expect(await publicFlags()).toEqual([true, true]);
      // Even in app_metadata (only the service role can write there): false, not an error.
      const { error: appError } = await svc.auth.admin.updateUserById(connected.id, {
        app_metadata: { stripe_connect_enabled: 'not-a-boolean' },
      });
      expect(appError).toBeNull();
      expect(await publicFlags()).toEqual([false, false]);
    });
  });

  describe('shadow sessions', () => {
    it('support changing bank details through the RPC is logged by the shadow trigger', async () => {
      const s = await passwordOnly(mfaMc);
      const { error: recordError } = await svc.from('admin_shadow_sessions').insert({
        session_id: s.sid,
        admin_id: admin.id,
        target_user_id: mfaMc.id,
      });
      expect(recordError).toBeNull();

      // The shadow waiver lets the aal1 shadow session through the guard.
      const { error } = await s.client.rpc('set_my_payment_details', { p_details: { bank_bsb: '555-555' } });
      expect(error).toBeNull();

      const { data: rows, error: logError } = await svc
        .from('admin_audit_log')
        .select('actor_id, details')
        .eq('action', 'shadow_mutation')
        .eq('target_user_id', mfaMc.id)
        .eq('details->>table', 'auth.users')
        .eq('details->>shadow_session_id', s.sid);
      expect(logError).toBeNull();
      expect(rows).toHaveLength(1);
      expect(rows![0]).toMatchObject({
        actor_id: admin.id,
        details: {
          changed_keys: ['user_metadata.bank_bsb'],
          attribution: 'during_session',
          sensitive: true,
        },
      });
      expect(JSON.stringify(rows![0]!.details)).not.toContain('555-555');
    });

    it('an ABN change through a shadow session is flagged sensitive (fix round 1, M2)', async () => {
      const s = await passwordOnly(mfaMc);
      const { error: recordError } = await svc.from('admin_shadow_sessions').insert({
        session_id: s.sid,
        admin_id: admin.id,
        target_user_id: mfaMc.id,
      });
      expect(recordError).toBeNull();
      const { error } = await s.client.rpc('set_my_payment_details', { p_details: { abn: '11 111 111 111' } });
      expect(error).toBeNull();
      const { data: rows } = await svc
        .from('admin_audit_log')
        .select('details')
        .eq('target_user_id', mfaMc.id)
        .eq('details->>shadow_session_id', s.sid);
      expect(rows).toHaveLength(1);
      expect(rows![0]!.details).toMatchObject({ changed_keys: ['user_metadata.abn'], sensitive: true });
    });
  });
});
