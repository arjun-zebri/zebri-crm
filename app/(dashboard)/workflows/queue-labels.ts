/**
 * How a queue row states its due date.
 *
 * Relative wording ("3 days ago", "Tomorrow") rather than a raw date:
 * the queue is read at a glance, and "overdue by how long" is the thing
 * the MC is actually judging.
 *
 * @module app/(dashboard)/workflows/queue-labels
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { QueueItem } from '@/lib/workflows/queue';

/**
 * Local 9am, `days` from now, as an ISO instant.
 *
 * The snooze target. 9am rather than midnight because a step pushed to
 * "tomorrow" should land at the start of the working day, not at an
 * hour when nobody is reading anything.
 */
export function inDays(days: number): string {
  const at = new Date();
  at.setDate(at.getDate() + days);
  at.setHours(9, 0, 0, 0);
  return at.toISOString();
}

/** Whole days between two `YYYY-MM-DD` strings. */
function dayDelta(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

/**
 * The due-date label for one queue item, in the MC's timezone.
 *
 * @param item - the queue row
 * @param timezone - IANA zone the local dates are resolved in
 * @param now - injectable for tests
 */
export function dueLabelFor(
  item: QueueItem,
  timezone: string,
  now: Date = new Date(),
): string {
  if (item.status === 'errored') return 'Failed';
  if (item.dueAt === null) return 'No date';

  const today = zonedDateParts(now, timezone).date;
  const due = zonedDateParts(new Date(item.dueAt), timezone).date;
  const delta = dayDelta(today, due);

  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta < 0) return `${Math.abs(delta)} days ago`;
  if (delta < 7) return `In ${delta} days`;
  if (delta < 14) return 'Next week';
  return due;
}
