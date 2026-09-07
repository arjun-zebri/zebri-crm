/**
 * Trigger picker popover.
 *
 * Opens when the user clicks the trigger card on the canvas.
 * Lists every trigger in the registry via the shared command
 * palette. Picking one updates the automation and closes.
 *
 * When an apply rule is currently set, a "Remove this rule" footer
 * resets the automation back to the unset placeholder.
 *
 * @module app/(dashboard)/workflows/[id]/apply-rule-picker
 */
'use client'

import { Trash2 } from 'lucide-react'

import { isTriggerLaunchVisible } from '@/lib/automations/launch-catalogue'
import { getTriggerSpec, triggerRegistry } from '@/lib/automations/triggers'
import { TRIGGER_CATEGORIES, type TriggerType } from '@/types/automations'

import { setApplyRuleAction } from '../actions'

import { CommandPalette, type PaletteAnchor, type PaletteItem } from './command-palette'
import { getLucideIcon } from './lucide-lookup'

interface Props {
  templateId: string
  currentTrigger: TriggerType | 'unset'
  anchor: PaletteAnchor
  onClose: () => void
  onPicked: (next: TriggerType | 'unset') => void
}

export function TriggerPicker({ templateId, currentTrigger, anchor, onClose, onPicked }: Props) {
  // Only surface triggers that actually fire today. The registry
  // carries the full catalogue (incl. un-wired + Phase-14b types);
  // the launch allowlist hides dead tiles. A currently-set trigger
  // stays listed even if hidden, so an automation built before a
  // type was hidden still shows its trigger rather than a blank.
  const items: PaletteItem[] = Object.values(triggerRegistry)
    .filter((spec) => isTriggerLaunchVisible(spec.type) || spec.type === currentTrigger)
    .map((spec) => ({
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
    // Seed the config with the trigger's Zod-schema defaults so
    // downstream consumers (the time-emitter, the dispatcher's
    // match() narrowing) see the same values the inspector would
    // render. Without this, picking "Quote due" with no further
    // edits left config as `{}` — and the emitter then skipped the
    // automation because `days` was missing rather than 0.
    const spec = getTriggerSpec(id as TriggerType)
    const defaults = spec ? (spec.configSchema.safeParse({}).data ?? {}) : {}
    void setApplyRuleAction({
      templateId,
      applyRuleType: id,
      applyRuleConfig: defaults as Record<string, unknown>,
    })
  }

  function remove() {
    onPicked('unset')
    void setApplyRuleAction({
      templateId,
      applyRuleType: 'unset',
      applyRuleConfig: {},
    })
  }

  const showRemove = currentTrigger !== 'unset'

  return (
    <CommandPalette
      title="When does this apply?"
      placeholder="Find a rule…"
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
            className="w-full text-left px-3 py-3 flex items-center gap-3 text-body text-red-600 hover:bg-red-50 cursor-pointer transition"
          >
            <Trash2 size={14} strokeWidth={1.5} className="shrink-0 text-red-500" />
            Remove this rule
          </button>
        ) : null
      }
    />
  )
}
