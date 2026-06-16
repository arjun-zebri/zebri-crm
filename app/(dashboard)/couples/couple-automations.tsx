/**
 * Couple Profile → Automations sub-tab.
 *
 * Activity-first view: one row per automation that has touched this
 * couple (live ones first). Each row leads with the **most recent
 * outcome** ("Sent email", "Quote follow-up failed — no email"), not
 * a bare status word; expanding it reveals the per-step activity feed
 * for this couple, narrated from `automation_audit_log` (see
 * {@link narrateAuditEntry}). "Pause all" flips every running /
 * waiting run for the couple to paused — useful when a booking is
 * cancelled or the MC needs to intervene.
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
import { createClient } from '@/lib/supabase/client'
import { RUN_STATUS_LABELS } from '@/types/automations'

import { pauseCoupleRunsAction } from '../automations/actions'

import {
  buildActivity,
  groupRuns,
  type AuditRow,
  type RunWithAutomation,
} from './couple-automations-data'
import { CoupleAutomationsFeed, type RunActivity } from './couple-automations-feed'
import { STATUS_TONE } from './couple-automations-shared'

interface Props {
  coupleId: string
}

export function CoupleAutomations({ coupleId }: Props) {
  const [runs, setRuns] = useState<RunWithAutomation[] | null>(null)
  const [activity, setActivity] = useState<Map<string, RunActivity>>(new Map())
  const [pausing, setPausing] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)

  // Wrapped in a sync function so the setState calls land in an async
  // callback (after the awaited fetch), never on the effect's
  // synchronous path — same shape as a `.then()` data load.
  const load = useCallback(() => {
    void (async () => {
      const supabase = createClient()
      const { data: runRows } = await supabase
        .from('automation_runs' as never)
        .select('*, automation:automations(id, name, trigger_type)')
        .eq('couple_id', coupleId)
        .order('started_at', { ascending: false })
      const list = (runRows as RunWithAutomation[] | null) ?? []

      let audit: AuditRow[] = []
      if (list.length > 0) {
        const { data: auditRows } = await supabase
          .from('automation_audit_log' as never)
          .select('id, run_id, event, details, created_at, action:automation_actions(type, label)')
          .in(
            'run_id',
            list.map((r) => r.id),
          )
          .order('created_at', { ascending: true })
        audit = (auditRows as AuditRow[] | null) ?? []
      }
      setActivity(buildActivity(list, audit))
      setRuns(list)
    })()
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

  const groups = groupRuns(runs, activity)
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
          const runCount = group.runs.length
          return (
            <div key={group.key}>
              <button
                onClick={() => setOpenKey(open ? null : group.key)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-muted transition text-left border border-transparent hover:border-border cursor-pointer"
              >
                <Zap size={13} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{group.title}</p>
                  <p className="text-xs text-text-subtle truncate mt-0.5">
                    {group.lastOutcome ??
                      `${group.triggerLabel ? `${group.triggerLabel} · ` : ''}${runCount === 1 ? '1 run' : `${runCount} runs`}`}
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
                  <CoupleAutomationsFeed runs={group.runs} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
