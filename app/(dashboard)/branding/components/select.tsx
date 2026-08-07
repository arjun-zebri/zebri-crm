'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export interface SelectOption<V extends string = string> {
  value: V
  label: string
  meta?: string
  fontFamily?: string
}

interface SelectProps<V extends string> {
  value: V
  options: SelectOption<V>[]
  onChange: (v: V) => void
  /** Optional custom label renderer (e.g. render font names in their own
   *  typeface). Falls back to the plain label. */
  renderLabel?: (option: SelectOption<V>) => React.ReactNode
  className?: string
  size?: 'xs' | 'sm' | 'md'
  align?: 'start' | 'end'
  placeholder?: string
}

export function Select<V extends string>({
  value,
  options,
  renderLabel,
  onChange,
  className = '',
  size = 'sm',
  align = 'start',
  placeholder,
}: SelectProps<V>) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  const triggerSize = size === 'xs' ? 'px-2.5 h-8 text-body' : size === 'sm' ? 'px-2.5 py-1.5 text-body' : 'px-3 py-2 text-body'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-between gap-1.5 border border-border rounded-control ${triggerSize} bg-surface text-left text-text hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-border-strong cursor-pointer w-full transition ${className}`}
          style={selected?.fontFamily ? { fontFamily: selected.fontFamily } : undefined}
        >
          <span className="truncate flex-1">
            {selected ? (renderLabel ? renderLabel(selected) : selected.label) : <span className="text-text-subtle">{placeholder ?? 'Select…'}</span>}
          </span>
          <ChevronDown size={12} strokeWidth={2} className="text-text-subtle shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={4}
          className="bg-surface border border-border rounded-control shadow-xl p-1 z-[60] animate-modal-in"
          style={{
            minWidth: 'var(--radix-popover-trigger-width)',
            maxHeight: 'min(360px, var(--radix-popover-content-available-height))',
            overflowY: 'auto',
          }}
        >
          {options.map(opt => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-control text-body hover:bg-gray-50 cursor-pointer ${
                  active ? 'text-text' : 'text-gray-600'
                }`}
                style={opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined}
              >
                <span className="flex-1 text-left truncate">{renderLabel ? renderLabel(opt) : opt.label}</span>
                {opt.meta && (
                  <span className="text-[11px] text-text-subtle" style={opt.fontFamily ? { fontFamily: 'inherit' } : undefined}>
                    {opt.meta}
                  </span>
                )}
                {active && <Check size={12} strokeWidth={2.5} className="text-text shrink-0" />}
              </button>
            )
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
