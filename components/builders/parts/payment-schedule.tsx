/**
 * The invoice builder's payment-schedule section.
 *
 * Empty: a single "Add schedule" button that opens the modal (pre-loaded with
 * the MC's default so the common case is open-and-Apply). Applied: the resolved
 * timeline with mark-paid, drag-to-reorder, and an always-visible running
 * total, plus one "Change" door back into the modal. The modal is the only
 * place schedules are built or managed.
 *
 * @module components/builders/parts/payment-schedule
 */
'use client'

import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
  defaultSchedule: PaymentScheduleType | null
  schedules: PaymentScheduleType[]
  schedulesLoading: boolean
  schedulesError: string | null
  /** Resolver validation message, shown inline and blocking save. */
  validationError: string | null
  markPendingStageId: string | null
  onStagesChange: (stages: InvoiceStage[]) => void
  /** Resolve the template against this invoice and set its stages. */
  onApplyTemplate: (stages: TemplateStage[]) => void
  onMarkPaid: (stageId: string) => void
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
    defaultSchedule,
    schedules,
    schedulesLoading,
    schedulesError,
    validationError,
    markPendingStageId,
    onStagesChange,
    onApplyTemplate,
    onMarkPaid,
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

  const patchStage = (id: string, patch: Partial<InvoiceStage>) => {
    onStagesChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted">
          Payment schedule
        </h4>
        {canEdit && stages.length > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="cursor-pointer text-sm text-text-muted transition-colors hover:text-text"
          >
            Change
          </button>
        )}
      </div>

      {stages.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">The couple pays this invoice in one payment.</p>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
              Add schedule
            </Button>
          )}
        </div>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return
            const ids = stages.map((s) => s.id)
            onStagesChange(
              arrayMove(stages, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
            )
          }}
        >
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="relative space-y-6 pl-7">
              <div
                aria-hidden
                className="absolute left-2.5 top-3 bottom-3 w-px border-l border-dashed border-border"
              />
              {stages.map((stage) => (
                <PaymentStageRow
                  key={stage.id}
                  stage={stage}
                  canEdit={canEdit}
                  isNextUnpaid={stage.id === nextUnpaidId}
                  markPending={markPendingStageId === stage.id}
                  onChange={(patch) => patchStage(stage.id, patch)}
                  onRemove={() => onStagesChange(stages.filter((s) => s.id !== stage.id))}
                  onMarkPaid={() => onMarkPaid(stage.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {stages.length > 0 && (
        <div className="flex items-center justify-end">
          <span className={`text-sm tabular-nums ${totalMatches ? 'text-text-muted' : 'text-warning'}`}>
            Stages total {formatCurrency(stageSumCents)} of {formatCurrency(totalCents)}
          </span>
        </div>
      )}

      {validationError && <p className="text-sm text-danger">{validationError}</p>}

      {canEdit && (
        <ScheduleModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          totalCents={totalCents}
          issueDate={issueDate}
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
