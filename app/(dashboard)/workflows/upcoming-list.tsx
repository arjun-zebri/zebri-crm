'use client';

/**
 * The day, grouped: a rail of dates down the left and the work beside it.
 *
 * The rail is what makes this readable at a glance. Group headings
 * stacked above their rows push the actual work down the page and make
 * a list of twelve things feel like six sections; put the heading
 * beside the rows and the whole day fits on one screen, with the
 * relationship between "when" and "what" carried by alignment rather
 * than by the MC's short-term memory.
 *
 * Keyboard-first: arrow keys move, Enter opens, E completes. An MC
 * clearing a morning should not have to aim at twelve checkboxes.
 *
 * @module app/(dashboard)/workflows/upcoming-list
 */

import { AlertTriangle, Zap } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { StatePill } from '@/components/ui/state-pill';
import type { QueueItem } from '@/lib/workflows/queue';
import { isAutomated } from '@/lib/workflows/steps';

import { bucketFor, rowDueLabel, type QueueBucket } from './queue-buckets';
import { localToday, type QueueGroupBy } from './queue-grouping';

export interface UpcomingListProps {
  buckets: QueueBucket[];
  timezone: string;
  /** What the rail is grouped by, for the heading tone. */
  groupBy: QueueGroupBy;
  /** Ticks a manual step. */
  onTick: (stepId: string) => void;
  /** Opens the detail modal. */
  onOpen: (stepId: string) => void;
  /** Moves a step's due date on by N days. */
  onSnooze: (stepId: string, days: number) => void;
  /** Drops a step without doing it. */
  onSkip: (stepId: string) => void;
  /** Opens the couple this step belongs to. */
  onOpenCouple: (coupleId: string) => void;
}

/** "Sam & Priya · 19 Sep" for the row's middle column. */
function coupleLine(item: QueueItem): string {
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

/** The grouped list. See {@link UpcomingListProps}. */
export function UpcomingList({
  buckets,
  timezone,
  groupBy,
  onTick,
  onOpen,
  onSnooze,
  onSkip,
  onOpenCouple,
}: UpcomingListProps) {
  // Every row's right-hand label is a date fact ("Mon", "87 days ago"),
  // so it is read off the row's own date band rather than off the rail.
  // Grouped by couple or by handler the rail says nothing about when.
  const todayLocal = localToday(timezone);
  // Flat order for the keyboard, matching what is on screen.
  const flat = useMemo(
    () => buckets.flatMap((bucket) => bucket.items.map((item) => ({ item, bucket }))),
    [buckets],
  );
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clamped during render rather than corrected in an effect: ticking a
  // row shortens the list, and a stale index would let the next Enter
  // open something the MC never selected.
  const active = Math.min(cursor, flat.length - 1);

  function onKeyDown(event: React.KeyboardEvent) {
    const target = event.target as HTMLElement;
    // Never steal a key from the inline add field.
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? active + 1 : active - 1;
      setCursor(Math.max(0, Math.min(flat.length - 1, next)));
      return;
    }
    const selected = flat[active];
    if (!selected) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(selected.item.stepId);
    }
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      if (!isAutomated(selected.item.type)) onTick(selected.item.stepId);
      else onOpen(selected.item.stepId);
    }
  }

  return (
    <div
      ref={containerRef}
      role="list"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="divide-y divide-border focus:outline-none"
    >
      {buckets.map((bucket) => (
        <div key={bucket.key} className="flex">
          <div className="w-24 shrink-0 px-3 py-3 sm:w-44 sm:px-4">
            <p className={`text-body font-semibold ${bucket.urgent ? 'text-danger' : 'text-text'}`}>
              {bucket.label}
            </p>
            {bucket.subtitle ? (
              <p className="text-body text-text-muted">{bucket.subtitle}</p>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 border-l border-border">
            {bucket.items.map((item) => {
              const index = flat.findIndex((row) => row.item.stepId === item.stepId);
              const automated = isAutomated(item.type);
              const errored = item.status === 'errored';
              const band = bucketFor(item, todayLocal, timezone);
              const late = band === 'overdue';
              return (
                // The whole row opens the step. The title button stays for
                // the keyboard and the screen reader; its click bubbles up
                // to this handler rather than duplicating it.
                <div
                  key={item.stepId}
                  role="listitem"
                  onClick={() => {
                    setCursor(index);
                    onOpen(item.stepId);
                  }}
                  className={`group flex cursor-pointer items-center gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:gap-3 sm:px-4 ${
                    index === active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                  }`}
                >
                  {errored ? (
                    <AlertTriangle
                      size={18}
                      strokeWidth={1.5}
                      className="shrink-0 text-danger"
                      aria-label="This step failed"
                    />
                  ) : automated ? (
                    <Zap
                      size={18}
                      strokeWidth={1.5}
                      className="shrink-0 text-text-subtle"
                      aria-label="Runs by itself"
                    />
                  ) : (
                    // Ticking is not opening: swallow the click so the
                    // modal never appears behind a checked box.
                    <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={false}
                        onChange={() => onTick(item.stepId)}
                        ariaLabel={`Mark "${item.title}" done`}
                      />
                    </span>
                  )}

                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  >
                    <span className="min-w-0 truncate text-body text-text">{item.title}</span>
                    {/* A ⚡ says "Zebri runs this", which is the opposite
                        of what a held send needs the MC to know. The
                        pill says whose move it is. */}
                    {item.requiresApproval ? (
                      <StatePill
                        label="Needs your OK"
                        tone="warning"
                        dot="hollow"
                        className="shrink-0"
                      />
                    ) : null}
                  </button>

                  {/* Redundant when the rail is already the couple's
                      name, and a repeated name down a column is what
                      makes a grouped list hard to scan. */}
                  {groupBy === 'couple' ? null : (
                    <span className="hidden shrink-0 text-body text-text-muted sm:inline">
                      {coupleLine(item)}
                    </span>
                  )}

                  <span
                    className={`shrink-0 whitespace-nowrap text-right text-body sm:w-20 ${
                      late ? 'text-danger' : 'text-text-muted'
                    }`}
                  >
                    {rowDueLabel(item, band, timezone)}
                  </span>

                  <RowActionsMenu
                    size="sm"
                    alwaysVisible
                    actions={[
                      { label: 'Tomorrow', onSelect: () => onSnooze(item.stepId, 1) },
                      { label: 'Next week', onSelect: () => onSnooze(item.stepId, 7) },
                      { label: 'Skip this step', onSelect: () => onSkip(item.stepId) },
                      ...(item.coupleId
                        ? [
                            {
                              label: 'Open the couple',
                              onSelect: () => onOpenCouple(item.coupleId as string),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
