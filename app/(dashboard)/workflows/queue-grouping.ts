/**
 * How the Upcoming list is grouped: the MC's choice, not a filter.
 *
 * This started as a filter, and a filter was the wrong control. Hiding
 * rows to answer "what is Zebri doing for me this week" means the list
 * is then wrong in a way the MC has to remember; regrouping the same
 * rows answers the question and keeps everything on screen. So the one
 * toolbar control reorders the rail instead of narrowing the list, and
 * every grouping shows every step.
 *
 * Three groupings, because there are three questions an MC asks of the
 * same list: when is it happening, whose wedding is it, and am I doing
 * it or is Zebri.
 *
 * Pure module, so every boundary is testable without a database.
 *
 * @module app/(dashboard)/workflows/queue-grouping
 */

import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { QueueItem } from '@/lib/workflows/queue';
import { isAutomated } from '@/lib/workflows/steps';
import type { StepType } from '@/types/workflows';

import { bucketQueueItems, railDate, type QueueBucket } from './queue-buckets';

/** What the rail groups by. */
export type QueueGroupBy = 'date' | 'couple' | 'handler';

/** The menu, in order. */
export const GROUP_BY_OPTIONS: { value: QueueGroupBy; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'couple', label: 'Couple' },
  // Not "manual vs automatic": the MC does not think of their work as
  // manual, they think of it as theirs. "Who does it" also survives the
  // button label ("Group by who does it"), which "Handled by" did not.
  // The two groups under it are "You" and "Zebri".
  { value: 'handler', label: 'Who does it' },
];

/** Dates, the view the page opens on. */
export const DEFAULT_GROUP_BY: QueueGroupBy = 'date';

/** The button's label, e.g. "Group by date". */
export function groupByLabel(groupBy: QueueGroupBy): string {
  const option = GROUP_BY_OPTIONS.find((o) => o.value === groupBy);
  return `Group by ${(option?.label ?? 'Date').toLowerCase()}`;
}

/** Soonest first, undated last. */
function byDue(a: QueueItem, b: QueueItem): number {
  if (a.dueAt === null && b.dueAt === null) return 0;
  if (a.dueAt === null) return 1;
  if (b.dueAt === null) return -1;
  return a.dueAt.localeCompare(b.dueAt);
}

/** The MC's own to-dos, which belong to no couple. */
const PERSONAL_KEY = 'personal';

/** Group by couple, weddings soonest first. */
function groupByCouple(items: QueueItem[], timezone: string): QueueBucket[] {
  const groups = new Map<string, QueueItem[]>();
  for (const item of items) {
    const key = item.coupleId ?? PERSONAL_KEY;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  // Kept beside the bucket rather than on it: the wedding date decides
  // the order but is not part of the rendered group.
  const weddingDates = new Map<string, string | null>();

  const buckets: QueueBucket[] = [...groups.entries()].map(([key, list]) => {
    const first = list[0];
    const weddingDate = first?.weddingDate ?? null;
    weddingDates.set(key, weddingDate);
    return {
      key,
      label: key === PERSONAL_KEY ? 'My to-dos' : (first?.coupleName ?? 'Unnamed couple'),
      // The wedding date is the fact that decides how urgent a couple's
      // list is, so it goes on the rail beside their name.
      ...(weddingDate ? { subtitle: railDate(weddingDate, timezone) } : {}),
      urgent: false,
      items: [...list].sort(byDue),
    };
  });

  return buckets.sort((a, b) => {
    // The MC's own list last: it is theirs, not a wedding, and it has no
    // date to sort against.
    if (a.key === PERSONAL_KEY) return 1;
    if (b.key === PERSONAL_KEY) return -1;
    // Then the nearest wedding first, since that is the one whose steps
    // cannot slip. Couples with no date sit behind those that have one,
    // alphabetically.
    const aDate = weddingDates.get(a.key) ?? null;
    const bDate = weddingDates.get(b.key) ?? null;
    if (aDate && bDate) return aDate.localeCompare(bDate);
    if (aDate) return -1;
    if (bDate) return 1;
    return a.label.localeCompare(b.label);
  });
}

/** Group by who does the work: the MC, or the engine. */
function groupByHandler(items: QueueItem[]): QueueBucket[] {
  const you: QueueItem[] = [];
  const zebri: QueueItem[] = [];
  for (const item of items) {
    if (isAutomated(item.type as StepType)) zebri.push(item);
    else you.push(item);
  }

  // The MC's own work first: it is the half that will not happen unless
  // they do it.
  return [
    { key: 'you', label: 'You', urgent: false, items: you.sort(byDue) },
    {
      key: 'zebri',
      label: 'Zebri',
      subtitle: 'Runs by itself',
      urgent: false,
      items: zebri.sort(byDue),
    },
  ].filter((bucket) => bucket.items.length > 0);
}

/**
 * Cut the list into rail groups.
 *
 * Empty groups are dropped in every grouping (except the date
 * grouping's Today, which carries the inline add row). A rail heading
 * with nothing beside it reads as a loading state.
 *
 * @param items - every item, in any order
 * @param groupBy - the MC's choice
 * @param timezone - the MC's IANA zone
 * @param now - injectable for tests
 */
export function groupQueueItems(
  items: QueueItem[],
  groupBy: QueueGroupBy,
  timezone: string,
  now: Date = new Date(),
): QueueBucket[] {
  if (groupBy === 'couple') return groupByCouple(items, timezone);
  if (groupBy === 'handler') return groupByHandler(items);
  return bucketQueueItems(items, timezone, now);
}

/**
 * Cut the done list into the days the MC ticked things.
 *
 * Newest first, because the useful question about finished work is
 * "what did I just do", not "what did I do in July". Undated rows are
 * impossible here (`completed_at` is stamped by the executor), but a
 * legacy row without one still gets a home rather than vanishing.
 *
 * @param items - done and skipped steps, in any order
 * @param timezone - the MC's IANA zone
 * @param now - injectable for tests
 */
export function groupDoneItems(
  items: QueueItem[],
  timezone: string,
  now: Date = new Date(),
): QueueBucket[] {
  const todayLocal = zonedDateParts(now, timezone).date;
  const yesterdayLocal = zonedDateParts(new Date(now.getTime() - 86_400_000), timezone).date;

  const groups = new Map<string, QueueItem[]>();
  for (const item of items) {
    const day = item.completedAt
      ? zonedDateParts(new Date(item.completedAt), timezone).date
      : 'undated';
    const list = groups.get(day);
    if (list) list.push(item);
    else groups.set(day, [item]);
  }

  const label = (day: string): string => {
    if (day === 'undated') return 'Earlier';
    if (day === todayLocal) return 'Today';
    if (day === yesterdayLocal) return 'Yesterday';
    return railDate(day, timezone);
  };

  return [...groups.entries()]
    .sort((a, b) => {
      // Undated last; everything else newest day first.
      if (a[0] === 'undated') return 1;
      if (b[0] === 'undated') return -1;
      return b[0].localeCompare(a[0]);
    })
    .map(([day, list]) => ({
      key: day,
      label: label(day),
      urgent: false,
      items: [...list].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    }));
}

/** Today in the MC's zone, for the per-row due labels. */
export function localToday(timezone: string, now: Date = new Date()): string {
  return zonedDateParts(now, timezone).date;
}
