'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Check } from 'lucide-react'
import { useState } from 'react'

export type GroupByMode = 'status' | 'date' | 'couple' | 'priority' | 'custom' | 'none'

const LABELS: Record<GroupByMode, string> = {
  status: 'Status',
  date: 'Date',
  couple: 'Couple',
  priority: 'Priority',
  custom: 'Custom',
  none: 'None',
}

const ORDER: GroupByMode[] = ['status', 'date', 'couple', 'priority', 'custom', 'none']

interface GroupByToggleProps {
  value: GroupByMode
  onChange: (v: GroupByMode) => void
}

export function GroupByToggle({ value, onChange }: GroupByToggleProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 border border-border rounded-control px-2 py-2 text-caption text-text-muted hover:bg-gray-50 transition whitespace-nowrap cursor-pointer">
          <span className="text-text-subtle">Group by</span>
          <span className="text-gray-700">{LABELS[value]}</span>
          <ChevronDown size={10} strokeWidth={1.5} className="text-text-subtle shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-surface border border-border rounded-control shadow-lg py-1 z-[70] min-w-32"
          sideOffset={4}
          align="end"
        >
          {ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                onChange(mode)
                setOpen(false)
              }}
              className={`w-full text-left px-2.5 py-1.5 text-caption flex items-center justify-between transition ${
                value === mode ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {LABELS[mode]}
              {value === mode && <Check size={12} strokeWidth={2} className="text-green-600" />}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
