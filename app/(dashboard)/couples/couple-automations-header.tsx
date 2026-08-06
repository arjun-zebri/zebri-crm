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

type ChipKind = 'active' | 'waiting' | 'failed'

/** Status dot colour per stat — gives the count a calm highlight. */
const DOT: Record<ChipKind, string> = {
  active: 'bg-success',
  waiting: 'bg-warning',
  failed: 'bg-danger',
}

/** A soft pill: status dot + bold count + label. */
function Stat({ n, label, kind }: { n: number; label: string; kind: ChipKind }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-control bg-surface-muted px-3 py-1.5">
      <span className={`h-1.5 w-1.5 rounded-pill ${DOT[kind]}`} />
      <span className="text-body font-semibold text-text tabular-nums">{n}</span>
      <span className="text-caption text-text-muted">{label}</span>
    </span>
  )
}

interface Props {
  summary: RunSummary
  hasLive: boolean
  pausing: boolean
  onPauseAll: () => void
  /** The Test + Run automation popover triggers. */
  actions: ReactNode
}

/** Summary chips + primary actions for the tab. */
export function CoupleAutomationsHeader({ summary, hasLive, pausing, onPauseAll, actions }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <Stat n={summary.active} label="active" kind="active" />
        <Stat n={summary.waiting} label="waiting" kind="waiting" />
        {summary.failedRecently > 0 && <Stat n={summary.failedRecently} label="failed" kind="failed" />}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {hasLive && (
          <Button variant="ghost" size="sm" loading={pausing} onClick={onPauseAll} className="cursor-pointer">
            Pause all
          </Button>
        )}
      </div>
    </div>
  )
}
