/**
 * Public surface of the alerts module.
 *
 * - `logger` / `Logger` — structured, isomorphic logger; additional log
 *   destinations plug in via `registerTransport`.
 * - `sendAlert(event)` — typed dispatcher for operational/business alerts;
 *   delivers via Slack and via the logger pipeline.
 * - `AlertEvent` — discriminated union of every alert kind (1:1 with the
 *   matrix in `.claude/docs/alerts.md`).
 *
 * @module lib/alerts
 */

export { logger, registerTransport, clearTransports } from './logger';
export type { Logger, LogLevel, LogContext, Transport } from './logger';

export { sendAlert, formatSlackMessage } from './send-alert';
export type { AlertEvent, AlertType, AlertSeverity } from './events';

export { sendSlackAlert } from './slack';
export type { SlackPayload, SlackBlock } from './slack';
