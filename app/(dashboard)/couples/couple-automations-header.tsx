/**
 * Header for the couple Automations tab.
 *
 * Left: at-a-glance stat chips (active / waiting / failed-30d) with
 * bold counts and a tonal tint when non-zero. Right: the "Run
 * automation" popover + "Pause all" (when live). Pure presentation —
 * the orchestrator owns the data, the run popover, and the callbacks.
 *
 * @module app/(dashboard)/couples/couple-automations-header
 */
'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

import type { RunSummary } from './couple-automations-data'

type ChipTone = 'neutral' | 'warning' | 'danger'

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: 'border-border bg-surface-muted text-text',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
}

/** A bold count + label chip. */
function Stat({ n, label, tone }: { n: number; label: string; tone: ChipTone }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1 ${CHIP_TONE[tone]}`}>
      <span className="text-base font-semibold leading-none">{n}</span>
      <span className="text-xs opacity-80">{label}</span>
    </span>
  )
}

interface Props {
  summary: RunSummary
  hasLive: boolean
  pausing: boolean
  onPauseAll: () => void
  /** The "Run automation" popover trigger. */
  runPicker: ReactNode
}

/** Summary chips + primary actions for the tab. */
export function CoupleAutomationsHeader({ summary, hasLive, pausing, onPauseAll, runPicker }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <Stat n={summary.active} label="active" tone="neutral" />
        <Stat n={summary.waiting} label="waiting" tone={summary.waiting > 0 ? 'warning' : 'neutral'} />
        {summary.failedRecently > 0 && <Stat n={summary.failedRecently} label="failed" tone="danger" />}
      </div>
      <div className="flex items-center gap-2">
        {runPicker}
        {hasLive && (
          <Button variant="ghost" size="sm" loading={pausing} onClick={onPauseAll} className="cursor-pointer">
            Pause all
          </Button>
        )}
      </div>
    </div>
  )
}
