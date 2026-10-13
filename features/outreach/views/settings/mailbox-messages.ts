/**
 * Messages for the result of the Gmail OAuth round trip.
 *
 * The callback redirects back to Settings with `?mailbox=<code>`. Each
 * code means something different to the founder, so each gets its own
 * sentence. Unknown codes return null and show nothing.
 *
 * @module features/outreach/views/settings/mailbox-messages
 */

/** What to show after a mailbox redirect. */
export interface MailboxMessage {
  type: 'success' | 'error';
  message: string;
}

/**
 * @param code - The `mailbox` query value, or null.
 * @returns The toast to show, or null when there is nothing to say.
 */
export function mailboxMessage(code: string | null): MailboxMessage | null {
  switch (code) {
    case 'connected':
      return { type: 'success', message: 'Gmail connected' };
    case 'denied':
      return { type: 'error', message: 'Google access was declined' };
    case 'missing_scope':
      return { type: 'error', message: 'Please allow both send and read access' };
    // Google only sends a refresh token on first consent, so a re-connect
    // without revoking the old grant comes back without one.
    case 'no_refresh_token':
      return {
        type: 'error',
        message:
          "Google didn't return a refresh token. Remove Zebri Outreach from your Google account's third-party access, then connect again.",
      };
    case 'not_configured':
      return { type: 'error', message: "Gmail is not set up on the server yet. Add the Google OAuth client in Vercel." };
    case 'error':
      return { type: 'error', message: "Couldn't connect Gmail. Try again." };
    default:
      return null;
  }
}
