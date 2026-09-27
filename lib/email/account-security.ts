/**
 * Security notices sent to the MC about their own Zebri account.
 *
 * Transactional, from the shared Zebri address, through
 * {@link dispatchEmail} like every other send. No unsubscribe link: a
 * notice that the account's protection changed is not marketing, and an
 * MC must not be able to opt out of hearing that someone signed in as
 * them.
 *
 * Server only.
 *
 * @module lib/email/account-security
 */
import { dispatchEmail, type DispatchResult } from './dispatch';
import { wrapTemplateHtml } from './html';
import { DEFAULT_FROM } from './sender-identity';

/**
 * Body of the "two-factor sign-in was turned off" notice. Carries no
 * user-supplied text at all, so there is nothing to escape.
 */
export function twoFactorRemovedHtml(when: Date): string {
  const stamp = when.toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Australia/Sydney',
  });
  const body = `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">Two-factor sign-in was turned off</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Someone signed in to your Zebri account on ${stamp} (Sydney time) with your password and one of your recovery codes, instead of a code from your authenticator app. Two-factor sign-in is now off.
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            If that was you, turn it back on in Settings, Account, and save the new recovery codes.
          </p>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
            If it was not you, reset your password straight away and reply to this email so we can help.
          </p>`;
  return wrapTemplateHtml(body, 'Zebri');
}

/**
 * Tell the MC that a recovery code switched their two-factor sign-in off
 * (Phase 4, Task 23). Whoever did it held the password, so the account
 * owner has to hear about it, not only Zebri's Slack.
 */
export async function sendTwoFactorRemovedEmail(opts: {
  to: string;
  when?: Date;
}): Promise<DispatchResult> {
  return dispatchEmail(
    { transport: 'resend', from: DEFAULT_FROM },
    {
      to: opts.to,
      subject: 'Two-factor sign-in was turned off on your Zebri account',
      html: twoFactorRemovedHtml(opts.when ?? new Date()),
    },
  );
}
