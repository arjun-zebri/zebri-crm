/**
 * Run history drawer for the automation canvas.
 *
 * Answers "did this automation run, and where did it error?" — the
 * canvas itself only shows the *design*, never what happened at
 * runtime. Opened from the "Runs" button in {@link CanvasHeader},
 * it slides over the right edge and lists the most recent
 * `automation_runs` for this automation (RLS-scoped read), each with
 * its status, when it started, and the couple it ran for. For an
 * errored run it surfaces the failure inline: the step that failed
 * (resolved from `current_action_id` against the canvas actions) plus
 * the `error_message` the runner recorded.
 *
 * Read-only — no mutations. A full per-step audit timeline (from
 * `automation_audit_log`) is a natural follow-up; this first cut
 * pins down the error so it's no longer invisible.
 *
 * @module app/(dashboard)/automations/[id]/runs-panel
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'

import { StatePill } from '@/components/ui/state-pill'
import { friendlyRunError } from '@/lib/automations/config-errors'
import { createClient } from '@/lib/supabase/client'
import {
  RUN_STATUS_LABELS,
  type AutomationActionRow,
  type RunStatus,
} from '@/types/automations'

import { relativePast } from '../relative-time'

interface Props {
  automationId: string
  /** Canvas actions — used to name the step a run failed on. */
  actions: AutomationActionRow[]
  open: boolean
  onClose: () => void
}

interface RunRow {
  id: string
  status: RunStatus
  started_at: string
  completed_at: string | null
  error_message: string | null
  current_action_id: string | null
  couples: { name: string } | { name: string }[] | null
}

const RUN_TONE: Record<RunStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  running: 'neutral',
  waiting: 'warning',
  paused: 'warning',
  completed: 'success',
  errored: 'danger',
  cancelled: 'neutral',
}

function coupleNameOf(couples: RunRow['couples']): string | null {
  const c = Array.isArray(couples) ? couples[0] : couples
  return c?.name ?? null
}

function humanizeType(type: string): string {
  return type.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase())
}

export function RunHistoryPanel({ automationId, actions, open, onClose }: Props) {
  const supabase = createClient()

  const stepLabel = (actionId: string | null): string | null => {
    if (!actionId) return null
    const a = actions.find((x) => x.id === actionId)
    if (!a) return null
    return a.label ?? humanizeType(a.type)
  }

  const { data: runs, isLoading } = useQuery({
    enabled: open,
    queryKey: ['automation-runs', automationId],
    queryFn: async (): Promise<RunRow[]> => {
      const { data, error } = await supabase
        .from('automation_runs' as never)
        .select(
          'id, status, started_at, completed_at, error_message, current_action_id, couples(name)',
        )
        .eq('automation_id', automationId)
        .order('started_at', { ascending: false })
        .limit(25)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as RunRow[]
    },
  })

  if (!open) return null

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-96 max-w-full flex-col border-l border-border bg-surface shadow-xl">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-body font-semibold text-text">Run history</h2>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 text-text-muted hover:text-text"
          aria-label="Close run history"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <p className="text-body text-text-muted">Loading runs…</p>
        ) : !runs || runs.length === 0 ? (
          <p className="text-body text-text-muted">
            No runs yet. This automation hasn’t fired for any couple — once
            it does, every run shows here with its outcome.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="rounded-control border border-border bg-card px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatePill
                    tone={RUN_TONE[run.status]}
                    label={RUN_STATUS_LABELS[run.status]}
                    dot="filled"
                  />
                  <span className="text-body text-text-muted">
                    {relativePast(run.started_at)}
                  </span>
                </div>

                <p className="mt-1.5 text-body text-text-muted">
                  {coupleNameOf(run.couples) ?? 'No couple linked'}
                </p>

                {run.status === 'errored' ? (
                  <div className="mt-2 rounded-control bg-danger/10 px-2.5 py-2 text-body text-danger">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle size={12} strokeWidth={1.5} />
                      {stepLabel(run.current_action_id)
                        ? `Failed at: ${stepLabel(run.current_action_id)}`
                        : 'Failed'}
                    </div>
                    {run.error_message ? (
                      <p className="mt-1 break-words text-danger/90">
                        {friendlyRunError(run.error_message)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
