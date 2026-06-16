/**
 * "Run an automation now" popover for the couple Automations tab.
 *
 * A self-contained Radix popover (matching the couple header's
 * links/actions popover) anchored to the "Run automation" button:
 * pick one of the MC's active automations and fire it against this
 * couple on demand, bypassing the trigger. Calls
 * `runAutomationForCoupleAction`, then asks the parent to refresh so
 * the new run shows up in the feed.
 *
 * @module app/(dashboard)/couples/couple-automations-run-picker
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Play } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { getTriggerSpec } from '@/lib/automations/triggers'
import type { TriggerType } from '@/types/automations'

import {
  loadRunnableAutomationsAction,
  runAutomationForCoupleAction,
  type RunnableAutomation,
} from '../automations/actions'

interface Props {
  coupleId: string
  /** Refresh the feed after a successful run. */
  onRan: () => void
}

const GENERIC_NAMES = new Set(['', 'untitled automation', 'automation'])

/** Display label — automation name, or its trigger when unnamed. */
function labelFor(a: RunnableAutomation): string {
  const name = a.name.trim()
  if (!GENERIC_NAMES.has(name.toLowerCase())) return name
  return getTriggerSpec(a.trigger_type as TriggerType)?.ui.label ?? a.trigger_type
}

export function CoupleRunPicker({ coupleId, onRan }: Props) {
  const [open, setOpen] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: list, isLoading } = useQuery({
    queryKey: ['runnable-automations'],
    enabled: open,
    queryFn: async (): Promise<RunnableAutomation[]> => {
      const res = await loadRunnableAutomationsAction()
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
  })

  async function run(automationId: string) {
    setRunningId(automationId)
    setError(null)
    const res = await runAutomationForCoupleAction({ automationId, coupleId })
    setRunningId(null)
    if (res.ok) {
      setOpen(false)
      onRan()
    } else {
      setError(res.error)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" size="sm" className="cursor-pointer gap-1.5">
          <Play size={13} strokeWidth={1.5} /> Run automation
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="bg-card border border-border rounded-xl shadow-lg z-[70] w-64 py-1.5"
        >
          <p className="px-3 py-1.5 text-xs text-text-subtle">Run for this couple now</p>
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : (list ?? []).length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">No active automations to run.</p>
          ) : (
            (list ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => run(a.id)}
                disabled={runningId !== null}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-text hover:bg-surface-muted transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="truncate">{labelFor(a)}</span>
                {runningId === a.id ? (
                  <Loader2 size={13} className="animate-spin shrink-0 text-text-subtle" />
                ) : (
                  <Play size={13} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
                )}
              </button>
            ))
          )}
          {error && <p className="px-3 py-2 text-xs text-danger">{error}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
