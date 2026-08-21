/**
 * Build the OAuth authorize URL for a calendar connection.
 *
 * One place constructs this so no call site can drift on `purpose` (which
 * decides whether tokens land in `calendar_connections` or
 * `user_public_settings`) or forget `return`, which is what brings the MC back
 * to the page they started from.
 *
 * @module components/calendar/connect-url
 */

/** Allowlisted post-consent destinations, mirroring `OAuthReturnTo`. */
export type CalendarConnectReturnTo = 'settings' | 'calendar';

/**
 * Authorize URL for `provider`, returning to `returnTo` after consent.
 *
 * @param provider - the calendar provider to connect
 * @param returnTo - which page the callback should redirect back to
 */
export function calendarConnectUrl(
  provider: 'google' | 'microsoft',
  returnTo: CalendarConnectReturnTo,
): string {
  return `/api/oauth/authorize?provider=${provider}&purpose=calendar&return=${returnTo}`;
}
