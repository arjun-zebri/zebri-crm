'use client'

/**
 * The one row layout every Global style control sits in: a muted label on
 * the left, the control on the right, 32px minimum so a pill and a
 * stepper line up in the same column. Shared by the Page and Text tabs
 * so the two never drift apart.
 *
 * @module features/proposals/editor/global-style/global-style-field
 */
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

/** Props for {@link GlobalStyleField}. */
export interface GlobalStyleFieldProps {
  label: string
  children: ReactNode
  /** Label above the control instead of beside it: for a pill with more stops than fit next to a label at the popover's width. */
  stack?: boolean
}

/** Label + control row. */
export function GlobalStyleField({ label, children, stack = false }: GlobalStyleFieldProps) {
  if (stack) {
    return (
      <div className="flex flex-col gap-1.5 py-1.5">
        <span className="text-body text-text-muted">{label}</span>
        <div className="flex min-w-0 items-center gap-1">{children}</div>
      </div>
    )
  }
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-body text-text-muted">{label}</span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>
  )
}

/** Props for {@link SwatchTrigger}. */
export interface SwatchTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'ref'> {
  color: string
  label: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * A colour swatch button for a `ColorPopover` trigger: the current colour
 * in a small square. The hex value only shows once the picker is open (in
 * its own hex input), not on this closed trigger.
 *
 * Forwards `ref` and the rest of its props to the `<button>` because
 * `ColorPopover` renders this as a Radix `Popover.Trigger asChild` child -
 * Radix clones its open/close handlers and `data-state` onto this element,
 * and they are lost if this component doesn't pass them through.
 */
export function SwatchTrigger({ color, label, ref, ...props }: SwatchTriggerProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-emphasis hover:text-text"
      {...props}
    >
      <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: color }} />
    </button>
  )
}
