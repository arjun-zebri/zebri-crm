/**
 * `useTotpEnrolment().cancel` (fix round 2, N4): 2FA must not be left on
 * with no recovery codes. When a verified factor without codes cannot be
 * removed, cancel reports false (the modal stays open) and says why.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  unenroll: vi.fn(),
  issue: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      mfa: {
        listFactors: async () => ({ data: { all: [], totp: [] }, error: null }),
        enroll: async () => ({
          data: { id: 'factor-1', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>\n', secret: 'ABC' } },
          error: null,
        }),
        challengeAndVerify: async () => ({ error: null }),
        unenroll: m.unenroll,
      },
    },
  }),
}));
vi.mock('@/app/(auth)/login/mfa/totp-attempt', () => ({
  beginTotpAttemptAction: async () => ({ ok: true }),
}));
vi.mock('@/app/(dashboard)/settings/account/two-factor-actions', () => ({
  issueRecoveryCodesAction: m.issue,
}));

import { useTotpEnrolment } from '@/app/(dashboard)/settings/use-totp-enrolment';

async function verifiedWithoutCodes() {
  m.issue.mockResolvedValue({ ok: false, error: 'We could not create your recovery codes.' });
  const hook = renderHook(() => useTotpEnrolment());
  await waitFor(() => expect(hook.result.current.pending).not.toBeNull());
  await act(async () => {
    await hook.result.current.verify('123456');
  });
  expect(hook.result.current.verified).toBe(true);
  expect(hook.result.current.codes).toBeNull();
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTotpEnrolment cancel', () => {
  it('removes a live factor that has no codes, and lets the modal close', async () => {
    m.unenroll.mockResolvedValue({ error: null });
    const hook = await verifiedWithoutCodes();
    let closed = false;
    await act(async () => {
      closed = await hook.result.current.cancel();
    });
    expect(m.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
    expect(closed).toBe(true);
  });

  it('keeps the modal open and explains when that removal fails', async () => {
    m.unenroll.mockResolvedValue({ error: { message: 'AAL2 required' } });
    const hook = await verifiedWithoutCodes();
    let closed = true;
    await act(async () => {
      closed = await hook.result.current.cancel();
    });
    expect(closed).toBe(false);
    expect(hook.result.current.error).toMatch(/on but has no recovery codes/);
  });

  it('treats a thrown removal the same way', async () => {
    m.unenroll.mockRejectedValue(new Error('network'));
    const hook = await verifiedWithoutCodes();
    let closed = true;
    await act(async () => {
      closed = await hook.result.current.cancel();
    });
    expect(closed).toBe(false);
  });

  it('closes even if an UNVERIFIED factor cannot be removed (2FA is not on)', async () => {
    m.unenroll.mockResolvedValue({ error: { message: 'nope' } });
    const hook = renderHook(() => useTotpEnrolment());
    await waitFor(() => expect(hook.result.current.pending).not.toBeNull());
    let closed = false;
    await act(async () => {
      closed = await hook.result.current.cancel();
    });
    expect(closed).toBe(true);
  });
});
