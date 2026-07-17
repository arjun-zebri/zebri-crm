'use client'

import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Props for the wizard footer navigation.
 * @internal
 */
interface WizardChromeProps {
  step: 1 | 2 | 3
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
 * One row under a full-bleed hairline: "Skip, use defaults" as a quiet text
 * link on the left; Back (ghost, hidden on the first step) and Next / Finish
 * (primary) grouped on the right. The negative horizontal margins cancel the
 * modal card's px-6 so the top border spans the full card width.
 * @internal
 */
export function WizardChrome(props: WizardChromeProps) {
  return (
    <div className="-mx-6 mt-4 px-6 pt-4 border-t border-border flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={props.onSkip}
        disabled={props.loading}
        className="text-sm text-text-muted hover:text-text cursor-pointer disabled:opacity-50 disabled:cursor-default transition"
      >
        Skip, use defaults
      </button>

      <div className="flex items-center gap-2">
        {props.intro ? (
          <Button variant="primary" size="sm" onClick={props.onStart} disabled={props.loading} className="rounded-xl">
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
        {props.step < 3 ? (
          <Button variant="primary" size="sm" onClick={props.onNext} disabled={props.loading} className="rounded-xl">
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
            className="rounded-xl"
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
