'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Check } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MenuItem, MenuPanel } from '@/components/ui/menu'

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
        <Button variant="outline" className="whitespace-nowrap">
          <span className="text-text-subtle">Group by</span>
          <span>{LABELS[value]}</span>
          <ChevronDown size={10} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Positioning stays here; the panel's own chrome comes from MenuPanel. */}
        <Popover.Content className="z-[70]" sideOffset={4} align="end">
          <MenuPanel>
            {ORDER.map((mode) => (
              <MenuItem
                key={mode}
                size="sm"
                selected={value === mode}
                onClick={() => {
                  onChange(mode)
                  setOpen(false)
                }}
                trailing={
                  value === mode ? (
                    <Check size={12} strokeWidth={1.5} className="text-text" />
                  ) : null
                }
              >
                {LABELS[mode]}
              </MenuItem>
            ))}
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
