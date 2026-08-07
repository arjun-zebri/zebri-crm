/**
 * The invoice builder's payment-schedule section.
 *
 * Empty: a single "Add schedule" button that opens the modal (pre-loaded with
 * the MC's default so the common case is open-and-Apply). Applied: a read-only
 * resolved timeline with an always-visible running total, plus one "Change"
 * door back into the modal. All editing of shape happens in the modal; the only
 * action on the surface is recording a manual payment.
 *
 * @module components/builders/parts/payment-schedule
 */
'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type {
  InvoiceStage,
  PaymentSchedule as PaymentScheduleType,
  TemplateStage,
} from '@/types/payment-schedule'

import { PaymentStageRow } from './payment-stage-row'
import { ScheduleModal } from './schedule-modal'
import type { StageDraft } from './schedule-stage-row'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

/** Props for {@link PaymentSchedule}. */
export interface PaymentScheduleProps {
  canEdit: boolean
  stages: InvoiceStage[]
  totalCents: number
  issueDate: string
  /** The invoice's due date, for "before due date" timing in the modal. */
  dueDate: string | null
  defaultSchedule: PaymentScheduleType | null
  schedules: PaymentScheduleType[]
  schedulesLoading: boolean
  schedulesError: string | null
  /** Resolver validation message, shown inline and blocking save. */
  validationError: string | null
  /** The invoice is live (sent / part-paid), so payments can be recorded. */
  canRecordPayments: boolean
  markPendingStageId: string | null
  onMarkPaid: (stageId: string) => void
  /** Resolve the template against this invoice and set its stages. */
  onApplyTemplate: (stages: TemplateStage[]) => void
  onCreateSchedule: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
  onDeleteSchedule: (id: string) => Promise<void>
  onSetDefaultSchedule: (id: string) => Promise<void>
}

/** The invoice payment-schedule section. See {@link PaymentScheduleProps}. */
export function PaymentSchedule(props: PaymentScheduleProps) {
  const {
    canEdit,
    stages,
    totalCents,
    issueDate,
    dueDate,
    defaultSchedule,
    schedules,
    schedulesLoading,
    schedulesError,
    validationError,
    canRecordPayments,
    markPendingStageId,
    onMarkPaid,
    onApplyTemplate,
    onCreateSchedule,
    onDeleteSchedule,
    onSetDefaultSchedule,
  } = props

  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)

  const nextUnpaidId = stages.find((s) => !s.paidAt)?.id ?? null
  const stageSumCents = stages.reduce((acc, s) => acc + s.amountCents, 0)
  const totalMatches = stageSumCents === totalCents

  const initialStages: StageDraft[] = stages.map((s) => ({
    key: s.id,
    label: s.label,
    amountType: s.amountType,
    amountValue: s.amountValue,
    offsetValue: s.offsetValue,
    offsetUnit: s.offsetUnit,
    offsetAnchor: s.offsetAnchor,
    paidAt: s.paidAt,
  }))

  // Save to library always creates; a name collision appends " copy" so it
  // never overwrites a schedule the MC reuses.
  const handleSaveToLibrary = async (input: { name: string; stages: TemplateStage[] }) => {
    const exists = schedules.some((s) => s.name === input.name)
    await onCreateSchedule({ name: exists ? `${input.name} copy` : input.name, stages: input.stages })
  }

  // Delete with an undo toast that re-creates the schedule from the copy.
  const handleDeleteSchedule = async (schedule: PaymentScheduleType) => {
    await onDeleteSchedule(schedule.id)
    toast(`Deleted "${schedule.name}".`, 'success', {
      label: 'Undo',
      onClick: () => void onCreateSchedule({ name: schedule.name, stages: schedule.stages }),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">
          Payment schedule
        </h4>
        {canEdit && stages.length > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="cursor-pointer text-body text-text-muted transition-colors hover:text-text"
          >
            Change
          </button>
        )}
      </div>

      {stages.length === 0 ? (
        <div className="space-y-3">
          <p className="text-body text-text-muted">The couple pays this invoice in one payment.</p>
          {canEdit && (
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Add schedule
            </Button>
          )}
        </div>
      ) : (
        <div className="relative space-y-4 pl-7">
          {/* Dashed connector centred on the 12px dots (dot left edge sits at
              the container's left, so its centre is 6px in). */}
          <div
            aria-hidden
            className="absolute left-[5.5px] top-2 bottom-2 w-px border-l border-dashed border-border"
          />
          {stages.map((stage) => (
            <PaymentStageRow
              key={stage.id}
              stage={stage}
              canRecord={canRecordPayments}
              isNextUnpaid={stage.id === nextUnpaidId}
              markPending={markPendingStageId === stage.id}
              onMarkPaid={() => onMarkPaid(stage.id)}
            />
          ))}
        </div>
      )}

      {stages.length > 0 && (
        <div className="flex items-center justify-end">
          <span className={`text-body tabular-nums ${totalMatches ? 'text-text-muted' : 'text-warning'}`}>
            Stages total {formatCurrency(stageSumCents)} of {formatCurrency(totalCents)}
          </span>
        </div>
      )}

      {validationError && <p className="text-body text-danger">{validationError}</p>}

      {canEdit && (
        <ScheduleModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          totalCents={totalCents}
          issueDate={issueDate}
          dueDate={dueDate}
          initialStages={initialStages}
          defaultSchedule={defaultSchedule}
          schedules={schedules}
          schedulesLoading={schedulesLoading}
          schedulesError={schedulesError}
          onApply={(template) => {
            onApplyTemplate(template)
            setModalOpen(false)
          }}
          onSaveToLibrary={handleSaveToLibrary}
          onDeleteSchedule={handleDeleteSchedule}
          onSetDefaultSchedule={onSetDefaultSchedule}
        />
      )}
    </div>
  )
}
