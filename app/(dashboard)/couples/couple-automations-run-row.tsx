/**
 * One run in the couple Automations activity feed.
 *
 * Renders a run's header (time + status pill + Retry/Cancel control)
 * and its narrated step lines. Split out of
 * {@link CoupleAutomationsFeed} to keep both files within the
 * component-size budget; the feed owns the busy state and binds the
 * control callbacks per run.
 *
 * @module app/(dashboard)/couples/couple-automations-run-row
 */
'use client'

import { AlertTriangle, Ban, Check, Clock, MinusCircle, Pause } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatePill } from '@/components/ui/state-pill'
import type { Narration } from '@/lib/automations/audit-log/narrate'
import type { RunStatus } from '@/types/automations'
import { RUN_STATUS_LABELS } from '@/types/automations'

import type { RunActivity } from './couple-automations-feed'
import { STATUS_TONE } from './couple-automations-shared'

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

const CANCELLABLE: ReadonlySet<RunStatus> = new Set<RunStatus>(['waiting', 'paused'])

/** '2026-06-10T13:37:48Z' → '10 Jun, 11:37 pm' (viewer-local). */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface Props {
  run: RunActivity
  /** This run's control is mid-flight — disables Retry/Cancel. */
  pending: boolean
  onRetry: () => void
  onCancel: () => void
}

/** A single run's header + narrated activity lines. */
export function RunRow({ run, pending, onRetry, onCancel }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs text-text-muted">{formatTime(run.startedAt)}</p>
        <StatePill tone={STATUS_TONE[run.status]} label={RUN_STATUS_LABELS[run.status]} />
        <div className="flex-1" />
        {run.status === 'errored' && (
          <Button variant="ghost" size="sm" loading={pending} onClick={onRetry} className="cursor-pointer">
            Retry
          </Button>
        )}
        {run.blockedMissingVars && (
          <Button variant="ghost" size="sm" loading={pending} onClick={onRetry} className="cursor-pointer text-brand">
            Fix &amp; retry
          </Button>
        )}
        {CANCELLABLE.has(run.status) && (
          <Button
            variant="ghost"
            size="sm"
            loading={pending}
            onClick={onCancel}
            className="cursor-pointer text-text-muted"
          >
            Cancel
          </Button>
        )}
      </div>
      {run.status === 'waiting' && run.wakeAt && (
        <p className="flex items-center gap-2 text-xs text-warning">
          <Clock size={14} strokeWidth={1.5} className="shrink-0" />
          Next step {formatTime(run.wakeAt)}
        </p>
      )}
      {run.lines.length > 0 && (
        <ul className="space-y-1.5">
          {run.lines.map((line) => {
            const Icon = ICONS[line.icon] ?? Check
            return (
              <li key={line.id} className="flex items-start gap-2">
                <Icon size={14} strokeWidth={1.5} className={`${TONE_COLOR[line.tone]} shrink-0 mt-0.5`} />
                <span className="text-xs text-text-muted flex-1 min-w-0">{line.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
