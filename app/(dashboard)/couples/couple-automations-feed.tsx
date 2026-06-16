/**
 * Activity feed for one automation's runs against a couple.
 *
 * Renders the per-step narration (from `automation_audit_log`, via
 * {@link narrateAuditEntry}) as an outcome-first timeline — "Sent
 * email", "Moved couple to Booked", "Quote follow-up failed — couple
 * has no email" — grouped under each run with its status and time.
 * This is what replaces the old "Started … finished …" run-log rows:
 * the MC sees *what the automation did*, not just that it ran.
 *
 * @module app/(dashboard)/couples/couple-automations-feed
 */
'use client'

import { AlertTriangle, Ban, Check, Clock, MinusCircle, Pause } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { StatePill } from '@/components/ui/state-pill'
import type { Narration } from '@/lib/automations/audit-log/narrate'
import type { RunStatus } from '@/types/automations'
import { RUN_STATUS_LABELS } from '@/types/automations'

import { STATUS_TONE } from './couple-automations-shared'

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
  lines: FeedLine[]
}

/** Narration icon name → lucide component. */
const ICONS: Record<string, LucideIcon> = {
  Check,
  AlertTriangle,
  MinusCircle,
  Clock,
  Ban,
  Pause,
}

/** Tone → token text colour for the line icon. */
const TONE_COLOR: Record<Narration['tone'], string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-text-subtle',
}

/** '2026-06-10T13:37:48Z' → '10 Jun, 11:37 pm' (viewer-local). */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** The activity timeline for an automation's runs against this couple. */
export function CoupleAutomationsFeed({ runs }: { runs: RunActivity[] }) {
  return (
    <div className="ml-8 mt-2 mb-4 pl-4 border-l border-border space-y-5">
      {runs.map((run) => (
        <div key={run.runId} className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-text-muted">{formatTime(run.startedAt)}</p>
            <StatePill tone={STATUS_TONE[run.status]} label={RUN_STATUS_LABELS[run.status]} />
          </div>
          {run.lines.length === 0 ? (
            <p className="text-xs text-text-subtle pl-0.5">No recorded steps for this run.</p>
          ) : (
            <ul className="space-y-1.5">
              {run.lines.map((line) => {
                const Icon = ICONS[line.icon] ?? Check
                return (
                  <li key={line.id} className="flex items-start gap-2">
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      className={`${TONE_COLOR[line.tone]} shrink-0 mt-0.5`}
                    />
                    <span className="text-xs text-text-muted flex-1 min-w-0">{line.text}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
