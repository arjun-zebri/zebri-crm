/**
 * A database statement the engine acts on could not be read.
 *
 * The tick used to destructure only `data` from most of its reads, so a
 * failed read came back as an empty answer: no stuck steps, no instance,
 * no templates, no wedding date. The pass then reported a clean run that
 * had done nothing, or acted on the wrong answer (audit M4, Task 36).
 * {@link loadDueSteps} was the first read fixed that way, after a
 * swallowed error halted every tenant behind a healthy heartbeat.
 *
 * Every such read now throws this error instead. It is a class, not a
 * plain `Error`, so the callers that must tell "the database did not
 * answer" apart from "this step or event is bad" can: the executor
 * counts it as a failed read and leaves the step due, the dispatcher
 * leaves the event unprocessed for the next tick, and the tick alerts on
 * both. A plain error from a bad row keeps its old handling.
 *
 * The same class covers a guarded write whose returned rows the engine
 * reads (a claim, a completion): an error there is not "somebody else
 * won the race", and treating it that way hid it the same way.
 *
 * @module lib/workflows/read-failure
 */

/** What PostgREST reports on a failed statement; only these fields are read. */
interface DbError {
  message: string;
  code?: string | null;
}

/**
 * The message a failed read carries by default. It is what the MC reads:
 * it can land on a step as its error, or come back from a server action,
 * so it says what happened in their terms. The database's own text stays
 * on {@link WorkflowReadError.dbMessage}, for logs and alerts only.
 */
export const DB_UNREACHABLE = 'Zebri could not reach the database. Try again in a moment.';

/**
 * The message for a read of what a step needs before it runs (the couple,
 * the MC, the invoice): nothing has been sent at that point, and saying
 * so tells the MC a retry cannot double-send.
 */
export const CONTEXT_UNREADABLE =
  'Zebri could not read the details this step needs, so nothing was sent. Try again.';

/** A read (or a guarded write's returned rows) the engine depends on failed. */
export class WorkflowReadError extends Error {
  /** Which read failed, e.g. `executor.load_instance`. Safe for Slack. */
  readonly site: string;
  /** The database or PostgREST error code, or null. */
  readonly code: string | null;
  /** The database's own message. For logs and alerts, never the MC. */
  readonly dbMessage: string;

  /**
   * @param site - which read failed, in `module.read` form
   * @param error - the database error the read returned
   * @param message - what the MC is told (a step's error, an action's
   *   refusal); defaults to {@link DB_UNREACHABLE}
   */
  constructor(site: string, error: DbError, message?: string) {
    super(message ?? DB_UNREACHABLE);
    this.name = 'WorkflowReadError';
    this.site = site;
    this.code = error.code ?? null;
    this.dbMessage = error.message;
  }
}

/**
 * One line for a log or an alert: the site, the code and the database's
 * message for a {@link WorkflowReadError}, the plain message otherwise.
 */
export function describeFailure(err: unknown): string {
  if (err instanceof WorkflowReadError) {
    return `${err.site}${err.code ? ` (${err.code})` : ''}: ${err.dbMessage}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** True when `err` is a {@link WorkflowReadError}. */
export function isWorkflowReadError(err: unknown): err is WorkflowReadError {
  return err instanceof WorkflowReadError;
}

/**
 * Throw a {@link WorkflowReadError} when `error` is set; otherwise do
 * nothing. The one-line guard every engine read uses after its query.
 *
 * @param site - which read this is
 * @param error - the query's `error`, null or undefined when it worked
 * @param message - optional MC-facing message (see the constructor)
 */
export function throwIfReadFailed(
  site: string,
  error: DbError | null | undefined,
  message?: string,
): asserts error is null | undefined {
  if (error) throw new WorkflowReadError(site, error, message);
}
