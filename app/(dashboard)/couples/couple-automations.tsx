/**
 * Couple Profile → Automations sub-tab.
 *
 * Automation-centric view: one row per automation that has touched
 * this couple (live ones first), not a flat run log. Each row shows
 * the automation's name, trigger, and current state; clicking it
 * expands the run history for this couple. "Pause all" flips every
 * running / waiting run for the couple to paused; useful when a
 * booking is cancelled or the MC needs to intervene manually.
 *
 * @module app/(dashboard)/couples/couple-automations
 */
'use client'

import { ChevronDown, Sparkles, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Loading } from '@/components/ui/loading'
import { StatePill } from '@/components/ui/state-pill'
import { friendlyRunError } from '@/lib/automations/config-errors'
import { getTriggerSpec } from '@/lib/automations/triggers'
import { createClient } from '@/lib/supabase/client'
import type { AutomationRunRow, RunStatus, TriggerType } from '@/types/automations'
import { RUN_STATUS_LABELS } from '@/types/automations'

import { pauseCoupleRunsAction } from '../automations/actions'

interface RunWithAutomation extends AutomationRunRow {
  automation: { id: string; name: string; trigger_type: string } | null
}

interface Props {
  coupleId: string
}

/** Runs grouped under the automation that produced them. */
interface AutomationGroup {
  key: string
  name: string
  triggerLabel: string
  /** Newest first (query order). */
  runs: RunWithAutomation[]
  /** The status shown on the collapsed row. */
  headline: RunStatus
}

const STATUS_TONE: Record<RunStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  running: 'info',
  waiting: 'warning',
  paused: 'warning',
  completed: 'success',
  errored: 'danger',
  cancelled: 'neutral',
}

/** Live states take priority on the collapsed row, in this order. */
const HEADLINE_PRIORITY: RunStatus[] = ['running', 'waiting', 'paused']

/** '2026-06-10T13:37:48Z' → '10 Jun, 11:37 pm' (viewer-local). */
function formatRunTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Group a started_at-descending run list by automation, live groups first. */
function groupRuns(runs: RunWithAutomation[]): AutomationGroup[] {
  const byAutomation = new Map<string, RunWithAutomation[]>()
  for (const run of runs) {
    const key = run.automation?.id ?? run.automation_id
    byAutomation.set(key, [...(byAutomation.get(key) ?? []), run])
  }
  const groups = [...byAutomation.entries()].map(([key, groupRuns]) => {
    const first = groupRuns[0] as RunWithAutomation
    const headline =
      HEADLINE_PRIORITY.find((s) => groupRuns.some((r) => r.status === s)) ?? first.status
    return {
      key,
      name: first.automation?.name ?? 'Automation',
      triggerLabel: first.automation
        ? (getTriggerSpec(first.automation.trigger_type as TriggerType)?.ui.label ??
          first.automation.trigger_type)
        : '',
      runs: groupRuns,
      headline,
    }
  })
  // Live automations float to the top; within each band, most recent first.
  const isLive = (g: AutomationGroup) => HEADLINE_PRIORITY.includes(g.headline)
  return groups.sort((a, b) => Number(isLive(b)) - Number(isLive(a)))
}

export function CoupleAutomations({ coupleId }: Props) {
  const [runs, setRuns] = useState<RunWithAutomation[] | null>(null)
  const [pausing, setPausing] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const load = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('automation_runs' as never)
      .select('*, automation:automations(id, name, trigger_type)')
      .eq('couple_id', coupleId)
      .order('started_at', { ascending: false })
      .then(({ data }) => {
        setRuns((data as RunWithAutomation[] | null) ?? [])
      })
  }, [coupleId])

  useEffect(() => {
    load()
  }, [load])

  async function pauseAll() {
    if (!confirm('Pause every running automation for this couple?')) return
    setPausing(true)
    await pauseCoupleRunsAction({ coupleId })
    setPausing(false)
    load()
  }

  if (runs === null) return <Loading variant="center" />

  if (runs.length === 0) {
    return (
      <Empty
        icon={Sparkles}
        title="No automations have run for this couple yet"
        description="When one of your active automations matches this couple, you'll see it here."
      />
    )
  }

  const groups = groupRuns(runs)
  const hasLive = runs.some((r) => r.status === 'running' || r.status === 'waiting')

  return (
    <div>
      {hasLive && (
        <div className="flex justify-end mb-3">
          <Button variant="secondary" size="sm" loading={pausing} onClick={pauseAll} className="cursor-pointer">
            Pause all
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {groups.map((group) => {
          const open = openKey === group.key
          return (
            <div key={group.key}>
              <button
                onClick={() => setOpenKey(open ? null : group.key)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-muted transition text-left border border-transparent hover:border-border cursor-pointer"
              >
                <Zap size={13} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{group.name}</p>
                  <p className="text-xs text-text-subtle truncate mt-0.5">
                    {group.triggerLabel && `${group.triggerLabel} · `}
                    {group.runs.length === 1 ? '1 run' : `${group.runs.length} runs`} · last{' '}
                    {formatRunTime((group.runs[0] as RunWithAutomation).started_at)}
                  </p>
                </div>
                <StatePill
                  tone={STATUS_TONE[group.headline]}
                  label={RUN_STATUS_LABELS[group.headline]}
                  className="shrink-0"
                />
                <ChevronDown
                  size={14}
                  strokeWidth={1.5}
                  className={`text-text-subtle shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                />
              </button>
              {/* Grid-rows 0fr→1fr animates the reveal without JS height
                  measurement; the inner min-h-0 + overflow-hidden is what
                  lets the row actually collapse. */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <RunHistory runs={group.runs} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Expanded detail: this automation's runs for this couple, newest first. */
function RunHistory({ runs }: { runs: RunWithAutomation[] }) {
  return (
    <div className="ml-8 mt-2 mb-4 pl-4 border-l border-border space-y-4">
      {runs.map((run) => (
        <div key={run.id} className="flex items-start gap-3 pr-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">
              Started {formatRunTime(run.started_at)}
              {run.completed_at ? ` · finished ${formatRunTime(run.completed_at)}` : ''}
            </p>
            {run.error_message && (
              <p className="text-xs text-danger mt-1">{friendlyRunError(run.error_message)}</p>
            )}
          </div>
          <StatePill
            tone={STATUS_TONE[run.status]}
            label={RUN_STATUS_LABELS[run.status]}
            className="shrink-0"
          />
        </div>
      ))}
    </div>
  )
}
