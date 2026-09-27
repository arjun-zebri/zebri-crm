'use client';

/**
 * The chips under a step card's summary: what is unfinished about it,
 * when it runs, and whether it asks first.
 *
 * The canvas node and the phone list draw the same card, and they had
 * drifted (the list had no icons). One component keeps a new chip, such
 * as the pre-flight's unfinished one, from reaching only one of them.
 * Every chip is a `StatePill` with a leading icon.
 *
 * @module app/(dashboard)/workflows/[id]/step-card-chips
 */

import { AlertTriangle, CalendarClock, ShieldCheck } from 'lucide-react';

import { StatePill } from '@/components/ui/state-pill';

import type { FlowNodeData } from './flow-node';

/** Renders nothing when the card has no chip to show. */
export function StepCardChips({
  data,
}: {
  data: Pick<FlowNodeData, 'timingLabel' | 'needsReview' | 'problem'>;
}) {
  const { timingLabel, needsReview, problem } = data;
  if (!timingLabel && !needsReview && !problem) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {/* First: it is the one chip that asks the MC to do something. It
          wraps rather than truncates, since the fix is in its text. */}
      {problem && (
        <StatePill
          tone="warning"
          icon={AlertTriangle}
          wrap
          label={
            <>
              <span className="sr-only">Unfinished: </span>
              {problem}
            </>
          }
        />
      )}
      {timingLabel && <StatePill icon={CalendarClock} label={timingLabel} />}
      {needsReview && <StatePill icon={ShieldCheck} label="Asks you first" />}
    </span>
  );
}
