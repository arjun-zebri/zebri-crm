/**
 * Header for the couple Automations tab.
 *
 * Left: an at-a-glance summary strip (active / waiting / failed-30d).
 * Right: "Run automation" (manual fire) + "Pause all" (when live).
 * Pure presentation — the orchestrator owns the data and callbacks.
 *
 * @module app/(dashboard)/couples/couple-automations-header
 */
'use client'

import { Play } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { RunSummary } from './couple-automations-data'

interface Props {
  summary: RunSummary
  hasLive: boolean
  pausing: boolean
  onRun: () => void
  onPauseAll: () => void
}

/** Summary counts + primary actions for the tab. */
export function CoupleAutomationsHeader({ summary, hasLive, pausing, onRun, onPauseAll }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="text-xs text-text-subtle">
        <span className="text-text-muted">{summary.active}</span> active ·{' '}
        <span className="text-text-muted">{summary.waiting}</span> waiting
        {summary.failedRecently > 0 && (
          <>
            {' · '}
            <span className="text-danger">{summary.failedRecently} failed</span> (30d)
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onRun} className="cursor-pointer gap-1.5">
          <Play size={13} strokeWidth={1.5} /> Run automation
        </Button>
        {hasLive && (
          <Button variant="ghost" size="sm" loading={pausing} onClick={onPauseAll} className="cursor-pointer">
            Pause all
          </Button>
        )}
      </div>
    </div>
  )
}
