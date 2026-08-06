'use client'

import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

const TOTAL_STEPS = 4

/**
 * Props for the wizard footer navigation.
 * @internal
 */
interface WizardChromeProps {
  step: 1 | 2 | 3 | 4
  /** True on the welcome screen: the primary action is Get started. */
  intro: boolean
  loading: boolean
  onStart: () => void
  onBack: () => void
  onSkip: () => void
  onNext: () => void
  onFinish: () => void
  canFinish: boolean
}

/**
 * WizardChrome: the onboarding modal's pinned footer.
 *
 * Matches the welcome tour's chrome: a thin progress bar with "N of 4" at
 * the bottom left, and Skip / Back / Next (or Finish) grouped on the right.
 * The bar is hidden on the intro screen, where nothing has started yet.
 * @internal
 */
export function WizardChrome(props: WizardChromeProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {!props.intro && (
          <>
            <div
              className="h-1 w-24 sm:w-40 rounded-pill bg-surface-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={props.step}
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
            >
              <div
                className="h-full bg-brand-fg transition-all duration-300"
                style={{ width: `${(props.step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-subtle whitespace-nowrap">
              {props.step} of {TOTAL_STEPS}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onSkip}
          disabled={props.loading}
          className="text-xs text-text-muted"
        >
          Skip, use defaults
        </Button>
        {props.intro ? (
          <Button variant="primary" size="sm" onClick={props.onStart} disabled={props.loading} className="rounded-control">
            Get started
            <ChevronRight size={14} strokeWidth={1.5} />
          </Button>
        ) : (
          <>
            {props.step > 1 && (
              <Button variant="ghost" size="sm" onClick={props.onBack} disabled={props.loading}>
                Back
              </Button>
            )}
            {props.step < TOTAL_STEPS ? (
              <Button variant="primary" size="sm" onClick={props.onNext} disabled={props.loading} className="rounded-control">
                Next
                <ChevronRight size={14} strokeWidth={1.5} />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={props.onFinish}
                disabled={props.loading || !props.canFinish}
                loading={props.loading}
                className="rounded-control"
              >
                Finish setup
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
