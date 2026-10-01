'use client';

import { Video } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';

import { CallChecklist } from './call-checklist';
import { CallRow } from './call-row';
import type { Call, Verdict } from './calls-data';
import { ProfileGroup } from './section-frame';
import { SplitSection } from './split-section';

/**
 * Every video call with the client: the one booked next with its Start
 * button, then past calls, newest first, each opening Zebri's notes.
 * Start call is the one primary button; the join link the client opens
 * (no login, no install) copies beside it. The panel on the right is the
 * checklist for the next call, so the MC shapes it before starting.
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
  const upcoming = p.calls.filter((c) => c.status === 'upcoming');
  const past = p.calls.filter((c) => c.status !== 'upcoming');
  return (
    <SplitSection
      asideLabel="Checklist"
      main={
        <div className="max-w-3xl space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto type-body text-zebra-500">Zebri takes notes on every call.</p>
            <CopyButton value={p.link} label="Copy join link" />
            <Button onClick={() => p.onStart()} disabled={p.busy}>
              <Video aria-hidden="true" strokeWidth={1.5} className="size-4" />
              Start call
            </Button>
          </div>
          {upcoming.length ? (
            <ProfileGroup title="Coming up">
              <ul className="-mx-3 space-y-1">
                {upcoming.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 rounded-button px-3 py-3">
                    <CallRow call={c} decisions={p.decisions} />
                    <Button variant="secondary" onClick={() => p.onStart(c.id)} disabled={p.busy}>
                      Start
                    </Button>
                  </li>
                ))}
              </ul>
            </ProfileGroup>
          ) : null}
          {past.length ? (
            <ProfileGroup title="Past calls">
              <ul className="-mx-3 space-y-1">
                {past.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => p.onOpen(c.id)}
                      disabled={c.status === 'processing'}
                      className="flex w-full items-start gap-4 rounded-button px-3 py-3 text-left transition-colors duration-150 hover:bg-zebra-950/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 disabled:cursor-default disabled:hover:bg-transparent motion-reduce:transition-none"
                    >
                      <CallRow call={c} decisions={p.decisions} />
                    </button>
                  </li>
                ))}
              </ul>
            </ProfileGroup>
          ) : null}
          {p.calls.length ? null : (
            <p className="py-10 text-center type-body text-zebra-400">
              No calls yet. Start one, or send them the join link.
            </p>
          )}
        </div>
      }
      aside={<CallChecklist items={p.checklist} onItems={p.onChecklist} />}
    />
  );
}
