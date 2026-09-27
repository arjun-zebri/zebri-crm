'use client';

/**
 * What a held send could not fill in, under its envelope.
 *
 * Two kinds of gap, worded apart because the fix for each is different
 * (live check B7). A variable Zebri knows but this couple has no value
 * for is fixed on the couple ("add the venue") or in the message. A
 * variable Zebri does not know at all (a typo, or `{{event.venue}}` for
 * `{{venue.name}}`) is empty for every couple, so no detail can release
 * it: the only fix is the message.
 *
 * @module app/(dashboard)/workflows/step-envelope-gaps
 */

import { AlertTriangle } from 'lucide-react';

export interface StepEnvelopeGapsProps {
  /** Known variables this couple cannot fill, by readable label. */
  unresolved: string[];
  /** Variables Zebri does not know, by path. */
  unknown: string[];
  /** The send's own rule: true when the gaps stop it going. */
  holds: boolean;
}

/** One warning line with its icon. */
function Warning({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 text-danger">
      <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

/** What happens to the send with these gaps in it. */
function outcome(holds: boolean, count: number): string {
  return holds
    ? `the email will not send until ${count === 1 ? 'it is' : 'they are'}`
    : `the email will send with ${count === 1 ? 'this' : 'these'} left blank`;
}

/** The gap lines. See {@link StepEnvelopeGapsProps}. */
export function StepEnvelopeGaps({ unresolved, unknown, holds }: StepEnvelopeGapsProps) {
  const known = unresolved.length;
  const strange = unknown.length;
  return (
    <>
      {known > 0 ? (
        <Warning>
          {`${unresolved.join(', ')} could not be filled in and ${outcome(holds, known)}${
            holds ? ' filled' : ''
          }. ${known === 1 ? 'It is' : 'They are'} marked in the preview. Edit the message or add the detail to the couple.`}
        </Warning>
      ) : null}
      {strange > 0 ? (
        <Warning>
          {`${unknown.map((path) => `{{${path}}}`).join(', ')} ${
            strange === 1 ? 'is not a variable' : 'are not variables'
          } Zebri knows, so no detail on the couple can fill ${strange === 1 ? 'it' : 'them'} and ${outcome(
            holds,
            strange,
          )}${holds ? ' taken out' : ''}. Edit the message to remove ${
            strange === 1 ? 'it' : 'them'
          } or pick a variable from the list.`}
        </Warning>
      ) : null}
    </>
  );
}
