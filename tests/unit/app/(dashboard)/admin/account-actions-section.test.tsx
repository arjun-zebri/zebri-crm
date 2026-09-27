/**
 * `AccountActionsSection`'s "Enter shadow mode" button.
 *
 * `enterShadow()` redirects to "/" on success, which Next.js implements by
 * throwing an internal `NEXT_REDIRECT` marker error. The regression this
 * guards: that marker must never reach the user as a "Failed to enter
 * shadow mode" toast, and entering shadow must force a hard navigation
 * (`window.location.assign`) rather than let Next's own soft redirect run,
 * because /admin and / share the (dashboard) layout, and a soft redirect would
 * leave Sidebar/ShadowBanner (which read identity once on mount) still
 * showing the admin's own identity with no shadow banner.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AccountActionsSection } from '@/app/(dashboard)/admin/components/account-actions-section';
import type { AdminUser } from '@/lib/admin/admin-analytics';

const toastMock = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const enterShadowMock = vi.fn();
vi.mock('@/app/admin/actions', () => ({
  deleteUser: vi.fn(),
  enterShadow: (...args: unknown[]) => enterShadowMock(...args),
  sendPasswordReset: vi.fn(),
}));

/**
 * A real `NEXT_REDIRECT` digest, shaped exactly like the one
 * `next/dist/client/components/redirect.js`'s `getRedirectError` produces:
 * `${REDIRECT_ERROR_CODE};${type};${url};${statusCode};`. Building it by
 * hand (rather than calling `redirect()` itself) keeps the test from
 * depending on Next's action-context internals under jsdom.
 */
function makeRedirectError(url = '/'): Error & { digest: string } {
  const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
  error.digest = `NEXT_REDIRECT;replace;${url};307;`;
  return error;
}

const user: AdminUser = {
  id: 'target-user-id',
  email: 'mc@example.com',
  display_name: 'Test MC',
  business_name: '',
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  trial_end: null,
  subscription_end: null,
  cancel_at_period_end: false,
  is_subscribed: true,
  is_beta_user: false,
  is_comped: false,
  created_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: null,
  last_seen_at: null,
};

describe('AccountActionsSection, Enter shadow mode', () => {
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    assignMock = vi.fn();
    // jsdom's window.location is not configurable by default; replace it
    // wholesale so `window.location.assign` can be asserted on, following
    // the same pattern as tests/unit/app/branding/preview-page.test.tsx.
    Object.defineProperty(window, 'location', {
      value: { assign: assignMock },
      writable: true,
    });
  });

  it('hard-navigates to "/" and shows no toast when enterShadow redirects', async () => {
    enterShadowMock.mockRejectedValue(makeRedirectError('/'));

    render(<AccountActionsSection user={user} onClose={vi.fn()} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enter shadow mode' }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/'));
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('still shows an error toast for a real failure, and never navigates', async () => {
    enterShadowMock.mockRejectedValue(new Error('Turn on two-factor sign-in first.'));

    render(<AccountActionsSection user={user} onClose={vi.fn()} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enter shadow mode' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('Turn on two-factor sign-in first.', 'error'),
    );
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('shows the refusal toast in place, without navigating, when enterShadow resolves with an error', async () => {
    enterShadowMock.mockResolvedValue({ error: 'Cannot shadow yourself' });

    render(<AccountActionsSection user={user} onClose={vi.fn()} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enter shadow mode' }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Cannot shadow yourself', 'error'));
    expect(assignMock).not.toHaveBeenCalled();
  });
});
