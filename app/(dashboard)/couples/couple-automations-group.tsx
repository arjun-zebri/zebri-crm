/**
 * One automation's card in the couple Automations tab.
 *
 * Collapsed: a calm card leading with a trigger icon, the automation
 * title + a plain-English trigger description, and a status pill —
 * with a metadata strip underneath (last run · run count · most recent
 * outcome) drawn from this couple's runs. Expanded: the
 * {@link CoupleAutomationsFeed} for this couple. Split out of the
 * orchestrator to keep it a thin fetch-and-compose shell.
 *
 * @module app/(dashboard)/couples/couple-automations-group
 */
'use client'

import { ChevronDown, Zap } from 'lucide-react'

import { StatePill } from '@/components/ui/state-pill'
import { formatRelativeTime } from '@/lib/utils'
import { RUN_STATUS_LABELS } from '@/types/automations'

import type { AutomationGroup } from './couple-automations-data'
import { CoupleAutomationsFeed } from './couple-automations-feed'
import { STATUS_TONE } from './couple-automations-shared'

interface Props {
  group: AutomationGroup
  /** Fetch time (ms) — the clock for the "last run" relative label. */
  nowMs: number
  open: boolean
  onToggle: () => void
  onRetry: (runId: string) => Promise<void>
  onCancel: (runId: string) => Promise<void>
  onPause: (automationId: string) => Promise<void>
  onResume: (automationId: string) => Promise<void>
}

/** One labelled cell in the metadata strip. */
function Meta({ label, value, align = 'left' }: { label: string; value: string; align?: 'left' | 'right' }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <p className="text-body text-text-subtle">{label}</p>
      <p className="text-body text-text truncate mt-0.5">{value}</p>
    </div>
  )
}

/** Collapsed summary card + expandable activity feed for one automation. */
export function AutomationGroupRow({
  group,
  nowMs,
  open,
  onToggle,
  onRetry,
  onCancel,
  onPause,
  onResume,
}: Props) {
  const runCount = group.runs.length
  const subtitle = group.triggerDescription || group.triggerLabel
  return (
    <div className="rounded-control border border-border bg-card">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left cursor-pointer"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-muted">
          <Zap size={15} strokeWidth={1.5} className="text-text-subtle" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium text-text truncate">{group.title}</p>
          {subtitle && <p className="text-body text-text-muted truncate mt-0.5">{subtitle}</p>}
        </div>
        <StatePill tone={STATUS_TONE[group.headline]} label={RUN_STATUS_LABELS[group.headline]} className="shrink-0" />
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`mt-0.5 text-text-subtle shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className="px-4 pb-3.5">
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
          <Meta label="Last run" value={formatRelativeTime(group.lastRunAt, nowMs) || '—'} />
          <Meta label="Runs" value={runCount === 1 ? '1 run' : `${runCount} runs`} align="right" />
        </div>
      </div>
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
