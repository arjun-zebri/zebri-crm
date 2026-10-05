/**
 * Forwards every server-side `logger.error` to Slack as a `server_error`
 * alert, carrying the real cause.
 *
 * Server actions and routes return a friendly message to the browser
 * ("Could not delete couple.") and log the actual error. Before this, the
 * log line went only to Vercel and Slack got the friendly text, so an
 * alert could never say what broke. A couple delete that failed on an
 * `automation_events` foreign key looked identical to a network blip.
 *
 * Installed once per Node server instance from `instrumentation.ts`.
 * Never installed in the browser or in tests.
 *
 * @module lib/alerts/server-error-transport
 */

import { after } from 'next/server';

import { describeBuild, errorFields, sydneyTime } from './error-report';
import type { AlertEvent } from './events';
import { registerTransport, type LogContext, type Transport } from './logger';
import { sendAlert } from './send-alert';
import { slackSuppressed } from './slack';

/**
 * Same source + same error inside this window posts once. A failing
 * cron or a retry loop otherwise floods the channel with one line per
 * minute. Per server instance, so a burst spread over several cold
 * starts can still post a few times. That is acceptable: it stays
 * readable and nothing is lost.
 */
export const SERVER_ERROR_DEDUPE_MS = 10 * 60_000;

/** Bound on the dedupe map so a storm of distinct errors cannot grow it forever. */
const MAX_TRACKED = 500;

/** A context key is forwarded only if it names an id: `id`, `coupleId`, `step_id`. */
const ID_KEY_RE = /(^id$|Id$|_id$)/;

/**
 * Logs the alert layer writes about itself (`alert: <type>` from
 * `sendAlert`, the dev-suppression note). Forwarding those would post
 * every error alert twice, or loop.
 */
const SELF_PREFIX_RE = /^alert[: ]/;

/** Injected so tests can drive the transport without Slack or Supabase. */
export interface ServerErrorTransportDeps {
  send: (event: AlertEvent) => Promise<unknown>;
  lookupEmail: (userId: string) => Promise<string | undefined>;
  /** Runs the async send. Production defers it past the response with `after()`. */
  schedule: (task: () => Promise<void>) => void;
  now: () => number;
  suppressed: () => boolean;
}

/** Record ids from a log context. Values that are not short scalars are dropped. */
export function idsFromContext(context: LogContext): Record<string, string> {
  const ids: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (key === 'userId' || !ID_KEY_RE.test(key)) continue;
    if (typeof value === 'string' && value.length > 0 && value.length <= 64) ids[key] = value;
    else if (typeof value === 'number') ids[key] = String(value);
  }
  return ids;
}

/** Build the transport. Exported for tests; production uses {@link installServerErrorAlerts}. */
export function createServerErrorTransport(deps: ServerErrorTransportDeps): Transport {
  const lastSent = new Map<string, number>();

  return (level, message, context, error) => {
    if (level !== 'error' || SELF_PREFIX_RE.test(message)) return;
    // Locally Slack is off anyway. Skipping here also avoids printing
    // every error twice (once by the caller, once by sendAlert's log).
    if (deps.suppressed()) return;

    const fields = errorFields(error ?? context.error);
    const key = `${message}|${fields.code ?? ''}|${fields.message}`;
    const now = deps.now();
    const previous = lastSent.get(key);
    if (previous !== undefined && now - previous < SERVER_ERROR_DEDUPE_MS) return;
    if (lastSent.size >= MAX_TRACKED) lastSent.clear();
    lastSent.set(key, now);

    const userId = typeof context.userId === 'string' ? context.userId : undefined;
    const ids = idsFromContext(context);

    deps.schedule(async () => {
      try {
        const account = userId ? await deps.lookupEmail(userId) : undefined;
        await deps.send({
          type: 'server_error',
          severity: 'error',
          source: message,
          ...fields,
          ...(account ? { account } : {}),
          ...(userId ? { userId } : {}),
          ids,
          build: describeBuild(),
          at: sydneyTime(new Date(now)),
        });
      } catch {
        // An alert that cannot be sent must never become the caller's
        // failure, and logging it here would re-enter this transport.
      }
    });
  };
}

/** The MC's login email, via the service role. Undefined if it cannot be read. */
async function lookupEmail(userId: string): Promise<string | undefined> {
  // Imported lazily: the admin client pulls in the service-role env, which
  // only exists on the server, and only the first error needs it.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return data.user?.email ?? undefined;
}

/**
 * Run the send after the response is flushed when inside a request (so a
 * failing action is not slowed by Slack, and Vercel keeps the function
 * alive until it finishes). `after()` throws outside a request scope,
 * e.g. during module init, so fall back to fire-and-forget there.
 */
function schedule(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

let installed = false;

/** Register the transport once for this server instance. Idempotent. */
export function installServerErrorAlerts(): void {
  if (installed) return;
  installed = true;
  registerTransport(
    createServerErrorTransport({
      send: sendAlert,
      lookupEmail,
      schedule,
      now: Date.now,
      suppressed: slackSuppressed,
    }),
  );
}
