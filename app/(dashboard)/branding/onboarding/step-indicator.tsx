'use client'

import { Check } from 'lucide-react'

/**
 * Props for the step indicator.
 * @internal
 */
interface StepIndicatorProps {
  /** Current active step: 1, 2, or 3. */
  currentStep: 1 | 2 | 3
}

const STEPS = ['Business', 'Look', 'Documents'] as const

/**
 * StepIndicator: a compact connected step rail for the onboarding modal.
 *
 * Three 24px numbered circles joined by hairline connectors that fill as
 * steps complete. Active and completed circles use the same tokens as the
 * app's primary buttons (bg-brand-fg / text-text-inverse) so the rail reads
 * as product chrome and stays readable in any theme; upcoming circles are
 * quiet outlines. The active item carries aria-current="step".
 *
 * Layout: labels hang below their circles via absolute positioning so the
 * connectors butt against the circle edges exactly (a label wider than its
 * circle would otherwise push the line away and break the rail).
 * @internal
 */
export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <ol aria-label="Setup steps" className="flex items-start justify-center pb-6">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep
        return (
          <li key={label} className="flex items-start">
            {/* Connector before every circle except the first; fills once its
                preceding step is done. mt centers the 2px line on the 24px circle. */}
            {i > 0 && (
              <div
                aria-hidden
                className={`w-12 sm:w-16 h-0.5 mt-[11px] transition-colors duration-300 motion-reduce:transition-none ${
                  step <= currentStep ? 'bg-brand-fg' : 'bg-border'
                }`}
              />
            )}
            <div className="relative">
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium tabular-nums transition-colors duration-300 motion-reduce:transition-none ${
                  isCompleted || isCurrent
                    ? 'bg-brand-fg text-text-inverse'
                    : 'bg-surface border border-border text-text-subtle'
                }`}
              >
                {isCompleted ? <Check size={12} strokeWidth={1.5} aria-label="Done" /> : step}
              </div>
              <span
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap text-[11px] leading-none ${
                  isCurrent ? 'text-text font-medium' : 'text-text-subtle'
                }`}
              >
                {label}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
