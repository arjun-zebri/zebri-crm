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
import { FlaskConical, Loader2, Play } from 'lucide-react'
import { useState } from 'react'

/** Pulsing placeholder rows shown while the automation list loads. */
function PickerSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="h-3.5 flex-1 animate-pulse rounded bg-surface-muted" />
          <div className="size-3 shrink-0 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  )
}

import { Button } from '@/components/ui/button'
import { getTriggerSpec } from '@/lib/automations/triggers'
import type { TriggerType } from '@/types/automations'

import {
  loadRunnableAutomationsAction,
  runAutomationForCoupleAction,
  testAutomationForCoupleAction,
  type RunnableAutomation,
} from '../automations/actions'

type Mode = 'run' | 'test'

interface Props {
  coupleId: string
  /** `run` fires for real; `test` routes any email to the MC. */
  mode: Mode
  /** Refresh the feed after a successful run. */
  onRan: () => void
}

const MODE = {
  run: {
    label: 'Run manually',
    variant: 'primary' as const,
    icon: Play,
    hint: 'Run for this couple now',
    action: runAutomationForCoupleAction,
  },
  test: {
    label: 'Test',
    variant: 'outline' as const,
    icon: FlaskConical,
    hint: 'Test run. Any email comes to you',
    action: testAutomationForCoupleAction,
  },
}

const GENERIC_NAMES = new Set(['', 'untitled automation', 'automation'])

/** Display label: automation name, or its trigger when unnamed. */
function labelFor(a: RunnableAutomation): string {
  const name = a.name.trim()
  if (!GENERIC_NAMES.has(name.toLowerCase())) return name
  return getTriggerSpec(a.trigger_type as TriggerType)?.ui.label ?? a.trigger_type
}

export function CoupleRunPicker({ coupleId, mode, onRan }: Props) {
  const cfg = MODE[mode]
  const Icon = cfg.icon
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
    const res = await cfg.action({ automationId, coupleId })
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
        <Button variant={cfg.variant} size="sm" className="cursor-pointer gap-1.5">
          <Icon size={13} strokeWidth={1.5} /> {cfg.label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="bg-surface border border-border rounded-xl shadow-lg z-[80] w-64 py-1.5"
        >
          <p className="px-3 py-1.5 text-xs text-text-subtle">{cfg.hint}</p>
          {isLoading ? (
            <PickerSkeleton />
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
                  <Icon size={13} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
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
