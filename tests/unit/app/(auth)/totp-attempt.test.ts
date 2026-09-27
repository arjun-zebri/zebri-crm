// @vitest-environment node
/**
 * The app-side limit on authenticator code checks (Task 23 review):
 * keyed on the user AND on the IP, so neither spreading guesses over many
 * IPs nor one IP trying many accounts gets unlimited tries.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  userId: 'u',
  ip: '203.0.113.1',
  sendAlert: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': m.ip }),
}));
vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: m.sendAlert }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: m.userId ? { id: m.userId } : null } }) },
  }),
}));

import { beginTotpAttemptAction } from '@/app/(auth)/login/mfa/totp-attempt';

let seq = 0;
beforeEach(() => {
  vi.clearAllMocks();
  seq += 1;
  m.userId = `user-${seq}`;
  m.ip = `203.0.113.${seq}`;
});

describe('beginTotpAttemptAction', () => {
  it('refuses without a session', async () => {
    m.userId = '';
    expect((await beginTotpAttemptAction()).ok).toBe(false);
  });

  it('allows 10 tries per user, then refuses even from fresh IPs', async () => {
    for (let i = 0; i < 10; i += 1) {
      m.ip = `198.51.100.${i}`;
      expect((await beginTotpAttemptAction()).ok).toBe(true);
    }
    m.ip = '198.51.100.99';
    expect(await beginTotpAttemptAction()).toEqual({ ok: false, error: expect.stringMatching(/Too many/) });
    expect(m.sendAlert).toHaveBeenCalledWith(expect.objectContaining({ action: 'verifyTotpUser' }));
  });

  it('allows 30 tries per IP across accounts, then refuses', async () => {
    for (let i = 0; i < 30; i += 1) {
      m.userId = `spray-${seq}-${i}`;
      expect((await beginTotpAttemptAction()).ok).toBe(true);
    }
    m.userId = `spray-${seq}-last`;
    expect((await beginTotpAttemptAction()).ok).toBe(false);
    expect(m.sendAlert).toHaveBeenCalledWith(expect.objectContaining({ action: 'verifyTotpIp' }));
  });
});
