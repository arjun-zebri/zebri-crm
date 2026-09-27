import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  countUnusedRecoveryCodes,
  deleteUnusedRecoveryCodes,
  issueRecoveryCodes,
  matchRecoveryCode,
  releaseRecoveryCode,
  removeTotpFactors,
  spendRecoveryCode,
} from '@/lib/auth/recovery-codes';

import { totp } from '../../e2e/fixtures/totp';
import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * `mfa_recovery_codes` (Phase 4, Task 23) is service-role only: RLS on,
 * no policies, and every client grant revoked. A readable hash could be
 * brute forced offline; a client insert would let someone with only the
 * password mint a code they know. So this proves the OWNER is refused on
 * every verb through the client, the same as another tenant and anon.
 *
 * It also runs the server-side lifecycle against the real table: issue,
 * spend once, refuse a second spend, refuse another user's code, replace
 * on re-issue, and remove a real verified TOTP factor through the admin API.
 */
describe('RLS: mfa_recovery_codes (service role only)', () => {
  let owner: TestUser;
  let other: TestUser;
  let codes: string[];
  let seededId: string;
  const svc = serviceClient();

  beforeAll(async () => {
    owner = await createTestUser();
    other = await createTestUser();
    codes = await issueRecoveryCodes(svc, owner.id);
    const { data, error } = await svc
      .from('mfa_recovery_codes')
      .select('id')
      .eq('user_id', owner.id)
      .limit(1)
      .single();
    expect(error).toBeNull();
    seededId = data!.id;
  });

  afterAll(async () => {
    await owner?.cleanup();
    await other?.cleanup();
  });

  it('issues ten hashed codes; the plain codes are not stored', async () => {
    expect(codes).toHaveLength(10);
    const { data } = await svc.from('mfa_recovery_codes').select('salt, code_hash').eq('user_id', owner.id);
    expect(data).toHaveLength(10);
    const stored = JSON.stringify(data);
    for (const code of codes) expect(stored).not.toContain(code.replace('-', ''));
  });

  for (const who of ['owner', 'other tenant', 'anon'] as const) {
    const client = () => (who === 'owner' ? owner.client : who === 'other tenant' ? other.client : anonClient());

    it(`${who} cannot SELECT`, async () => {
      const { data, error } = await client().from('mfa_recovery_codes').select('id, code_hash');
      expect(error).not.toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it(`${who} cannot INSERT, even a row for the owner`, async () => {
      const { error } = await client()
        .from('mfa_recovery_codes')
        .insert({ user_id: owner.id, salt: '00', code_hash: '00' });
      expect(error).not.toBeNull();
      expect(await countUnusedRecoveryCodes(svc, owner.id)).toBe(10);
    });

    it(`${who} cannot UPDATE (e.g. un-spend a code)`, async () => {
      await client().from('mfa_recovery_codes').update({ code_hash: 'tampered' }).eq('id', seededId);
      const { data } = await svc.from('mfa_recovery_codes').select('code_hash').eq('id', seededId).single();
      expect(data?.code_hash).not.toBe('tampered');
    });

    it(`${who} cannot DELETE`, async () => {
      await client().from('mfa_recovery_codes').delete().eq('id', seededId);
      const { data } = await svc.from('mfa_recovery_codes').select('id').eq('id', seededId);
      expect(data).toHaveLength(1);
    });
  }

  it('spends a code once, for its owner only', async () => {
    const code = codes[0]!;
    expect((await spendRecoveryCode(svc, other.id, code)).spent).toBe(false);
    expect((await spendRecoveryCode(svc, owner.id, 'zzzzz-zzzzz')).spent).toBe(false);
    const first = await spendRecoveryCode(svc, owner.id, code.toUpperCase());
    expect(first.spent).toBe(true);
    expect((await spendRecoveryCode(svc, owner.id, code)).spent).toBe(false);
    expect(await countUnusedRecoveryCodes(svc, owner.id)).toBe(9);
  });

  it('refuses every other code of the batch once one is spent (single winner)', async () => {
    expect((await spendRecoveryCode(svc, owner.id, codes[2]!)).spent).toBe(false);
  });

  it('a released code can be used again, and the batch reopens', async () => {
    const { data } = await svc.from('mfa_recovery_codes').select('id').eq('user_id', owner.id).not('used_at', 'is', null);
    await releaseRecoveryCode(svc, owner.id, data![0]!.id);
    expect(await countUnusedRecoveryCodes(svc, owner.id)).toBe(10);
    expect((await spendRecoveryCode(svc, owner.id, codes[0]!)).spent).toBe(true);
  });

  it('re-issuing replaces every earlier code', async () => {
    const fresh = await issueRecoveryCodes(svc, owner.id);
    expect((await spendRecoveryCode(svc, owner.id, codes[1]!)).spent).toBe(false);
    expect(await countUnusedRecoveryCodes(svc, owner.id)).toBe(10);
    codes = fresh;
  });

  it('two concurrent redemptions of the SAME code: exactly one wins', async () => {
    const results = await Promise.all([
      spendRecoveryCode(svc, owner.id, codes[3]!),
      spendRecoveryCode(svc, owner.id, codes[3]!),
    ]);
    expect(results.filter((r) => r.spent)).toHaveLength(1);
    codes = await issueRecoveryCodes(svc, owner.id);
  });

  it('two concurrent redemptions of DIFFERENT codes: exactly one wins', async () => {
    const results = await Promise.all([
      spendRecoveryCode(svc, owner.id, codes[4]!),
      spendRecoveryCode(svc, owner.id, codes[5]!),
      spendRecoveryCode(svc, owner.id, codes[6]!),
    ]);
    expect(results.filter((r) => r.spent)).toHaveLength(1);
    await deleteUnusedRecoveryCodes(svc, owner.id);
    expect(await countUnusedRecoveryCodes(svc, owner.id)).toBe(0);
  });

  it('two concurrent issues leave exactly ten codes, not twenty', async () => {
    const [a, b] = await Promise.all([issueRecoveryCodes(svc, owner.id), issueRecoveryCodes(svc, owner.id)]);
    const { count } = await svc
      .from('mfa_recovery_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', owner.id);
    expect(count).toBe(10);
    // Exactly one of the two batches survived, whole.
    const { data: rows } = await svc
      .from('mfa_recovery_codes')
      .select('id, salt, code_hash')
      .eq('user_id', owner.id);
    const aLive = (await matchRecoveryCode(a[0]!, rows ?? [])) !== null;
    const bLive = (await matchRecoveryCode(b[0]!, rows ?? [])) !== null;
    expect(aLive !== bLive).toBe(true);
    codes = aLive ? a : b;
  });

  it('the issue and spend functions are not callable by client roles', async () => {
    const { error: e1 } = await owner.client.rpc('replace_mfa_recovery_codes', {
      p_user_id: owner.id,
      p_codes: [{ salt: '00', code_hash: '00' }],
    });
    // 42501 = insufficient_privilege: a real permission denial, not a
    // signature mismatch passing for one.
    expect(e1?.code).toBe('42501');
    const { error: e2 } = await anonClient().rpc('spend_mfa_recovery_code', {
      p_user_id: owner.id,
      p_code_id: seededId,
    });
    expect(e2?.code).toBe('42501');
  });

  it('removes a verified TOTP factor through the admin API', async () => {
    const { data: enrolled, error: enrollError } = await owner.client.auth.mfa.enroll({
      factorType: 'totp',
    });
    expect(enrollError).toBeNull();
    const { error: verifyError } = await owner.client.auth.mfa.challengeAndVerify({
      factorId: enrolled!.id,
      code: totp(enrolled!.totp.secret),
    });
    expect(verifyError).toBeNull();

    expect(await removeTotpFactors(svc, owner.id)).toBe(1);
    const { data } = await svc.auth.admin.mfa.listFactors({ userId: owner.id });
    expect(data?.factors ?? []).toEqual([]);
  });
});
