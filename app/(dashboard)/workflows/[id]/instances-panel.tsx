/**
 * "Applied to" drawer for the workflow canvas.
 *
 * Answers "is this workflow running anywhere, and where did it break?" -
 * the canvas itself only shows the design, never what happened once it
 * was applied. Opened from the "Applied to" button in
 * {@link CanvasHeader}, it slides over the right edge and lists the most
 * recent instances of this template (RLS-scoped read), each with its
 * status, when it was applied, and the couple it is running for. For an
 * errored instance it surfaces the failure inline: the step that failed
 * plus the error message the executor recorded.
 *
 * Read-only, no mutations. Working a live instance happens on the
 * couple's Workflow tab, which is where the MC already is.
 *
 * @module app/(dashboard)/workflows/[id]/instances-panel
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'

import { StatePill } from '@/components/ui/state-pill'
import { friendlyRunError } from '@/lib/automations/config-errors'
import { createClient } from '@/lib/supabase/client'
import type { InstanceStatus } from '@/types/workflows'

import { relativePast } from '../relative-time'

interface Props {
  templateId: string
  open: boolean
  onClose: () => void
}

/** A step that stopped an instance, for the inline failure line. */
interface FailedStep {
  title: string
  status: string
  error_message: string | null
}

interface InstanceRow {
  id: string
  status: InstanceStatus
  applied_at: string
  completed_at: string | null
  error_message: string | null
  couples: { name: string } | { name: string }[] | null
  workflow_steps: FailedStep[] | null
}

const STATUS_LABEL: Record<InstanceStatus, string> = {
  active: 'Running',
  completed: 'Finished',
  cancelled: 'Stopped',
}

const STATUS_TONE: Record<InstanceStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'neutral',
  completed: 'success',
  cancelled: 'neutral',
}

function coupleNameOf(couples: InstanceRow['couples']): string | null {
  const c = Array.isArray(couples) ? couples[0] : couples
  return c?.name ?? null
}

/**
 * The step that broke, if any. An instance stays `active` with a broken
 * step in it (a workflow with a failed step has not finished), so the
 * failure has to be read off the steps, not off the instance status.
 */
function failedStepOf(instance: InstanceRow): FailedStep | null {
  return (instance.workflow_steps ?? []).find((s) => s.status === 'errored') ?? null
}

export function RunHistoryPanel({ templateId, open, onClose }: Props) {
  const supabase = createClient()

  const { data: runs, isLoading } = useQuery({
    enabled: open,
    queryKey: ['workflow-instances', templateId],
    queryFn: async (): Promise<InstanceRow[]> => {
      // An applied instance IS the run in this model, so this reads
      // instances rather than a separate run table. The nested steps are
      // filtered to errored ones so a long workflow does not drag its
      // whole checklist into the drawer.
      const { data, error } = await supabase
        .from('workflow_instances')
        .select(
          'id, status, applied_at, completed_at, error_message, couples(name), workflow_steps(title, status, error_message)',
        )
        .eq('template_id', templateId)
        .eq('workflow_steps.status', 'errored')
        .order('applied_at', { ascending: false })
        .limit(25)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as InstanceRow[]
    },
  })

  if (!open) return null

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-96 max-w-full flex-col border-l border-border bg-surface shadow-xl">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-body font-semibold text-text">Applied to</h2>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 text-text-muted hover:text-text"
          aria-label="Close applied-to panel"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <p className="text-body text-text-muted">Loading…</p>
        ) : !runs || runs.length === 0 ? (
          <p className="text-body text-text-muted">
            Not applied yet. Once this workflow runs for a couple, every
            couple it is applied to shows here with how it is going.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => {
              const failed = failedStepOf(run)
              const message = failed?.error_message ?? run.error_message
              return (
                <li
                  key={run.id}
                  className="rounded-control border border-border bg-card px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatePill
                      tone={failed ? 'danger' : STATUS_TONE[run.status]}
                      label={failed ? 'Failed' : STATUS_LABEL[run.status]}
                      dot="filled"
                    />
                    <span className="text-body text-text-muted">
                      {relativePast(run.applied_at)}
                    </span>
                  </div>

                  <p className="mt-1.5 text-body text-text-muted">
                    {coupleNameOf(run.couples) ?? 'No couple linked'}
                  </p>

                  {failed || message ? (
                    <div className="mt-2 rounded-control bg-danger/10 px-2.5 py-2 text-body text-danger">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle size={12} strokeWidth={1.5} />
                        {failed ? `Failed at: ${failed.title}` : 'Failed'}
                      </div>
                      {message ? (
                        <p className="mt-1 break-words text-danger/90">
                          {friendlyRunError(message)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
