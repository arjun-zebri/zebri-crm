'use client';

/**
 * One row of the setup guide: a number or check, the title, one line of
 * description, and at most one button. The button only exists on the
 * current step, which the derivation in `lib/outreach/setup` guarantees.
 *
 * @module features/outreach/views/today/setup-guide-step
 */
import { AlertTriangle, CircleCheck } from 'lucide-react';
import Link from 'next/link';

import { buttonClassName } from '@/components/ui/button';
import type { SetupStep } from '@/lib/outreach/setup';

/** Props for {@link SetupGuideStep}. */
export interface SetupGuideStepProps {
  step: SetupStep;
  /** A blocker that sits under this step, such as a missing booking page. Shown in warning colour. */
  warning?: string | undefined;
}

/** A single numbered step. Done steps mute their text and show a check instead of the number. */
export function SetupGuideStep({ step, warning }: SetupGuideStepProps) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        {step.done ? (
          <CircleCheck size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-success" aria-hidden />
        ) : (
          <span
            aria-hidden
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border border-border-strong text-body text-text-subtle"
          >
            {step.number}
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          <p className={step.done ? 'text-body font-medium text-text-muted' : 'text-body font-medium text-text'}>
            {step.title}
            <span className="sr-only">{step.done ? ' (done)' : ` (step ${step.number})`}</span>
          </p>
          <p className="text-body text-text-muted">{step.description}</p>
          {warning && (
            <p role="note" className="flex items-start gap-1.5 pt-1 text-body text-warning">
              <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
              <span>{warning}</span>
            </p>
          )}
        </div>
      </div>
      {step.buttonLabel && (
        <Link href={step.href} className={`${buttonClassName({ variant: 'primary' })} shrink-0`}>
          {step.buttonLabel}
        </Link>
      )}
    </li>
  );
}
