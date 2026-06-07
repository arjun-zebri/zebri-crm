/**
 * Couple Profile → Automations sub-tab.
 *
 * Shows every automation_run touching this couple - what fired,
 * what's currently waiting, what completed. The "Pause all"
 * action flips every running / waiting run for this couple to
 * paused; useful when a booking is cancelled or the MC needs to
 * intervene manually.
 *
 * @module app/(dashboard)/couples/couple-automations
 */
'use client'

import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Empty } from '@/components/ui/empty'
import { Loading } from '@/components/ui/loading'
import { StatePill } from '@/components/ui/state-pill'
import { createClient } from '@/lib/supabase/client'
import type { AutomationRunRow, RunStatus } from '@/types/automations'
import { RUN_STATUS_LABELS } from '@/types/automations'

import { pauseCoupleRunsAction } from '../automations/actions'

interface RunWithAutomation extends AutomationRunRow {
  automation: { id: string; name: string; trigger_type: string } | null
}

interface Props {
  coupleId: string
}

const STATUS_TONE: Record<RunStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  running: 'info',
  waiting: 'warning',
  paused: 'warning',
  completed: 'success',
  errored: 'danger',
  cancelled: 'neutral',
}

export function CoupleAutomations({ coupleId }: Props) {
  const [runs, setRuns] = useState<RunWithAutomation[] | null>(null)
  const [pausing, setPausing] = useState(false)

  function load() {
    const supabase = createClient()
    supabase
      .from('automation_runs' as never)
      .select('*, automation:automations(id, name, trigger_type)')
      .eq('couple_id', coupleId)
      .order('started_at', { ascending: false })
      .then(({ data }) => {
        setRuns((data as RunWithAutomation[] | null) ?? [])
      })
  }

  useEffect(() => {
    load()
  }, [coupleId])

  async function pauseAll() {
    if (!confirm('Pause every running automation for this couple?')) return
    setPausing(true)
    await pauseCoupleRunsAction({ coupleId })
    setPausing(false)
    load()
  }

  if (runs === null) return <Loading variant="center" />

  const hasLive = runs.some((r) => r.status === 'running' || r.status === 'waiting')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles size={20} strokeWidth={1.5} className="text-brand" />
          Automations
        </h2>
        {hasLive && (
          <button
            onClick={pauseAll}
            disabled={pausing}
            className="text-xs px-3 py-1.5 rounded-md bg-surface-muted hover:bg-surface text-text-muted hover:text-text transition cursor-pointer disabled:opacity-50"
          >
            {pausing ? 'Pausing…' : 'Pause all'}
          </button>
        )}
      </div>

      {runs.length === 0 ? (
        <Empty
          icon={Sparkles}
          title="No automations have run for this couple yet"
          description="When one of your active automations matches this couple, you'll see what fired here."
        />
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border bg-surface">
          {runs.map((run) => (
            <div key={run.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{run.automation?.name ?? 'Automation'}</span>
                  <StatePill tone={STATUS_TONE[run.status]} label={RUN_STATUS_LABELS[run.status]} />
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  Started {new Date(run.started_at).toLocaleString('en-AU')}
                  {run.completed_at ? ` · completed ${new Date(run.completed_at).toLocaleString('en-AU')}` : ''}
                </div>
                {run.error_message && (
                  <div className="text-xs text-danger mt-0.5">{run.error_message}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
