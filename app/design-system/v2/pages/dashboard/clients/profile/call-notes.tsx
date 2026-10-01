'use client';

import { ArrowLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Segmented } from '@/components/ui-v2/segmented';

import { CallTranscript } from './call-transcript';
import { CallUpdates } from './call-updates';
import type { Call, CallNotes as Notes, Verdict } from './calls-data';
import { GUTTER } from './profile-header';

/**
 * Zebri's notes on one call, taking over the Calls section with a back
 * arrow to the list. Kept deliberately light: the title row holds a
 * Notes / Transcript switch and the one main action, Review recap (the
 * drafted recap, reviewed in the usual compose view and never sent on
 * its own). Notes is just the updates to apply, what else was heard,
 * anything the checklist missed and the MC's own jottings. The words
 * behind each update live in the transcript, one click away.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/call-notes
 */

const VIEWS = ['Notes', 'Transcript'] as const;
type View = (typeof VIEWS)[number];

export interface CallNotesProps {
  call: Call & { notes: Notes };
  decisions: Record<string, Verdict>;
  onDecide: (id: string, v: Verdict | null) => void;
  /** Opens the drafted recap; `sent` once it has gone. */
  onFollowUp: () => void;
  sent: boolean;
  onBack: () => void;
}

/** The notes view. See {@link CallNotesProps}. */
export function CallNotes({ call, decisions, onDecide, onFollowUp, sent, onBack }: CallNotesProps) {
  const n = call.notes;
  const [view, setView] = useState<View>('Notes');
  const [focus, setFocus] = useState<{ line: string; n: number } | null>(null);
  const jump = (line: string) => {
    setView('Transcript');
    setFocus((f) => ({ line, n: (f?.n ?? 0) + 1 }));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-[fade-in_200ms_ease-out_both]">
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-3 border-b border-zebra-200 py-4 ${GUTTER}`}
      >
        <Button
          variant="ghost"
          square
          aria-label="Back to calls"
          onClick={onBack}
          className="-ml-2"
        >
          <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
        <h3 className="type-subheading text-zebra-950">{call.title}</h3>
        <span className="mr-auto type-body text-zebra-500">
          {[call.when, call.length].filter(Boolean).join(' · ')}
        </span>
        <Segmented label="Show" options={VIEWS} value={view} onChange={setView} />
        {sent ? (
          <span className="px-2 type-body text-zebra-500">Recap sent</span>
        ) : (
          <Button onClick={onFollowUp}>Review recap</Button>
        )}
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto py-8 ${GUTTER}`}>
        {view === 'Transcript' ? (
          <div className="max-w-2xl">
            <CallTranscript lines={n.transcript} focus={focus} />
          </div>
        ) : (
          <div className="max-w-2xl space-y-10 motion-safe:animate-[fade-in_200ms_ease-out_both]">
            <CallUpdates
              updates={n.updates}
              decisions={decisions}
              onDecide={onDecide}
              onJump={jump}
            />
            <Group title="Also heard">
              <ul className="list-disc space-y-1.5 pl-5 marker:text-zebra-300">
                {n.details.map((d) => (
                  <li key={d.text}>{d.text}</li>
                ))}
              </ul>
            </Group>
            {n.missed.length ? (
              <Group title="Not covered">
                <p>{n.missed.join(', ')}</p>
              </Group>
            ) : null}
            {n.scratch ? (
              <Group title="Your notes">
                <p className="whitespace-pre-line">{n.scratch}</p>
              </Group>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 type-body text-zebra-950">
      <h3 className="type-label font-semibold">{title}</h3>
      {children}
    </section>
  );
}
