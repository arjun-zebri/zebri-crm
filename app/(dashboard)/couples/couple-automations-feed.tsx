/**
 * Activity feed + controls for one automation's runs against a couple.
 *
 * Renders the group-level Pause / Resume controls and maps each run
 * to a {@link RunRow} (its narrated step timeline + Retry/Cancel).
 * The per-step narration comes from `automation_audit_log` via
 * {@link narrateAuditEntry}; this is what replaces the old read-only
 * run log — the MC sees what each automation did *and* can intervene.
 *
 * @module app/(dashboard)/couples/couple-automations-feed
 */
'use client'

import { Pause, Play } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Narration } from '@/lib/automations/audit-log/narrate'
import type { RunStatus } from '@/types/automations'

import { RunRow } from './couple-automations-run-row'

/** One narrated audit row with its timestamp. */
export interface FeedLine extends Narration {
  id: string
  at: string
}

/** A run plus its narrated activity lines (oldest first). */
export interface RunActivity {
  runId: string
  status: RunStatus
  startedAt: string
  completedAt: string | null
  /** Next scheduled step time, for a `waiting` run (else null). */
  wakeAt: string | null
  lines: FeedLine[]
}

/** Control callbacks — each awaits the action + a data reload. */
export interface FeedControls {
  onRetry: (runId: string) => Promise<void>
  onCancel: (runId: string) => Promise<void>
  onPause: () => Promise<void>
  onResume: () => Promise<void>
}

interface Props extends FeedControls {
  runs: RunActivity[]
}

const LIVE: ReadonlySet<RunStatus> = new Set<RunStatus>(['running', 'waiting'])

/** The activity timeline + controls for an automation's runs. */
export function CoupleAutomationsFeed({ runs, onRetry, onCancel, onPause, onResume }: Props) {
  // One key at a time is acting; disables that control while it runs.
  const [busy, setBusy] = useState<string | null>(null)

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const hasLive = runs.some((r) => LIVE.has(r.status))
  const hasPaused = runs.some((r) => r.status === 'paused')

  return (
    <div className="ml-8 mt-2 mb-4 pl-4 border-l border-border">
      {(hasLive || hasPaused) && (
        <div className="flex justify-end gap-2 mb-3">
          {hasLive && (
            <Button
              variant="ghost"
              size="sm"
              loading={busy === 'pause'}
              onClick={() => act('pause', onPause)}
              className="cursor-pointer gap-1.5"
            >
              <Pause size={13} strokeWidth={1.5} /> Pause
            </Button>
          )}
          {hasPaused && (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'resume'}
              onClick={() => act('resume', onResume)}
              className="cursor-pointer gap-1.5"
            >
              <Play size={13} strokeWidth={1.5} /> Resume
            </Button>
          )}
        </div>
      )}
      <div className="space-y-5">
        {runs.map((run) => (
          <RunRow
            key={run.runId}
            run={run}
            pending={busy === run.runId}
            onRetry={() => void act(run.runId, () => onRetry(run.runId))}
            onCancel={() => void act(run.runId, () => onCancel(run.runId))}
          />
        ))}
      </div>
    </div>
  )
}
