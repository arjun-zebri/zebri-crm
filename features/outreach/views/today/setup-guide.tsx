'use client';

/**
 * "Get set up": the first-run guide that leads Today until the five
 * required steps are done. It replaces the Ready to send card on Today,
 * so the founder sees one ordered path instead of a status list.
 *
 * Only the current step carries a button. Instagram lookups sit below a
 * divider as an optional row and never count toward "N of 5 done".
 *
 * @module features/outreach/views/today/setup-guide
 */
import { Circle, CircleCheck } from 'lucide-react';

import { BOOKING_WARNING, type SetupState } from '@/lib/outreach/setup';

import { SetupGuideStep } from './setup-guide-step';

/** Props for {@link SetupGuide}. */
export interface SetupGuideProps {
  setup: SetupState;
}

/** The setup card. The caller only mounts it while setup is incomplete. */
export function SetupGuide({ setup }: SetupGuideProps) {
  return (
    <section aria-labelledby="setup-guide-heading" className="rounded-control border border-border bg-card p-4 md:p-5 space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-guide-heading" className="text-body font-semibold text-text">
          Get set up
        </h2>
        <p className="text-body text-text-muted">
          {setup.doneCount} of {setup.total} done
        </p>
      </header>

      <ol className="divide-y divide-border">
        {setup.steps.map((step) => (
          // Why: the booking gap blocks the campaign step, so its warning sits under that row only.
          <SetupGuideStep key={step.key} step={step} warning={step.key === 'campaign' && setup.bookingWarning ? BOOKING_WARNING : undefined} />
        ))}
      </ol>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-body text-text-subtle">Optional</p>
        <div className="flex items-start gap-3">
          {setup.optional.done ? (
            <CircleCheck size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-success" aria-hidden />
          ) : (
            <Circle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text-subtle" aria-hidden />
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="text-body font-medium text-text-muted">{setup.optional.title}</p>
            <p className="text-body text-text-muted">{setup.optional.description}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
