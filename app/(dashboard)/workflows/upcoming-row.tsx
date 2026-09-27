'use client';

/**
 * One row of the Upcoming list: what happens, for whom, and when.
 *
 * The right-hand column is a time for anything with one, including a
 * send behind a Wait (its time is the Wait's end, see
 * `lib/workflows/schedule-projection`). A step only a person can release
 * says why instead ("After you finish Call the venue").
 *
 * @module app/(dashboard)/workflows/upcoming-row
 */

import { AlertTriangle, Zap } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { StatePill } from '@/components/ui/state-pill';
import type { QueueItem } from '@/lib/workflows/queue';
import { isAutomated } from '@/lib/workflows/steps';

import { rowDueLabel, type BucketKey } from './queue-buckets';
import { coupleLine, rowActions } from './upcoming-row-parts';

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

      <button type="button" className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-body text-text">{item.title}</span>
          {/* A ⚡ says "Zebri runs this", which is the opposite of what a
              held send needs the MC to know. The pill says whose move it is. */}
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

      {gated ? (
        // A reason is a sentence, not a date: it gets room to read, and
        // truncates with the whole of it on hover.
        <span
          title={item.gate ?? undefined}
          className="hidden min-w-0 max-w-64 shrink truncate text-right text-body text-text-muted sm:inline"
        >
          {item.gate}
        </span>
      ) : (
        <span
          className={`shrink-0 whitespace-nowrap text-right text-body sm:w-20 ${
            band === 'overdue' ? 'text-danger' : 'text-text-muted'
          }`}
        >
          {rowDueLabel(item, band, timezone)}
        </span>
      )}

      <RowActionsMenu
        size="sm"
        alwaysVisible
        actions={rowActions(item, { onSnooze, onSkip, onOpenCouple })}
      />
    </div>
  );
}
