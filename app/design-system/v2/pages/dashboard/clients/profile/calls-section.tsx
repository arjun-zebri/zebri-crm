'use client';


import { Button } from '@/components/ui-v2/button';
import { ROW } from '@/components/ui-v2/control-styles';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { CallIcon, SpinnerIcon, VideoIcon } from '@/components/ui-v2/icons';

import { CallChecklist } from './call-checklist';
import type { Call, Verdict } from './calls-data';
import { StatusText } from './doc-row';
import { GUTTER, TOP } from './profile-header';
import { ProfileGroup } from './section-frame';

/**
 * Every video call with the client, in one column (2026-10-09 founder
 * mockup). First the next call as a soft card: its name, when, and that
 * Zebri takes notes, with Copy link (the join link the client opens, no
 * login or install) and Start, then what to cover on it, which the MC
 * shapes before starting. Then past calls, newest first, each with
 * Zebri's summary under it; a past call opens its full notes.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/calls-section
 */

export interface CallsSectionProps {
  calls: Call[];
  decisions: Record<string, Verdict>;
  checklist: string[];
  onChecklist: (items: string[]) => void;
  /** Starts a call, from a booked one when given. */
  onStart: (from?: string) => void;
  onOpen: (id: string) => void;
  /** The client's join link. */
  link: string;
  /** A call is already running: Start is off. */
  busy: boolean;
}

/** The Calls section. See {@link CallsSectionProps}. */
export function CallsSection(p: CallsSectionProps) {
  const next = p.calls.find((c) => c.status === 'upcoming');
  const past = p.calls.filter((c) => c.status !== 'upcoming');
  return (
    <div className="min-h-0 flex-1 overflow-y-auto motion-safe:animate-fade-in">
      <div className={`space-y-8 pb-28 ${TOP} ${GUTTER}`}>
        <section aria-label="Next call" className="space-y-4 rounded-panel bg-zebra-50 p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="mr-auto min-w-0">
              <p className="type-label text-zebra-950">{next?.title ?? 'No call booked'}</p>
              <p className="type-body text-zebra-500">
                {next ? `${next.when} · Zebri takes notes` : 'Start one now, or send them the link'}
              </p>
            </div>
            <CopyButton value={p.link} label="Copy link" />
            <Button
              onClick={() => p.onStart(next?.id)}
              disabled={p.busy}
              icon={<VideoIcon aria-hidden="true" className="size-4" />}
            >
              Start
            </Button>
          </div>
          <div className="border-t border-hairline pt-4">
            <CallChecklist quiet="To cover" items={p.checklist} onItems={p.onChecklist} />
          </div>
        </section>
        {past.length ? (
          <ProfileGroup title="Past calls">
            <ul className="-mx-3">
              {past.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => p.onOpen(c.id)}
                    disabled={c.status === 'processing'}
                    className={`flex w-full items-start gap-4 rounded-button px-3 py-3 text-left ${ROW} disabled:cursor-default disabled:hover:bg-transparent`}
                  >
                    <CallIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-zebra-500"
                    />
                    <PastCall call={c} decisions={p.decisions} />
                  </button>
                </li>
              ))}
            </ul>
          </ProfileGroup>
        ) : null}
      </div>
    </div>
  );
}

/** A past call: its name and length, where its notes stand, its date, and Zebri's summary under it. */
function PastCall({ call, decisions }: { call: Call; decisions: Record<string, Verdict> }) {
  const waiting = (call.notes?.updates ?? []).filter((u) => !u.decided && !decisions[u.id]).length;
  return (
    <span className="min-w-0 flex-1 space-y-1 type-body">
      <span className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate">
          <span className="text-zebra-950">{call.title}</span>
          {call.length ? <span className="text-zebra-400"> · {call.length}</span> : null}
        </span>
        {/* Where the notes stand sits on the call's own line: still being written, or updates to review. */}
        {call.status === 'processing' ? (
          <span className="flex shrink-0 items-center gap-2 text-zebra-500">
            <SpinnerIcon
              aria-hidden="true"
              className="size-3.5 animate-spin motion-reduce:animate-none"
            />
            Writing notes
          </span>
        ) : waiting ? (
          <StatusText
            status="waiting"
            state={`${waiting} ${waiting === 1 ? 'update' : 'updates'} to review`}
          />
        ) : null}
        <span className="shrink-0 text-zebra-400">{call.when}</span>
      </span>
      {call.notes ? <span className="block text-zebra-500">{call.notes.summary}</span> : null}
    </span>
  );
}
