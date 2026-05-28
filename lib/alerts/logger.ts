/**
 * Structured logger.
 *
 * Replaces ad-hoc `console.*` calls across the codebase (the 0.4 `no-console`
 * lint warning is ratcheted down per-page as each module migrates here).
 *
 * Design constraints:
 * - **Isomorphic** — works in client / server / edge runtimes. No Node-only
 *   APIs, no dynamic imports of heavy SDKs at module top-level.
 * - **Always writes to `console`** so developers see logs locally and
 *   **Vercel runtime logs** capture them in production. Any additional
 *   destination (custom logging service, future error tracker) plugs in
 *   via {@link registerTransport}.
 * - **Strict-typed `context`** (`unknown` payloads, not `any`) so callers
 *   can't accidentally pass PII without thinking about it.
 *
 * @example
 * ```ts
 * import { logger } from '@/lib/alerts/logger'
 *
 * logger.info('quote sent', { quoteId, recipient })
 *
 * try { ... } catch (err) {
 *   logger.error('quote send failed', err, { quoteId })
 * }
 *
 * // Child loggers carry a stable context across nested calls.
 * const flow = logger.child({ flow: 'invoice.markPaid', invoiceId })
 * flow.info('charging stripe')
 * flow.info('updating invoice row')
 * ```
 *
 * @module lib/alerts/logger
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Free-form structured context. Keep payloads PII-safe. */
export type LogContext = Record<string, unknown>;

/** A log transport receives every record. Register via {@link registerTransport}. */
export type Transport = (
  level: LogLevel,
  message: string,
  context: LogContext,
  error?: unknown,
) => void;

const transports: Transport[] = [];

/** Subscribe to log records (e.g. forward to a hosted logger). Returns an unsubscribe fn. */
export function registerTransport(t: Transport): () => void {
  transports.push(t);
  return () => {
    const i = transports.indexOf(t);
    if (i >= 0) transports.splice(i, 1);
  };
}

/** Test helper: clear all non-default transports. */
export function clearTransports(): void {
  transports.length = 0;
}

function consoleWrite(
  level: LogLevel,
  message: string,
  context: LogContext,
  error?: unknown,
): void {
  const hasCtx = Object.keys(context).length > 0;
  const tag = `[${level}]`;
  // eslint-disable-next-line no-console -- the logger is the sanctioned home for console writes.
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (error !== undefined && hasCtx) out(tag, message, error, context);
  else if (error !== undefined) out(tag, message, error);
  else if (hasCtx) out(tag, message, context);
  else out(tag, message);
}

function emit(level: LogLevel, message: string, context: LogContext, error?: unknown): void {
  consoleWrite(level, message, context, error);
  for (const t of transports) t(level, message, context, error);
}

/** The {@link Logger} interface — implemented by the default export and child loggers. */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  /** `error` is the underlying exception (any value — `unknown`). */
  error(message: string, error?: unknown, context?: LogContext): void;
  /** Returns a logger that merges `defaults` into every record's context. */
  child(defaults: LogContext): Logger;
}

function make(defaults: LogContext): Logger {
  const merge = (ctx?: LogContext): LogContext => (ctx ? { ...defaults, ...ctx } : defaults);
  return {
    debug: (m, c) => emit('debug', m, merge(c)),
    info: (m, c) => emit('info', m, merge(c)),
    warn: (m, c) => emit('warn', m, merge(c)),
    error: (m, err, c) => emit('error', m, merge(c), err),
    child: (more) => make({ ...defaults, ...more }),
  };
}

/** Default logger. Prefer `logger.child({...})` over passing repetitive context. */
export const logger: Logger = make({});
