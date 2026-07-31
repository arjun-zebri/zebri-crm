/**
 * The single payment-schedule modal.
 *
 * One surface over the invoice builder, no stacking: a Start-from dropdown
 * (with inline set-default / delete), a Name, a timeline of draft stages, a
 * running total, and Save-to-library / Cancel / Apply. The modal edits a
 * template-shaped draft and resolves it against this invoice on Apply; it never
 * touches saved templates except through the explicit Save to library.
 *
 * @module components/builders/parts/schedule-modal
 */
'use client'

import { useAutoAnimate } from '@formkit/auto-animate/react'
import { Bookmark, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { resolveStages, validateForSave } from '@/lib/payments/resolve-stages'
import type { PaymentSchedule, TemplateStage } from '@/types/payment-schedule'

import { ScheduleStageRow, STAGE_ROW_GRID, type StageDraft } from './schedule-stage-row'
import { ScheduleStartDropdown } from './schedule-start-dropdown'

/** Props for {@link ScheduleModal}. */
export interface ScheduleModalProps {
  open: boolean
  onClose: () => void
  totalCents: number
  issueDate: string
  /** Current invoice stages as drafts (empty for a fresh invoice). */
  initialStages: StageDraft[]
  defaultSchedule: PaymentSchedule | null
  schedules: PaymentSchedule[]
  schedulesLoading: boolean
  schedulesError: string | null
  onApply: (stages: TemplateStage[]) => void
  onSaveToLibrary: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
  onDeleteSchedule: (schedule: PaymentSchedule) => Promise<void>
  onSetDefaultSchedule: (id: string) => Promise<void>
}

function fmt(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

/** Human-readable text for a resolver / save validation failure. */
function reason(code: string): string {
  switch (code) {
    case 'multiple_remainders':
      return 'Only one stage can take the remaining balance.'
    case 'remainder_not_last':
      return 'The remaining-balance stage has to be last.'
    case 'sum_mismatch':
      return 'The stages do not add up to the invoice total.'
    case 'fixed_exceeds_total':
      return 'A fixed amount is larger than the invoice total.'
    case 'single_stage':
      return 'A schedule needs at least two stages.'
    default:
      return 'This schedule is not valid yet.'
  }
}

function draftToTemplate(draft: StageDraft[]): TemplateStage[] {
  return draft.map((s) => ({
    label: s.label,
    amountType: s.amountType,
    amountValue: s.amountValue,
    offsetValue: s.offsetValue,
    offsetUnit: s.offsetUnit,
  }))
}

/** The modal shell. The body remounts on open, reseeding its draft. */
export function ScheduleModal(props: ScheduleModalProps) {
  return (
    <Modal isOpen={props.open} onClose={props.onClose} title="Payment schedule" size="lg" nested>
      <ScheduleModalBody {...props} />
    </Modal>
  )
}

function ScheduleModalBody({
  onClose,
  totalCents,
  issueDate,
  initialStages,
  defaultSchedule,
  schedules,
  schedulesLoading,
  schedulesError,
  onApply,
  onSaveToLibrary,
  onDeleteSchedule,
  onSetDefaultSchedule,
}: ScheduleModalProps) {
  const { toast } = useToast()
  const keyCounter = useRef(0)
  const nextKey = () => `k${String(keyCounter.current++)}`
  const [listRef] = useAutoAnimate<HTMLDivElement>()

  // Seeded on mount; the Modal unmounts this body on close, so opening reseeds
  // from the current invoice, else the default schedule, else empty.
  const [draft, setDraft] = useState<StageDraft[]>(() =>
    initialStages.length > 0
      ? initialStages
      : (defaultSchedule?.stages ?? []).map((s, i) => ({ ...s, key: `init-${String(i)}`, paidAt: null })),
  )
  const [name, setName] = useState(() =>
    initialStages.length === 0 && defaultSchedule ? defaultSchedule.name : '',
  )
  const [saving, setSaving] = useState(false)

  const patch = (key: string, p: Partial<StageDraft>) =>
    setDraft((cur) => cur.map((s) => (s.key === key ? { ...s, ...p } : s)))
  const removeStage = (key: string) => setDraft((cur) => cur.filter((s) => s.key !== key))
  const addStage = () =>
    setDraft((cur) => {
      // A remainder must stay last, so a new stage is a percent inserted just
      // before it; with no remainder yet, the new stage becomes the remainder.
      const remainderIdx = cur.findIndex((s) => s.amountType === 'remainder')
      const newStage: StageDraft = {
        key: nextKey(),
        label: `Payment ${String(cur.length + 1)}`,
        amountType: remainderIdx >= 0 ? 'percent' : 'remainder',
        amountValue: remainderIdx >= 0 ? 0 : null,
        offsetValue: 0,
        offsetUnit: 'day',
        paidAt: null,
      }
      if (remainderIdx < 0) return [...cur, newStage]
      const copy = [...cur]
      copy.splice(remainderIdx, 0, newStage)
      return copy
    })

  // Loading a saved schedule keeps any paid stages locked at the front.
  const loadSchedule = (schedule: PaymentSchedule | null) => {
    const paid = draft.filter((s) => s.paidAt)
    if (!schedule) {
      setDraft(paid)
      setName('')
      return
    }
    setDraft([...paid, ...schedule.stages.map((s) => ({ ...s, key: nextKey(), paidAt: null }))])
    setName(schedule.name)
  }

  const template = draftToTemplate(draft)
  const resolved = resolveStages(template, totalCents, issueDate)
  const applyReason = resolved.ok ? null : reason(resolved.errors[0]?.code ?? '')
  const saveErrors = validateForSave(template)
  const saveReason =
    name.trim() === ''
      ? 'Name your schedule.'
      : saveErrors.length > 0
        ? reason(saveErrors[0]!.code)
        : applyReason
  const sumCents = resolved.ok ? resolved.stages.reduce((acc, s) => acc + s.amountCents, 0) : 0
  const hasPaid = draft.some((s) => s.paidAt)

  const save = async () => {
    setSaving(true)
    try {
      await onSaveToLibrary({ name: name.trim(), stages: template })
      toast('Saved to your library.')
    } catch {
      toast('Could not save the schedule. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-caption text-text-muted">Start from</span>
        <ScheduleStartDropdown
          schedules={schedules}
          loading={schedulesLoading}
          error={schedulesError}
          triggerLabel={name.trim() !== '' ? name : 'Build from scratch'}
          onPick={loadSchedule}
          onSetDefault={onSetDefaultSchedule}
          onDelete={onDeleteSchedule}
        />
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="schedule-name" className="w-14 shrink-0 text-caption text-text-muted">
          Name
        </label>
        <Input
          id="schedule-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Schedule name"
          placeholder="e.g. 50 / 50 split"
          className="flex-1"
        />
      </div>

      <div>
        {draft.length > 0 && (
          <div className={`hidden pb-2 text-caption text-text-muted ${STAGE_ROW_GRID}`}>
            <span aria-hidden />
            <span>Stage</span>
            <span>Amount</span>
            <span>Due after issue</span>
          </div>
        )}
        <div className="relative">
          <div
            aria-hidden
            className="absolute left-[0.3rem] top-2 bottom-2 hidden w-px border-l border-dashed border-border sm:block"
          />
          <div ref={listRef} className="space-y-2.5">
            {draft.map((s) => (
              <ScheduleStageRow
                key={s.key}
                stage={s}
                onChange={(p) => patch(s.key, p)}
                onRemove={() => removeStage(s.key)}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={addStage}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          <Plus size={15} strokeWidth={1.5} /> Add payment
        </button>
      </div>

      {draft.length > 0 && (
        <div className="flex items-center justify-end text-sm tabular-nums">
          <span className={applyReason ? 'text-warning' : 'text-text-muted'}>
            {applyReason ?? `Stages total ${fmt(sumCents)} of ${fmt(totalCents)}`}
          </span>
        </div>
      )}
      {hasPaid && (
        <p className="text-caption text-text-subtle">Applying keeps any stage that is already paid.</p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          loading={saving}
          disabled={saveReason !== null}
          title={saveReason ?? undefined}
          onClick={save}
        >
          <Bookmark size={15} strokeWidth={1.5} />
          Save to library
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={applyReason !== null}
            onClick={() => {
              onApply(template)
              onClose()
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}
