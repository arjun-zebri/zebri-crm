/**
 * One automation's collapsible row in the couple Automations tab.
 *
 * Collapsed: a single line leading with the most recent **outcome**
 * ("Sent email", "Quote follow-up failed — no email"), or the trigger
 * label when the automation is unnamed, plus a status pill. Expanded:
 * the {@link CoupleAutomationsFeed} for this couple. Split out of the
 * orchestrator to keep it a thin fetch-and-compose shell.
 *
 * @module app/(dashboard)/couples/couple-automations-group
 */
'use client'

import { ChevronDown, Zap } from 'lucide-react'

import { StatePill } from '@/components/ui/state-pill'
import { RUN_STATUS_LABELS } from '@/types/automations'

import type { AutomationGroup } from './couple-automations-data'
import { CoupleAutomationsFeed } from './couple-automations-feed'
import { STATUS_TONE } from './couple-automations-shared'

interface Props {
  group: AutomationGroup
  open: boolean
  onToggle: () => void
  onRetry: (runId: string) => Promise<void>
  onCancel: (runId: string) => Promise<void>
  onPause: (automationId: string) => Promise<void>
  onResume: (automationId: string) => Promise<void>
}

/** Collapsed summary + expandable activity feed for one automation. */
export function AutomationGroupRow({ group, open, onToggle, onRetry, onCancel, onPause, onResume }: Props) {
  const runCount = group.runs.length
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-muted transition text-left border border-transparent hover:border-border cursor-pointer"
      >
        <Zap size={13} strokeWidth={1.5} className="text-text-subtle shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text truncate">{group.title}</p>
          <p className="text-xs text-text-subtle truncate mt-0.5">
            {group.lastOutcome ??
              `${group.triggerLabel ? `${group.triggerLabel} · ` : ''}${runCount === 1 ? '1 run' : `${runCount} runs`}`}
          </p>
        </div>
        <StatePill tone={STATUS_TONE[group.headline]} label={RUN_STATUS_LABELS[group.headline]} className="shrink-0" />
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={`text-text-subtle shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Grid-rows 0fr→1fr animates the reveal without JS height
          measurement; the inner min-h-0 + overflow-hidden is what
          lets the row actually collapse. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <CoupleAutomationsFeed
            runs={group.runs}
            onRetry={onRetry}
            onCancel={onCancel}
            onPause={() => onPause(group.key)}
            onResume={() => onResume(group.key)}
          />
        </div>
      </div>
    </div>
  )
}
