'use client';

/**
 * The headline funnel: counts at each stage, with the conversion from the
 * stage before. Lost and opted-out are shown beside it, not in the chain.
 *
 * @module features/outreach/views/analytics/funnel-strip
 */
import { ChevronRight } from 'lucide-react';

import type { Funnel } from '@/lib/outreach/services/queries';

import { formatPct } from './format';

interface FunnelStripProps {
  funnel: Funnel;
}

/** Funnel steps: a two-column grid on a phone so every count shows, one row with arrows from `sm` up. */
export function FunnelStrip({ funnel }: FunnelStripProps) {
  const steps = [
    { label: 'Imported', value: funnel.total },
    { label: 'Checked', value: funnel.checked },
    { label: 'Active', value: funnel.active },
    { label: 'Contacted', value: funnel.contacted },
    { label: 'Replied', value: funnel.replied },
    { label: 'Demo booked', value: funnel.demoBooked },
    { label: 'Demo done', value: funnel.demoDone },
    { label: 'Signed up', value: funnel.signedUp },
    { label: 'Paying', value: funnel.paying },
  ];

  return (
    <section aria-label="Funnel" className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:overflow-x-auto sm:pb-1">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1]?.value ?? 0 : 0;
          const conversion = i > 0 && prev > 0 ? formatPct(step.value / prev) : null;
          return (
            <div key={step.label} className="flex min-w-0 items-stretch gap-2 sm:shrink-0">
              {i > 0 && <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" className="hidden self-center text-text-subtle sm:block" />}
              <div className="min-w-0 flex-1 space-y-1 rounded-control bg-surface-muted p-3 sm:min-w-28 sm:flex-none">
                <p className="text-body text-text-muted">{step.label}</p>
                <p className="text-section font-semibold text-text tabular-nums">{step.value.toLocaleString('en-AU')}</p>
                <p className="text-body text-text-subtle">{conversion ? `${conversion} of previous` : ' '}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-body text-text-muted">
        Lost {funnel.lost.toLocaleString('en-AU')} · Opted out {funnel.optedOut.toLocaleString('en-AU')}
      </p>
    </section>
  );
}
