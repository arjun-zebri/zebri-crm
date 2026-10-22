'use client';

import { Button } from '@/components/ui-v2/button';
import { ChevronLeftIcon } from '@/components/ui-v2/icons';


import { CallUpdates } from './call-updates';
import type { Call, CallNotes as Notes, Verdict } from './calls-data';
import { GUTTER, TOP } from './profile-header';

/**
 * Zebri's notes on one call, taking over the Calls section (2026-10-09
 * founder mockup): "< Calls" back, the call's name as the page's title
 * with when and how long under it, then the updates heard on the call to
 * apply, a hairline, and the summary with what the checklist missed.
 * A booked call keeps its booked name; one started on its own is named
 * by Zebri for what it was ("Intro call"), never just "Call".
 *
 * No transcript and no recap email (founder, 2026-10-09): the MC only
 * needs what changed and what is left.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/call-notes
 */

export interface CallNotesProps {
  call: Call & { notes: Notes };
  decisions: Record<string, Verdict>;
  onDecide: (id: string, v: Verdict | null) => void;
  onBack: () => void;
}

/** The notes view. See {@link CallNotesProps}. */
export function CallNotes({ call, decisions, onDecide, onBack }: CallNotesProps) {
  const n = call.notes;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto motion-safe:animate-fade-in">
      <div className={`space-y-8 pb-28 ${TOP} ${GUTTER}`}>
        <div className="space-y-6">
          {/* -ml-1 sets the chevron on the column edge, under the title. */}
          <Button variant="plain" onClick={onBack} className="-ml-1" icon={<ChevronLeftIcon aria-hidden="true" className="size-4" />}>
            Calls
          </Button>
          <div className="space-y-1">
            <h3 className="type-title text-zebra-950 md:type-display">{call.title}</h3>
            <p className="type-body text-zebra-500">
              {[call.when, call.length].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {n.updates.length ? (
          <CallUpdates updates={n.updates} decisions={decisions} onDecide={onDecide} />
        ) : null}
        <section
          aria-label="Summary"
          className={`space-y-4 type-body ${n.updates.length ? 'border-t border-hairline pt-8' : ''}`}
        >
          <p className="max-w-2xl text-zebra-700">{n.summary}</p>
          {n.missed.length ? (
            <p className="text-zebra-400">Not covered: {n.missed.join(', ').toLowerCase()}</p>
          ) : null}
          {n.scratch ? <p className="whitespace-pre-line text-zebra-700">{n.scratch}</p> : null}
        </section>
      </div>
    </div>
  );
}
