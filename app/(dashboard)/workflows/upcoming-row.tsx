'use client';

/**
 * One row of the Upcoming list: what happens, for whom, and when.
 *
 * The right-hand column is a time for anything with one, including a
 * send behind a Wait (its time is the Wait's end, see
 * `lib/workflows/schedule-projection`). A step only a person can release
 * shows a pill instead ("After previous step", naming the step on hover).
 *
 * @module app/(dashboard)/workflows/upcoming-row
 */

import { AlertTriangle, Zap } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { StatePill } from '@/components/ui/state-pill';
import { Tooltip } from '@/components/ui/tooltip';
import type { QueueItem } from '@/lib/workflows/queue';
import { isAutomated } from '@/lib/workflows/steps';

import { rowDueLabel, type BucketKey } from './queue-buckets';
import { coupleLine, gatePillLabel, rowActions } from './upcoming-row-parts';

/** Props for {@link UpcomingRow}. */
export interface UpcomingRowProps {
  item: QueueItem;
  /** The date band the row falls in, for its right-hand label. */
  band: BucketKey;
  timezone: string;
  /** False when the rail is already the couple's name. */
  showCouple: boolean;
  /** The keyboard cursor is on this row. */
  selected: boolean;
  /** Opens the row (and moves the cursor to it). */
  onSelect: () => void;
  onTick: (stepId: string) => void;
  onChangeDate: (item: QueueItem) => void;
  onSnooze: (stepId: string, days: number) => void;
  onSkip: (stepId: string) => void;
  onOpenCouple: (coupleId: string) => void;
}

/** See the module docs. */
export function UpcomingRow({
  item,
  band,
  timezone,
  showCouple,
  selected,
  onSelect,
  onTick,
  onChangeDate,
  onSnooze,
  onSkip,
  onOpenCouple,
}: UpcomingRowProps) {
  const automated = isAutomated(item.type);
  const errored = item.status === 'errored';
  const gated = item.dueAt === null && Boolean(item.gate);
  return (
    // The whole row opens the step. The title button stays for the
    // keyboard and the screen reader; its click bubbles up to this
    // handler rather than duplicating it.
    <div
      role="listitem"
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:gap-3 sm:px-4 ${
        selected ? 'bg-surface-muted' : 'hover:bg-surface-muted'
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
        // Ticking is not opening: swallow the click so the modal never
        // appears behind a checked box.
        <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={false}
            onChange={() => onTick(item.stepId)}
            ariaLabel={`Mark "${item.title}" done`}
          />
        </span>
      )}

      {/* Title, couple and date. A row on a phone is too narrow for all
          three on one line: the date took its full width, the title
          shrank to nothing and the pill overflowed onto the date (owner
          report, 2026-10-20). So the column stacks there, title over
          date, and sits in one line from `sm` up. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <button type="button" className="min-w-0 cursor-pointer text-left sm:flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {/* The subject is what tells two sends apart; "Send email" on
                every row is context, so it sits back in the muted tone. */}
            <span className="min-w-0 max-w-full truncate text-body text-text">
              {item.kind ? <span className="text-text-muted">{item.kind} · </span> : null}
              {item.name ?? item.title}
            </span>
            {/* A ⚡ says "Zebri runs this", which is the opposite of what a
                held send needs the MC to know. The pill says whose move it
                is. It wraps under a long title rather than squeezing it. */}
            {item.requiresApproval ? (
              <StatePill label="Needs your OK" tone="warning" dot="hollow" className="shrink-0" />
            ) : null}
          </span>
          {/* On a phone the reason gets its own line: there is no hover to
              read a truncated one on touch. */}
          {gated ? (
            <span className="block text-body text-text-muted sm:hidden">{item.gate}</span>
          ) : null}
        </button>

        {/* Redundant when the rail is already the couple's name, and a
            repeated name down a column is what makes a grouped list hard
            to scan. */}
        {showCouple ? (
          <span className="hidden shrink-0 text-body text-text-muted sm:inline">
            {coupleLine(item)}
          </span>
        ) : null}

        {/* One fixed slot for the date or the pill on wider screens, so
            the couple column beside it lines up on every row. Sized for
            the longest label, "Wed 30 Sep 2027, 10:30am"; a narrower slot
            let that overflow and shoved its row's couple name out of
            line. A gated row's phone line is the reason above. */}
        <span className={`shrink-0 sm:flex sm:w-56 sm:justify-end ${gated ? 'hidden' : 'flex'}`}>
          {gated ? (
            // The pill says there is a step first; hovering it says which.
            <Tooltip label={item.gate ?? ''} multiline className="hidden sm:inline-flex">
              <StatePill label={gatePillLabel(item.gate ?? '')} tone="neutral" />
            </Tooltip>
          ) : (
            <span
              className={`whitespace-nowrap text-body tabular-nums ${
                band === 'overdue' ? 'text-danger' : 'text-text-muted'
              }`}
            >
              {rowDueLabel(item, band, timezone)}
            </span>
          )}
        </span>
      </div>

      <RowActionsMenu
        size="sm"
        alwaysVisible
        actions={rowActions(item, { onChangeDate, onSnooze, onSkip, onOpenCouple })}
      />
    </div>
  );
}
