'use client'

import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** The eight steps of the welcome wizard. */
export type WelcomeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const TOTAL_STEPS = 8

/** Props for {@link WizardChrome}. */
export interface WizardChromeProps {
  step: WelcomeStep
  /** True while the step 3 save is in flight. */
  saving: boolean
  onBack: () => void
  onSkip: () => void
  onNext: () => void
  onFinish: () => void
}

/**
 * The wizard's pinned footer: progress on the left, navigation on the right.
 *
 * A thin bar rather than the branding wizard's numbered circles, which work
 * at three steps but crowd badly at eight on a narrow phone.
 */
export function WizardChrome({ step, saving, onBack, onSkip, onNext, onFinish }: WizardChromeProps) {
  const isLast = step === TOTAL_STEPS
  // Skip only makes sense where there is something to skip. Steps 4 to 8
  // have no input, so Next carries the screen alone.
  const canSkip = step === 2 || step === 3

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-1 w-24 sm:w-40 rounded-pill bg-surface-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <div
            className="h-full bg-brand-fg transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-subtle whitespace-nowrap">
          {step} of {TOTAL_STEPS}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {canSkip && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            disabled={saving}
            className="text-xs text-text-muted"
          >
            Skip
          </Button>
        )}
        {step > 1 && (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
            Back
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={isLast ? onFinish : onNext}
          disabled={saving}
          loading={saving}
        >
          {isLast ? 'Finish' : 'Next'}
          {!isLast && <ChevronRight size={14} strokeWidth={1.5} />}
        </Button>
      </div>
    </div>
  )
}
