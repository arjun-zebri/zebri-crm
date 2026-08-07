'use client'

import { Info, type LucideIcon } from 'lucide-react'
import { useId } from 'react'

import { Input, type InputProps } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'

/** Props for {@link LabelledInput}. */
export interface LabelledInputProps extends Omit<InputProps, 'label' | 'id'> {
  label: string
  /** Small muted icon leading the label. */
  icon?: LucideIcon
  /** Hover explanation on an info glyph beside the label. */
  tooltip?: string
}

/**
 * An `Input` with a richer label row: a leading icon and an optional info
 * glyph whose tooltip explains the field (e.g. why the email is read-only).
 *
 * The label stays a real `<label htmlFor>`, so accessibility and
 * `getByLabelText` selectors work exactly as with the plain primitive.
 */
export function LabelledInput({ label, icon: Icon, tooltip, ...rest }: LabelledInputProps) {
  const id = useId()
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={13} strokeWidth={1.5} className="text-text-subtle" aria-hidden />}
        <label htmlFor={id} className="text-body font-medium text-text">
          {label}
        </label>
        {tooltip && (
          <Tooltip label={tooltip} side="top">
            <Info size={12} strokeWidth={1.5} className="text-text-subtle cursor-help" aria-hidden />
          </Tooltip>
        )}
      </div>
      <Input id={id} {...rest} />
    </div>
  )
}
