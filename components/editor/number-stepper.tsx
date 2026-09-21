'use client'

/**
 * A bounded numeric value with step buttons and a directly-editable field.
 * Lifted out of the Branding text style controls (Proposal Layout v2 Phase
 * 2, spec 5.3) so the proposal section editor's spacing and typography
 * controls share the same stepper instead of a second copy.
 *
 * Round 1 fix: the first cut of this move replaced the editable
 * `<input type="number">` with a plain text readout, because the task
 * brief's own test asserted on `getByText`, which can never match an
 * input's value. The controller ruled that assertion wrong and the
 * original editable behaviour right, so the input is back: typing an
 * exact figure (font size, padding) is a real capability callers rely on,
 * not just nudging by `step`.
 *
 * @module components/editor/number-stepper
 */

/** Props for {@link NumberStepper}. */
export interface NumberStepperProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  /** Accessible name for the input and the increase/decrease buttons, e.g. "Padding". */
  ariaLabel: string
  /** Unit shown after the input, e.g. "px". Omitted for a bare number. */
  suffix?: string
}

/** Decrease / editable value / increase, one 32px-tall control. */
export function NumberStepper({ value, min, max, step, onChange, ariaLabel, suffix }: NumberStepperProps) {
  return (
    <div className="inline-flex items-center border border-border rounded-control h-8">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-5 h-full text-text-muted hover:text-text hover:bg-gray-50 transition cursor-pointer text-body"
        aria-label={`Decrease ${ariaLabel}`}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        aria-label={ariaLabel}
        className="w-8 h-full text-body text-center bg-transparent text-text outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix ? <span className="pr-1.5 text-body text-text-muted">{suffix}</span> : null}
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-5 h-full text-text-muted hover:text-text hover:bg-gray-50 transition cursor-pointer text-body"
        aria-label={`Increase ${ariaLabel}`}
      >
        +
      </button>
    </div>
  )
}
