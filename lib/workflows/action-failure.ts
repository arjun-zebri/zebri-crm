/**
 * Turning a thrown error into the message a server action returns.
 *
 * Task 36 made the engine's reads throw rather than read as "nothing
 * there". A server action that lets a throw escape reaches the MC as
 * Next's generic "An error occurred in the Server Components render"
 * text in a production build, or as nothing where the caller has no
 * `onError` (review I2). Every step action catches at its boundary and
 * returns `{ ok: false, error: actionFailureMessage(err, source) }`.
 *
 * @module lib/workflows/action-failure
 */

import { sendAlert } from '@/lib/alerts/send-alert';

import { describeFailure, isWorkflowReadError } from './read-failure';

/** What the MC reads when something failed that Zebri did not expect. */
export const UNEXPECTED_FAILURE = 'Something went wrong. Try again in a moment.';

/**
 * The readable message for a failed action, and the log line and alert
 * behind it.
 *
 * A `WorkflowReadError` already carries an MC-facing message (a plain
 * "could not reach the database", or a step-specific one such as "It may
 * or may not have sent"), so that is returned as it is. The engine's
 * failed-read alerts already cover a database that is down, so it is only
 * logged here. Anything else is a bug: it is alerted as `app_error` with
 * the action's name, and the MC gets {@link UNEXPECTED_FAILURE}, never the
 * raw message.
 *
 * @param err - what the action caught
 * @param source - the action's name, for the log and the alert
 */
export function actionFailureMessage(err: unknown, source: string): string {
  console.error(`[workflows] ${source} failed`, describeFailure(err));
  if (isWorkflowReadError(err)) return err.message;
  void sendAlert({
    type: 'app_error',
    severity: 'error',
    source,
    message: describeFailure(err),
  });
  return UNEXPECTED_FAILURE;
}
