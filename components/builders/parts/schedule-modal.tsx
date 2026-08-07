/**
 * The single payment-schedule modal.
 *
 * One narrow surface over the invoice builder. A Schedule combobox names the
 * schedule and loads saved ones. Two global choices sit above the timeline: the
 * share unit (% or $) and the timing anchor (forward from issue, or back from
 * the due date). A checkbox makes the final stage collect the remainder, so the
 * rows stay down to name / share / due. Apply resolves the draft against this
 * invoice; Save to library persists it as a new template.
 *
 * @module components/builders/parts/schedule-modal
 */
'use client'

import { Bookmark, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { resolveStages, validateForSave } from '@/lib/payments/resolve-stages'
import type { OffsetAnchor, PaymentSchedule, StageAmountType, TemplateStage } from '@/types/payment-schedule'

import { ScheduleCombobox } from './schedule-combobox'
import { ScheduleStageRow, STAGE_ROW_GRID, type StageDraft } from './schedule-stage-row'

/** Props for {@link ScheduleModal}. */
export interface ScheduleModalProps {
  open: boolean
  onClose: () => void
  totalCents: number
  issueDate: string
  /** The invoice's due date, needed for "before due date" timing. */
  dueDate: string | null
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
    case 'no_due_date':
      return 'Set a due date on the invoice to time stages before it.'
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
    offsetAnchor: s.offsetAnchor,
  }))
}

/** A small two-or-three-way segmented toggle. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; disabled?: boolean }[]
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex overflow-hidden rounded-control border border-border">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer px-2.5 py-1 text-body transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            i > 0 ? 'border-l border-border' : ''
          } ${value === o.value ? 'bg-brand-fg font-medium text-text-inverse' : 'text-text-muted hover:text-text'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The modal shell. The body remounts on open, reseeding its draft. */
export function ScheduleModal(props: ScheduleModalProps) {
  return (
    <Modal isOpen={props.open} onClose={props.onClose} title="Payment schedule" size="md" nested>
      <ScheduleModalBody {...props} />
    </Modal>
  )
}

function ScheduleModalBody({
  onClose,
  totalCents,
  issueDate,
  dueDate,
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

  const [draft, setDraft] = useState<StageDraft[]>(() =>
    initialStages.length > 0
      ? initialStages
      : (defaultSchedule?.stages ?? []).map((s, i) => ({ ...s, key: `init-${String(i)}`, paidAt: null })),
  )
  const [name, setName] = useState(() =>
    initialStages.length === 0 && defaultSchedule ? defaultSchedule.name : '',
  )
  const [saving, setSaving] = useState(false)

  // Globals derived from the rows; the toggles bulk-edit the unpaid rows.
  const amountUnit: StageAmountType =
    draft.find((s) => s.amountType !== 'remainder')?.amountType ?? 'percent'
  const anchor: OffsetAnchor = draft[0]?.offsetAnchor ?? 'issue'
  const lastIsRemainder = draft.length > 0 && draft[draft.length - 1]?.amountType === 'remainder'

  const patch = (key: string, p: Partial<StageDraft>) =>
    setDraft((cur) => cur.map((s) => (s.key === key ? { ...s, ...p } : s)))
  const removeStage = (key: string) => setDraft((cur) => cur.filter((s) => s.key !== key))

  const setAmountUnit = (unit: StageAmountType) =>
    setDraft((cur) => cur.map((s) => (s.paidAt || s.amountType === 'remainder' ? s : { ...s, amountType: unit })))
  const setAnchor = (next: OffsetAnchor) =>
    setDraft((cur) => cur.map((s) => (s.paidAt ? s : { ...s, offsetAnchor: next })))
  const setLastRemainder = (on: boolean) =>
    setDraft((cur) => {
      if (cur.length === 0) return cur
      const last = cur.length - 1
      return cur.map((s, i) =>
        i === last && !s.paidAt
          ? on
            ? { ...s, amountType: 'remainder', amountValue: null }
            : { ...s, amountType: amountUnit, amountValue: s.amountValue ?? 0 }
          : s,
      )
    })

  const addStage = () =>
    setDraft((cur) => {
      const remainderIdx = cur.findIndex((s) => s.amountType === 'remainder')
      const newStage: StageDraft = {
        key: nextKey(),
        label: `Payment ${String(cur.length + 1)}`,
        amountType: amountUnit,
        amountValue: 0,
        offsetValue: 0,
        offsetUnit: 'day',
        offsetAnchor: anchor,
        paidAt: null,
      }
      if (remainderIdx < 0) return [...cur, newStage]
      const copy = [...cur]
      copy.splice(remainderIdx, 0, newStage)
      return copy
    })

  const loadSchedule = (schedule: PaymentSchedule) => {
    const paid = draft.filter((s) => s.paidAt)
    setDraft([...paid, ...schedule.stages.map((s) => ({ ...s, key: nextKey(), paidAt: null }))])
    setName(schedule.name)
  }

  const template = draftToTemplate(draft)
  const resolved = resolveStages(template, totalCents, issueDate, dueDate)
  const applyReason = resolved.ok ? null : reason(resolved.errors[0]?.code ?? '')
  const saveErrors = validateForSave(template)
  const saveReason =
    name.trim() === ''
      ? 'Name your schedule.'
      : saveErrors.length > 0
        ? reason(saveErrors[0]!.code)
        : applyReason
  const sumCents = resolved.ok ? resolved.stages.reduce((acc, s) => acc + s.amountCents, 0) : 0

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
    <div className="space-y-4 text-body">
      <div className="space-y-1.5">
        <span className="block text-body font-medium text-text-muted">Schedule</span>
        <ScheduleCombobox
          name={name}
          onNameChange={setName}
          schedules={schedules}
          loading={schedulesLoading}
          error={schedulesError}
          onPick={loadSchedule}
          onSetDefault={onSetDefaultSchedule}
          onDelete={onDeleteSchedule}
        />
      </div>

      <p className="text-body leading-relaxed text-text-muted">
        Split the invoice into stages the couple pays over time. Choose whether each share is a
        percent or a dollar amount, and whether timing counts forward from the issue date or back
        from the due date.
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-body text-text-muted">Amount</span>
          <Segmented
            ariaLabel="Amount unit"
            value={amountUnit === 'fixed' ? 'fixed' : 'percent'}
            onChange={(v) => setAmountUnit(v)}
            options={[
              { value: 'percent', label: '%' },
              { value: 'fixed', label: '$' },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-body text-text-muted">Timing</span>
          <Segmented
            ariaLabel="Timing anchor"
            value={anchor}
            onChange={(v) => setAnchor(v)}
            options={[
              { value: 'issue', label: 'After issue' },
              { value: 'due', label: 'Before due', disabled: !dueDate },
            ]}
          />
        </div>
      </div>

      {draft.length > 0 && (
        <Checkbox
          checked={lastIsRemainder}
          onChange={setLastRemainder}
          label="Final stage collects the remaining balance"
        />
      )}

      <div>
        {draft.length > 0 && (
          <div className={`hidden pb-2 text-body text-text-muted ${STAGE_ROW_GRID}`}>
            <span aria-hidden />
            <span>Stage</span>
            <span>Amount</span>
            <span>Due</span>
            <span aria-hidden />
          </div>
        )}
        {/* Fixed-height scroll area so the modal keeps a stable size as
            payments are added or removed. Sized to fit ~6 rows on a wide
            screen; more than that scrolls here rather than growing the modal. */}
        <div className="h-[15.5rem] overflow-y-auto sm:pr-1">
          <div className="relative">
            <div
              aria-hidden
              className="absolute left-[0.19rem] top-2 bottom-2 hidden w-px border-l border-dashed border-border sm:block"
            />
            <div className="flex flex-col gap-2.5">
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
          {/* Inside the scroll area, after the rows: keeps "Add payment"
              directly under the last stage instead of pinned to the
              bottom of the fixed box, without resizing the modal. */}
          <button
            type="button"
            onClick={addStage}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-body text-text-muted transition-colors hover:text-text"
          >
            <Plus size={14} strokeWidth={1.5} /> Add payment
          </button>
        </div>
      </div>

      {draft.length > 0 && (
        <div className="flex items-center justify-end text-body tabular-nums">
          <span className={applyReason ? 'text-warning' : 'text-text-muted'}>
            {applyReason ?? `Stages total ${fmt(sumCents)} of ${fmt(totalCents)}`}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          loading={saving}
          disabled={saveReason !== null}
          title={saveReason ?? undefined}
          onClick={save}
        >
          <Bookmark size={14} strokeWidth={1.5} />
          Save schedule
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
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
