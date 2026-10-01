'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { monthDay } from '../../payments/dates';
import { money } from '../../payments/payments-data';
import { COLUMNS } from '../../proposals/overview/overview-stats';
import { MOMENTS, bookedValue, listById } from '../campaigns-data';
import { pct } from '../email-data';
import type { EmailState } from '../use-email-state';

import { MomentRow } from './moment-row';
import { OverviewStats } from './overview-stats';

/**
 * The Email Overview tab: is email bringing in bookings, and what to
 * send next. The four figures sit on the backdrop; under them, "Worth
 * sending now" (Zebri's suggested sends, each with its reason and
 * ready to review) beside "Recent campaigns" (each with what it booked
 * and how many opened), as the chart and rail sit on the Proposals
 * Overview. No chart: an MC sends a handful of campaigns a year, and
 * the money line per campaign says more than a curve would.
 *
 * @module app/design-system/v2/pages/dashboard/email/overview/overview-view
 */

export interface OverviewViewProps {
  state: EmailState;
  onOpenCampaign: (id: string) => void;
  /** Opens a suggested send, ready to schedule. */
  onReview: (momentId: string) => void;
  /** Goes to the Campaigns tab. */
  onViewAll: () => void;
}

/** Section title row: the heading and, optionally, a plain link on the right. */
function Heading({ id, children, action }: { id: string; children: string; action?: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between gap-3 border-b border-zebra-950/15 pb-2">
      <h2 id={id} className="type-subheading text-zebra-950">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** The Overview tab. See {@link OverviewViewProps}. */
export function OverviewView({ state, onOpenCampaign, onReview, onViewAll }: OverviewViewProps) {
  const recent = state.campaigns.filter((c) => c.group === 'sent').sort((a, b) => (b.on ?? '').localeCompare(a.on ?? ''));
  return (
    <div className="space-y-8">
      <OverviewStats templates={state.templates} campaigns={state.campaigns} onOpen={onViewAll} />
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-y-8 ${COLUMNS}`}>
        <section aria-labelledby="email-worth" className="pt-4">
          <Heading id="email-worth">Worth sending now</Heading>
          <ul className="divide-y divide-zebra-950/5">
            {MOMENTS.map((m) => (
              <li key={m.id}>
                <MomentRow moment={m} scheduled={state.scheduled.has(m.id)} onReview={() => onReview(m.id)} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="email-recent" className="pt-4">
          <Heading
            id="email-recent"
            action={
              <Button variant="plain" onClick={onViewAll}>
                All campaigns
              </Button>
            }
          >
            Recent campaigns
          </Heading>
          <ul className="divide-y divide-zebra-950/5">
            {recent.map((c) => (
              <li key={c.id} className="relative -mx-2 flex cursor-pointer items-center gap-4 rounded-button px-2 py-3 transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none">
                <span className="w-14 shrink-0 type-body tabular-nums text-zebra-500">{monthDay(c.on!)}</span>
                <div className="min-w-0 flex-1">
                  <StretchedButton label={`Open campaign ${c.name}`} onClick={() => onOpenCampaign(c.id)}>
                    <span className="block truncate type-label text-zebra-950">{c.name}</span>
                    <span className="block truncate type-body text-zebra-500">
                      {listById(c.list).name} · {pct(c.opened, c.delivered)}% opened
                    </span>
                  </StretchedButton>
                </div>
                <span className="flex flex-col items-end">
                  <span className="type-label tabular-nums text-zebra-950">{money(bookedValue(c))}</span>
                  <span className="type-body text-zebra-400">
                    {c.booked.length} booked
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
