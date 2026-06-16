/**
 * "Run an automation now" picker for the couple Automations tab.
 *
 * A small modal: pick one of the MC's active automations and fire it
 * against this couple on demand (the everyday "send the portal link
 * now" case), bypassing the trigger. Calls
 * `runAutomationForCoupleAction`, then asks the parent to refresh so
 * the new run shows up in the feed.
 *
 * @module app/(dashboard)/couples/couple-automations-run-picker
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Loading } from '@/components/ui/loading'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { getTriggerSpec } from '@/lib/automations/triggers'
import type { TriggerType } from '@/types/automations'

import {
  loadRunnableAutomationsAction,
  runAutomationForCoupleAction,
  type RunnableAutomation,
} from '../automations/actions'

interface Props {
  coupleId: string
  isOpen: boolean
  onClose: () => void
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

export function CoupleRunPicker({ coupleId, isOpen, onClose, onRan }: Props) {
  const [selected, setSelected] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: list, isLoading } = useQuery({
    queryKey: ['runnable-automations'],
    enabled: isOpen,
    queryFn: async (): Promise<RunnableAutomation[]> => {
      const res = await loadRunnableAutomationsAction()
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
  })

  async function run() {
    const automationId = selected || list?.[0]?.id
    if (!automationId) return
    setRunning(true)
    setError(null)
    const res = await runAutomationForCoupleAction({ automationId, coupleId })
    setRunning(false)
    if (res.ok) {
      onRan()
      onClose()
    } else {
      setError(res.error)
    }
  }

  const options = (list ?? []).map((a) => ({ value: a.id, label: labelFor(a) }))
  const value = selected || list?.[0]?.id || ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Run an automation"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={run} loading={running} disabled={!value} className="cursor-pointer">
            Run now
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <Loading variant="center" />
      ) : options.length === 0 ? (
        <Empty
          title="No active automations"
          description="Activate an automation first, then you can run it for this couple."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Pick an automation to run for this couple now. It runs immediately, skipping its trigger.
          </p>
          <Select value={value} onValueChange={setSelected} options={options} />
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
