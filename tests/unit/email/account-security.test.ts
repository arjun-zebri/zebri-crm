// @vitest-environment node
/**
 * The "two-factor sign-in was turned off" notice (Task 23 review, M4):
 * goes through the one dispatch path, transactional (no unsubscribe), to
 * the MC's own address, and says what to do either way.
 */
import { describe, expect, it, vi } from 'vitest';

const dispatchEmail = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock('@/lib/email/dispatch', () => ({ dispatchEmail }));

import { sendTwoFactorRemovedEmail, twoFactorRemovedHtml } from '@/lib/email/account-security';

describe('sendTwoFactorRemovedEmail', () => {
  it('sends one transactional notice from the shared address', async () => {
    await sendTwoFactorRemovedEmail({ to: 'mc@example.com', when: new Date('2026-09-24T02:00:00Z') });
    expect(dispatchEmail).toHaveBeenCalledTimes(1);
    const [sender, payload] = dispatchEmail.mock.calls[0] as unknown as [
      { transport: string },
      { to: string; subject: string; html: string; unsubscribeUrl?: string },
    ];
    expect(sender.transport).toBe('resend');
    expect(payload.to).toBe('mc@example.com');
    expect(payload.subject).toMatch(/Two-factor sign-in was turned off/);
    expect(payload.unsubscribeUrl).toBeUndefined();
  });

  it('tells the MC what to do if it was them and if it was not', () => {
    const html = twoFactorRemovedHtml(new Date('2026-09-24T02:00:00Z'));
    expect(html).toContain('turn it back on in Settings');
    expect(html).toContain('reset your password');
    expect(html).toContain('24 Sept 2026');
  });
});
