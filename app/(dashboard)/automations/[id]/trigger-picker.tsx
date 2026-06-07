/**
 * Trigger picker popover.
 *
 * Opens when the user clicks the trigger card on the canvas.
 * Lists every trigger in the registry via the shared command
 * palette. Picking one updates the automation and closes.
 *
 * When a trigger is currently set, a "Remove trigger" footer
 * resets the automation back to the unset placeholder.
 *
 * @module app/(dashboard)/automations/[id]/trigger-picker
 */
'use client'

import { Trash2 } from 'lucide-react'

import { triggerRegistry } from '@/lib/automations/triggers'
import { TRIGGER_CATEGORIES, type TriggerType } from '@/types/automations'

import { setAutomationTriggerAction } from '../actions'
import { CommandPalette, type PaletteAnchor, type PaletteItem } from './command-palette'
import { getLucideIcon } from './lucide-lookup'

interface Props {
  automationId: string
  currentTrigger: TriggerType | 'unset'
  anchor: PaletteAnchor
  onClose: () => void
  onPicked: (next: TriggerType | 'unset') => void
}

export function TriggerPicker({ automationId, currentTrigger, anchor, onClose, onPicked }: Props) {
  const items: PaletteItem[] = Object.values(triggerRegistry).map((spec) => ({
    id: spec.type,
    group: spec.ui.category,
    label: spec.ui.label,
    description: spec.ui.description,
    icon: getLucideIcon(spec.ui.icon),
    active: spec.type === currentTrigger,
  }))

  function pick(id: string) {
    // Optimistic: paint the UI change immediately, fire the server
    // action in the background. Matches the Notion / tasks pattern -
    // the network round-trip never blocks the picker → drawer flow.
    onPicked(id as TriggerType)
    void setAutomationTriggerAction({
      automationId,
      triggerType: id,
      triggerConfig: {},
    })
  }

  function remove() {
    onPicked('unset')
    void setAutomationTriggerAction({
      automationId,
      triggerType: 'unset',
      triggerConfig: {},
    })
  }

  const showRemove = currentTrigger !== 'unset'

  return (
    <CommandPalette
      title="Choose a trigger"
      placeholder="Find a trigger…"
      items={items}
      groupOrder={TRIGGER_CATEGORIES}
      anchor={anchor}
      onClose={onClose}
      onPick={pick}
      footer={
        showRemove ? (
          <button
            type="button"
            onClick={remove}
            className="w-full text-left px-3 py-3 flex items-center gap-3 text-sm text-red-600 hover:bg-red-50 cursor-pointer transition"
          >
            <Trash2 size={14} strokeWidth={1.5} className="shrink-0 text-red-500" />
            Remove trigger
          </button>
        ) : null
      }
    />
  )
}
