/**
 * Next.js server start-up hook. Runs once per server instance, before
 * any request is handled.
 *
 * @module instrumentation
 */

/**
 * Wire server-side `logger.error` calls to Slack (see
 * `lib/alerts/server-error-transport`). Node runtime only: the edge
 * middleware has no service-role client to look up the account.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { installServerErrorAlerts } = await import('@/lib/alerts/server-error-transport');
  installServerErrorAlerts();
}
