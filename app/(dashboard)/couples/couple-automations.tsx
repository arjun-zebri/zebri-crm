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
import { createClient } from '@/lib/supabase/client'

import {
  cancelRunAction,
  pauseAutomationForCoupleAction,
  pauseCoupleRunsAction,
  resumeAutomationForCoupleAction,
  retryRunAction,
} from '../automations/actions'

import { groupRuns, type RunWithAutomation } from './couple-automations-data'
import type { RunActivity } from './couple-automations-feed'
import { AutomationGroupRow } from './couple-automations-group'
import { loadCoupleAutomations } from './couple-automations-loader'
import { CoupleRunPicker } from './couple-automations-run-picker'
import { CoupleAutomationsSkeleton } from './couple-automations-skeleton'
import { CoupleTabEmpty, CoupleTabShell, tabStat } from './couple-tab-shell'

interface Props {
  coupleId: string
}

export function CoupleAutomations({ coupleId }: Props) {
  const [runs, setRuns] = useState<RunWithAutomation[] | null>(null)
  const [activity, setActivity] = useState<Map<string, RunActivity>>(new Map())
  const [pausing, setPausing] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  // Captured at fetch time (not in render) so the 30-day "failed"
  // window is computed from a stable, pure value.
  const [loadedAt, setLoadedAt] = useState(0)

  const fetchAndSet = useCallback(async () => {
    const data = await loadCoupleAutomations(createClient(), coupleId)
    setActivity(data.activity)
    setLoadedAt(data.loadedAt)
    setRuns(data.runs)
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

  if (runs === null) return <CoupleAutomationsSkeleton />

  const groups = groupRuns(runs, activity)

  return (
    <CoupleTabShell
      title="Automations"
      stats={runs.length > 0 ? [{ label: tabStat(runs.length, 'run') }] : undefined}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            disabled={pausing || runs.length === 0}
            onClick={pauseAll}
            className="cursor-pointer"
          >
            Pause all
          </Button>
          <CoupleRunPicker coupleId={coupleId} mode="test" onRan={fetchAndSet} />
          <CoupleRunPicker coupleId={coupleId} mode="run" onRan={fetchAndSet} />
        </>
      }
    >
      {runs.length === 0 ? (
        <CoupleTabEmpty
          icon={Sparkles}
          title="No automations have run for this couple yet"
          description="Run one now, or wait for an active automation to match this couple."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {groups.map((group) => (
            <AutomationGroupRow
              key={group.key}
              group={group}
              nowMs={loadedAt}
              open={openKey === group.key}
              onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
              onRetry={retryRun}
              onCancel={cancelRun}
              onPause={pauseGroup}
              onResume={resumeGroup}
            />
          ))}
        </div>
      )}
    </CoupleTabShell>
  )
}
