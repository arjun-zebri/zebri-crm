// @vitest-environment node
/**
 * `redeemRecoveryCodeAction` (Phase 4, Task 23): the order of operations
 * and what leaves the server. A wrong code must touch nothing; a right one
 * must spend the code for the signed-in user only, remove the factor, send
 * an alert carrying ids and no email, sign out and redirect. The table
 * itself is exercised against local Supabase in the integration suite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = { id: 'user-1', email: 'mc@example.com' };

const m = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  spend: vi.fn(),
  removeFactors: vi.fn(),
  deleteUnused: vi.fn(),
  release: vi.fn(),
  sendEmail: vi.fn(),
  sendAlert: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: m.sendAlert }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ admin: true }) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: m.user } }), signOut: m.signOut },
  }),
}));
vi.mock('@/lib/auth/recovery-codes', () => ({
  spendRecoveryCode: m.spend,
  removeTotpFactors: m.removeFactors,
  deleteUnusedRecoveryCodes: m.deleteUnused,
  releaseRecoveryCode: m.release,
}));
vi.mock('@/lib/email/account-security', () => ({ sendTwoFactorRemovedEmail: m.sendEmail }));

import { redeemRecoveryCodeAction } from '@/app/(auth)/login/mfa/actions';

function form(code: string): FormData {
  const f = new FormData();
  f.set('code', code);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.user = { ...USER, id: `user-${Math.random()}` }; // fresh rate-limit key per test
  m.spend.mockResolvedValue({ spent: false });
  m.removeFactors.mockResolvedValue(1);
  m.deleteUnused.mockResolvedValue(undefined);
  m.release.mockResolvedValue(undefined);
  m.sendEmail.mockResolvedValue({ ok: true });
});

describe('redeemRecoveryCodeAction', () => {
  it('refuses without a session and checks nothing', async () => {
    m.user = null;
    const res = await redeemRecoveryCodeAction({}, form('abcde-fghjk'));
    expect(res.error).toMatch(/sign in/i);
    expect(m.spend).not.toHaveBeenCalled();
  });

  it('rejects malformed input before touching the database', async () => {
    const res = await redeemRecoveryCodeAction({}, form('short'));
    expect(res.fieldErrors?.code).toBeDefined();
    expect(m.spend).not.toHaveBeenCalled();
  });

  it('a wrong code removes nothing and alerts nobody', async () => {
    const res = await redeemRecoveryCodeAction({}, form('abcde-fghjk'));
    expect(res.fieldErrors?.code).toMatch(/did not work/);
    expect(m.removeFactors).not.toHaveBeenCalled();
    expect(m.sendAlert).not.toHaveBeenCalled();
  });

  it('a right code is spent for the signed-in user, removes the factor, alerts with ids only, signs out', async () => {
    m.spend.mockResolvedValue({ spent: true, codeId: 'code-1' });
    await expect(redeemRecoveryCodeAction({}, form('ABCDE-FGHJK'))).rejects.toThrow(
      'REDIRECT /login?recovered=1',
    );
    const userId = m.user!.id;
    expect(m.spend).toHaveBeenCalledWith({ admin: true }, userId, 'ABCDE-FGHJK');
    expect(m.removeFactors).toHaveBeenCalledWith({ admin: true }, userId);
    expect(m.deleteUnused).toHaveBeenCalledWith({ admin: true }, userId);
    expect(m.sendAlert).toHaveBeenCalledWith({
      type: 'mfa_recovery_code_used',
      severity: 'warn',
      userId,
      factorsRemoved: 1,
    });
    expect(JSON.stringify(m.sendAlert.mock.calls)).not.toContain('@');
    // The MC hears about it too, at their own address (review M4).
    expect(m.sendEmail).toHaveBeenCalledWith({ to: USER.email });
    expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('still signs out and redirects when the notice email fails', async () => {
    m.spend.mockResolvedValue({ spent: true, codeId: 'code-1' });
    m.sendEmail.mockRejectedValue(new Error('resend down'));
    await expect(redeemRecoveryCodeAction({}, form('abcde-fghjk'))).rejects.toThrow('REDIRECT /login?recovered=1');
  });

  it('returns a generic error, not a redirect, when factor removal fails', async () => {
    m.spend.mockResolvedValue({ spent: true, codeId: 'code-1' });
    m.removeFactors.mockRejectedValue(new Error('auth down'));
    const res = await redeemRecoveryCodeAction({}, form('abcde-fghjk'));
    expect(res.error).toMatch(/our side/);
    // The code is handed back, so the MC can retry with it.
    expect(m.release).toHaveBeenCalledWith({ admin: true }, m.user!.id, 'code-1');
    expect(m.deleteUnused).not.toHaveBeenCalled();
    expect(m.sendAlert).not.toHaveBeenCalled();
    expect(m.sendEmail).not.toHaveBeenCalled();
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it('rate-limits per user after five attempts and raises auth_rate_limit_hit', async () => {
    for (let i = 0; i < 5; i += 1) await redeemRecoveryCodeAction({}, form('abcde-fghjk'));
    expect(m.spend).toHaveBeenCalledTimes(5);
    const res = await redeemRecoveryCodeAction({}, form('abcde-fghjk'));
    expect(res.error).toMatch(/Too many attempts/);
    expect(m.spend).toHaveBeenCalledTimes(5);
    expect(m.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth_rate_limit_hit', action: 'redeemRecoveryCode' }),
    );
  });
});
