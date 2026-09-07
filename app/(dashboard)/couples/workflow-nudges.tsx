'use client';

/**
 * The line a couple's Workflow tab should be telling the MC.
 *
 * A checklist shows what is there. This shows what is wrong with what is
 * there: a failed send, a message waiting for their OK, steps anchored to
 * a wedding date nobody has set. Those are invisible in a list of forty
 * rows and obvious in one sentence at the top.
 *
 * Rendered as plain lines, not boxes: a bordered alert inside a bordered
 * tab inside a bordered modal is exactly the drift the design system
 * exists to stop.
 *
 * @module app/(dashboard)/couples/workflow-nudges
 */

import { AlertTriangle, Info } from 'lucide-react';

import type { Nudge } from '@/lib/workflows/nudges';

/** Text colour per tone. Info stays muted; it is context, not an alarm. */
const TONE_CLASS = {
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-text-muted',
} as const;

export interface WorkflowNudgesProps {
  nudges: Nudge[];
}

/** The nudge list. See {@link WorkflowNudgesProps}. */
export function WorkflowNudges({ nudges }: WorkflowNudgesProps) {
  if (nudges.length === 0) return null;

  return (
    <ul className="space-y-1">
      {nudges.map((nudge) => (
        <li key={nudge.id} className={`flex items-start gap-2 text-body ${TONE_CLASS[nudge.tone]}`}>
          {nudge.tone === 'info' ? (
            <Info size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <span>{nudge.message}</span>
        </li>
      ))}
    </ul>
  );
}
