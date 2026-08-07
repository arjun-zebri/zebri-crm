'use client'

import type { ReactNode } from 'react'

/**
 * Canonical checkbox primitive.
 *
 * Built as a custom `<button role="checkbox">` (not a native
 * `<input type="checkbox">`) per the design system — native
 * checkboxes render with platform chrome that ignores our tokens.
 * Matches the row-selection checkbox spec in
 * `.claude/docs/frontend-design.md` (§Checkboxes): emerald fill when
 * checked, white checkmark, gray border otherwise — but always
 * visible, since form contexts have no hover-reveal affordance.
 *
 * @example
 * ```tsx
 * <Checkbox
 *   label="BCC yourself for the paper trail"
 *   checked={config.bccSelf === true}
 *   onChange={(v) => setConfig({ ...config, bccSelf: v })}
 * />
 * ```
 *
 * @module components/ui/checkbox
 */

export interface CheckboxProps {
  /** Controlled checked state. */
  checked: boolean
  /** Change callback with the next checked state. */
  onChange: (checked: boolean) => void
  /** Visible label rendered to the right; clicking it toggles too. */
  label?: ReactNode
  /** Disables the control. */
  disabled?: boolean
  /** Extra classes on the wrapper. */
  className?: string
  /** Accessible name for label-less checkboxes (e.g. per-row ticks). */
  ariaLabel?: string
  /** Checked fill/border colour. Defaults to the app emerald. Branded surfaces
   *  pass the MC's brand colour. */
  color?: string
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
  ariaLabel,
  color,
}: CheckboxProps) {
  // When a colour is supplied, the checked fill/border come from it inline;
  // otherwise fall back to the default emerald class.
  const branded = checked && !disabled && !!color
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={branded ? { backgroundColor: color, borderColor: color } : undefined}
      className={`shrink-0 w-4 h-4 rounded-control border transition flex items-center justify-center ${
        disabled
          ? 'border-border bg-gray-50 cursor-not-allowed'
          : checked
            ? branded
              ? 'cursor-pointer'
              : 'bg-emerald-500 border-emerald-500 cursor-pointer'
            : 'bg-surface border-border-strong hover:border-gray-500 cursor-pointer'
      } ${label ? '' : (className ?? '')}`}
    >
      {checked && <CheckMark />}
    </button>
  )

  if (!label) return box

  return (
    <label
      className={`flex items-center gap-3 select-none ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      } ${className ?? ''}`}
    >
      {box}
      <span className={`text-body ${disabled ? 'text-text-subtle' : 'text-text'}`}>
        {label}
      </span>
    </label>
  )
}

/**
 * The standard white checkmark used by selection checkboxes across
 * the app (tasks list, couples list). Inlined here rather than
 * imported so the primitive doesn't depend on page-level modules.
 */
function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 5.2L4 7.2L8 3"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
