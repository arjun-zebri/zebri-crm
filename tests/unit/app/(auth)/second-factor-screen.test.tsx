/**
 * The sign-out on the second-factor screen is always local (Phase 4
 * review, I1). Whoever is on this screen has not proven the second
 * factor, and it is also where support lands if a shadow grant lapses on
 * a 2FA account, so it must never end the account's other sessions.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SecondFactorScreen } from '@/app/(auth)/login/mfa/second-factor-screen';

const signOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: (...a: unknown[]) => signOut(...a) } }),
}));
// The code forms have their own tests; only the sign-out matters here.
vi.mock('@/app/(auth)/login/mfa/totp-code-form', () => ({ TotpCodeForm: () => null }));
vi.mock('@/app/(auth)/login/mfa/recovery-code-form', () => ({ RecoveryCodeForm: () => null }));

const assign = vi.fn();

beforeEach(() => {
  signOut.mockReset();
  signOut.mockResolvedValue({ error: null });
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SecondFactorScreen sign-out', () => {
  it('signs out this browser only, then goes to /login', async () => {
    render(<SecondFactorScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(assign).toHaveBeenCalledWith('/login');
  });
});
