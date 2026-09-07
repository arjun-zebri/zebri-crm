/**
 * How the Upcoming list is grouped, and what each row says on the right.
 *
 * One flat list of everything, cut into date bands: Overdue, Today,
 * Tomorrow, and so on. This replaced five separate sections (held
 * sends, overdue, due today, coming up, sending by itself) because
 * those were five answers to a question the MC was not asking. The
 * question is "what is happening, and when", and the answer is a
 * calendar-shaped list where the automated steps sit in the day they
 * will run rather than in a box of their own.
 *
 * The right-hand label changes with the band on purpose. Within today,
 * the useful fact is the time; within the next fortnight, it is the
 * weekday; beyond that, the date; and for anything overdue, how long it
 * has been sitting there.
 *
 * Pure module, so every boundary is testable without a database.
 *
 * @module app/(dashboard)/workflows/queue-buckets
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { QueueItem, QueueResult } from '@/lib/workflows/queue';

/** The bands, in the order they render. */
export type BucketKey =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'next_week'
  | 'later'
  | 'undated';

/**
 * One rendered group: its rail heading and the rows under it.
 *
 * The key is a plain string rather than a {@link BucketKey} because the
 * MC chooses what the rail groups by: dates here, couple ids or
 * `you` / `zebri` in {@link groupQueueItems}.
 */
export interface QueueBucket {
  key: string;
  /** Rail heading, e.g. "Overdue". */
  label: string;
  /** Second rail line, e.g. "Fri 5 Sep". Absent when it adds nothing. */
  subtitle?: string;
  /** Overdue reads in the danger tone; nothing else does. */
  urgent: boolean;
  items: QueueItem[];
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
 * "Fri 5 Sep" for a `YYYY-MM-DD` in the MC's zone.
 *
 * Assembled from parts rather than taken from `toLocaleDateString`,
 * which renders `en-AU` as "Fri, 5 Sept": the comma and the four-letter
 * month are noise in a column this narrow, and "Sept" beside "Nov" and
 * "Dec" makes a rail of dates look ragged.
 */
export function railDate(date: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(new Date(`${date}T12:00:00Z`));

  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${find('weekday')} ${find('day')} ${find('month').slice(0, 3)}`;
}

/** Which band an item falls in. Exported for the tests. */
export function bucketFor(item: QueueItem, todayLocal: string, timezone: string): BucketKey {
  // A failure is the MC's most urgent problem whatever date it carries.
  if (item.status === 'errored') return 'overdue';
  if (item.dueAt === null) return 'undated';

  const delta = dayDelta(todayLocal, zonedDateParts(new Date(item.dueAt), timezone).date);
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  if (delta < 7) return 'this_week';
  if (delta < 14) return 'next_week';
  return 'later';
}

const ORDER: BucketKey[] = [
  'overdue',
  'today',
  'tomorrow',
  'this_week',
  'next_week',
  'later',
  'undated',
];

const LABELS: Record<BucketKey, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This week',
  next_week: 'Next week',
  later: 'Later',
  undated: 'No date',
};

/** Flatten every group the loader returns into one list. */
export function flattenQueue(result: QueueResult): QueueItem[] {
  return [
    ...result.review,
    ...result.overdue,
    ...result.today,
    ...result.upcoming,
    ...result.sendingToday,
  ];
}

/**
 * Cut the day into its bands.
 *
 * Empty bands are dropped. A rail heading with nothing beside it reads
 * as a loading state, and with a filter applied it reads as a bug.
 *
 * @param items - every item, in any order
 * @param timezone - the MC's IANA zone
 * @param now - injectable for tests
 */
export function bucketQueueItems(
  items: QueueItem[],
  timezone: string,
  now: Date = new Date(),
): QueueBucket[] {
  const todayLocal = zonedDateParts(now, timezone).date;
  const groups = new Map<BucketKey, QueueItem[]>();

  for (const item of items) {
    const key = bucketFor(item, todayLocal, timezone);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const byDue = (a: QueueItem, b: QueueItem): number => {
    if (a.dueAt === null && b.dueAt === null) return 0;
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt.localeCompare(b.dueAt);
  };

  return ORDER.filter((key) => (groups.get(key) ?? []).length > 0).map((key) => ({
    key,
    label: LABELS[key],
    // Only Today gets a date under it: it is the one heading whose
    // meaning depends on which day the MC is reading it.
    ...(key === 'today' ? { subtitle: railDate(todayLocal, timezone) } : {}),
    urgent: key === 'overdue',
    items: (groups.get(key) ?? []).sort(byDue),
  }));
}

/**
 * The right-hand label for one row, given its band.
 *
 * @param item - the row
 * @param bucket - which band it landed in
 * @param timezone - the MC's IANA zone
 * @param now - injectable for tests
 */
export function rowDueLabel(
  item: QueueItem,
  bucket: BucketKey,
  timezone: string,
  now: Date = new Date(),
): string {
  if (item.status === 'errored') return 'Failed';
  if (item.dueAt === null) return '';

  const due = new Date(item.dueAt);
  const todayLocal = zonedDateParts(now, timezone).date;
  const dueLocal = zonedDateParts(due, timezone).date;

  if (bucket === 'overdue') {
    const behind = Math.abs(dayDelta(todayLocal, dueLocal));
    if (behind === 0) return 'Earlier today';
    if (behind === 1) return 'Yesterday';
    return `${behind} days ago`;
  }

  if (bucket === 'today') {
    return due
      .toLocaleTimeString('en-AU', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .replace(/\s/g, '')
      .toLowerCase();
  }

  if (bucket === 'later') return railDate(dueLocal, timezone);

  // Tomorrow and the next fortnight: the weekday is what an MC plans
  // against, and the date adds nothing they cannot work out.
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone,
    weekday: 'short',
  }).format(due);
}
