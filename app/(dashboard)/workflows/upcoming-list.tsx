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

import { useMemo, useRef, useState } from 'react';

import { isAutomated } from '@/lib/workflows/steps';

import { bucketFor, type QueueBucket } from './queue-buckets';
import { localToday, type QueueGroupBy } from './queue-grouping';
import { UpcomingRow } from './upcoming-row';

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
              return (
                <UpcomingRow
                  key={item.stepId}
                  item={item}
                  band={bucketFor(item, todayLocal, timezone)}
                  timezone={timezone}
                  showCouple={groupBy !== 'couple'}
                  selected={index === active}
                  onSelect={() => {
                    setCursor(index);
                    onOpen(item.stepId);
                  }}
                  onTick={onTick}
                  onSnooze={onSnooze}
                  onSkip={onSkip}
                  onOpenCouple={onOpenCouple}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
