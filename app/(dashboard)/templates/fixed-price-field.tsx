/**
 * The "one price for the whole thing" input shared by the package and
 * invoice template forms when they are priced as a single figure.
 *
 * @module app/(dashboard)/templates/fixed-price-field
 */
'use client'

import { noArrowsClass } from './line-items-editor'

/** Boxed `$` price input, matching the Input primitive's height and border. */
export function FixedPriceField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  /** Raw input text; parsed by the owning form. */
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="mt-3 max-w-[220px]">
      <label htmlFor={id} className="block text-body font-medium text-text">
        {label}
      </label>
      <div className="mt-1 flex h-8 items-center rounded-control border border-border bg-surface px-2.5 transition-colors focus-within:border-brand-fg">
        <span className="pr-1 text-body text-text-muted">$</span>
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          disabled={disabled}
          className={`w-full bg-transparent text-body tabular-nums text-text placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${noArrowsClass}`}
        />
      </div>
    </div>
  )
}
