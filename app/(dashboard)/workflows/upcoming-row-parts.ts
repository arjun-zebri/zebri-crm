/**
 * The pure parts of an Upcoming row: its `⋯` menu and its couple line.
 * Split out of `./upcoming-row` to keep it to its size budget, and so
 * the menu's gating is testable without rendering.
 *
 * @module app/(dashboard)/workflows/upcoming-row-parts
 */

import type { QueueItem } from '@/lib/workflows/queue';

/** What the row's menu items call. */
export interface RowActionHandlers {
  onSnooze: (stepId: string, days: number) => void;
  onSkip: (stepId: string) => void;
  onOpenCouple: (coupleId: string) => void;
}

/**
 * The row's `⋯` menu. A send still behind an earlier step (or dated
 * only by projection) gets no snooze: any date on it is one the engine
 * runs on sight, out of order (`lib/workflows/release`). Exported for
 * the tests.
 */
export function rowActions(item: QueueItem, on: RowActionHandlers) {
  const snooze = item.blocked
    ? []
    : [
        { label: 'Tomorrow', onSelect: () => on.onSnooze(item.stepId, 1) },
        { label: 'Next week', onSelect: () => on.onSnooze(item.stepId, 7) },
      ];
  const couple = item.coupleId;
  return [
    ...snooze,
    { label: 'Skip this step', onSelect: () => on.onSkip(item.stepId) },
    ...(couple ? [{ label: 'Open the couple', onSelect: () => on.onOpenCouple(couple) }] : []),
  ];
}

/** "Sam & Priya · 19 Sep" for the row's middle column. */
export function coupleLine(item: QueueItem): string {
  const who = item.coupleName ?? 'My to-dos';
  if (!item.weddingDate) return who;
  // Assembled from parts: `en-AU` renders September as "Sept", which
  // sits a character wider than every other month and makes the column
  // look ragged.
  const parts = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).formatToParts(new Date(`${item.weddingDate}T12:00:00Z`));
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${who} · ${find('day')} ${find('month').slice(0, 3)}`;
}

/**
 * The pill a row shows when a person decides when it runs.
 *
 * Every reason that points at an earlier step ("After you OK “5 Months
 * to GO!”", "Depends on “Paid deposit?”") reads as one short pill; the
 * step it waits on moves to the pill's hover, where it no longer
 * crowds the row. A reason that is about this step itself ("No date
 * set", "Needs a wedding date") is already short, so it stays as is.
 */
export function gatePillLabel(gate: string): string {
  return /^(After|Depends on) /.test(gate) ? 'After previous step' : gate;
}
