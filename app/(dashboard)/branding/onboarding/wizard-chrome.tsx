'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Props for wizard chrome (header + footer nav).
 * @internal
 */
interface WizardChromeProps {
  step: 1 | 2 | 3
  loading: boolean
  onBack: () => void
  onSkip: () => void
  onNext: () => void
  onFinish: () => void
  canFinish: boolean
}

/**
 * WizardChrome — Progress dots + navigation buttons for onboarding wizard.
 *
 * Header: 3-step progress indicator (filled dots advance, empty dots follow).
 * Footer: Back / Skip / Next / Finish buttons with proper state.
 * @internal
 */
export function WizardChrome(props: WizardChromeProps) {
  return (
    <>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all ${
              s <= props.step ? 'w-8 bg-brand' : 'w-2 bg-surface-muted'
            }`}
          />
        ))}
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={props.onBack}
          disabled={props.step === 1 || props.loading}
          className="cursor-pointer"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Back
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={props.onSkip}
            disabled={props.loading}
            className="text-sm text-text-muted hover:text-text underline cursor-pointer disabled:opacity-50 disabled:cursor-default transition"
          >
            Skip, use defaults
          </button>
        </div>

        {props.step < 3 ? (
          <Button
            variant="primary"
            size="sm"
            onClick={props.onNext}
            disabled={props.loading}
            className="cursor-pointer"
          >
            Next
            <ChevronRight size={16} strokeWidth={1.5} />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={props.onFinish}
            disabled={props.loading || !props.canFinish}
            className="cursor-pointer"
          >
            {props.loading ? 'Finishing...' : 'Finish'}
          </Button>
        )}
      </div>
    </>
  )
}
