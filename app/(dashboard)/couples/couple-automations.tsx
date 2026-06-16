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

import { Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Loading } from '@/components/ui/loading'
import { createClient } from '@/lib/supabase/client'

import {
  cancelRunAction,
  pauseAutomationForCoupleAction,
  pauseCoupleRunsAction,
  resumeAutomationForCoupleAction,
  retryRunAction,
} from '../automations/actions'

import {
  buildActivity,
  groupRuns,
  type AuditRow,
  type RunWithAutomation,
} from './couple-automations-data'
import type { RunActivity } from './couple-automations-feed'
import { AutomationGroupRow } from './couple-automations-group'

interface Props {
  coupleId: string
}

export function CoupleAutomations({ coupleId }: Props) {
  const [runs, setRuns] = useState<RunWithAutomation[] | null>(null)
  const [activity, setActivity] = useState<Map<string, RunActivity>>(new Map())
  const [pausing, setPausing] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const fetchAndSet = useCallback(async () => {
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
  }, [coupleId])

  // The IIFE keeps the setState calls off the effect's synchronous path
  // (they run after the awaited fetch) — same shape as a `.then()` load.
  useEffect(() => {
    void (async () => {
      await fetchAndSet()
    })()
  }, [fetchAndSet])

  async function pauseAll() {
    if (!confirm('Pause every running automation for this couple?')) return
    setPausing(true)
    await pauseCoupleRunsAction({ coupleId })
    setPausing(false)
    await fetchAndSet()
  }

  // Per-run / per-automation controls — run the action, then refresh so
  // the feed reflects the new status without a full page reload.
  const retryRun = (runId: string) => retryRunAction({ runId }).then(fetchAndSet)
  const cancelRun = (runId: string) => cancelRunAction({ runId }).then(fetchAndSet)
  const pauseGroup = (automationId: string) =>
    pauseAutomationForCoupleAction({ automationId, coupleId }).then(fetchAndSet)
  const resumeGroup = (automationId: string) =>
    resumeAutomationForCoupleAction({ automationId, coupleId }).then(fetchAndSet)

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
        {groups.map((group) => (
          <AutomationGroupRow
            key={group.key}
            group={group}
            open={openKey === group.key}
            onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
            onRetry={retryRun}
            onCancel={cancelRun}
            onPause={pauseGroup}
            onResume={resumeGroup}
          />
        ))}
      </div>
    </div>
  )
}
