/**
 * The invoice builder's payment-schedule section: a local, presentational view
 * of this invoice's stages plus one door into the reusable library.
 *
 * The library is explicit and the invoice is local: editing a saved schedule
 * never changes this invoice, and tweaking a stage here never changes the
 * library. "Change" is the only route into the library, so the MC always knows
 * which surface a control affects.
 *
 * @module components/builders/parts/payment-schedule
 */
'use client'

import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { describeSchedule } from '@/lib/payments/describe-schedule'
import type {
  InvoiceStage,
  PaymentSchedule as PaymentScheduleType,
  TemplateStage,
} from '@/types/payment-schedule'

import { PaymentStageRow } from './payment-stage-row'
import { ScheduleLibraryModal } from './schedule-library-modal'

/** Format integer cents as AUD currency. */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
}

/** Props for {@link PaymentSchedule}. */
export interface PaymentScheduleProps {
  canEdit: boolean
  stages: InvoiceStage[]
  totalCents: number
  /** The MC's default schedule, so the empty state can name it. */
  defaultSchedule: PaymentScheduleType | null
  schedules: PaymentScheduleType[]
  schedulesLoading: boolean
  schedulesError: string | null
  /** Resolver validation message, shown inline and blocking save. */
  validationError: string | null
  markPendingStageId: string | null
  onStagesChange: (stages: InvoiceStage[]) => void
  onApplySchedule: (schedule: PaymentScheduleType | null) => void
  onMarkPaid: (stageId: string) => void
  onCreateSchedule: (input: { name: string; stages: TemplateStage[] }) => Promise<void>
  onUpdateSchedule: (input: { id: string; name?: string; stages?: TemplateStage[] }) => Promise<void>
  onDeleteSchedule: (id: string) => Promise<void>
  onSetDefaultSchedule: (id: string) => Promise<void>
}

/** The invoice payment-schedule section. See {@link PaymentScheduleProps}. */
export function PaymentSchedule(props: PaymentScheduleProps) {
  const {
    canEdit,
    stages,
    totalCents,
    defaultSchedule,
    schedules,
    schedulesLoading,
    schedulesError,
    validationError,
    markPendingStageId,
    onStagesChange,
    onApplySchedule,
    onMarkPaid,
    onCreateSchedule,
    onUpdateSchedule,
    onDeleteSchedule,
    onSetDefaultSchedule,
  } = props

  const [libraryOpen, setLibraryOpen] = useState(false)

  const nextUnpaidId = stages.find((s) => !s.paidAt)?.id ?? null
  const hasPaidStage = stages.some((s) => s.paidAt)
  const stageSumCents = stages.reduce((acc, s) => acc + s.amountCents, 0)
  const totalMatches = stageSumCents === totalCents

  const patchStage = (id: string, patch: Partial<InvoiceStage>) => {
    onStagesChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const addStage = () => {
    const hasRemainder = stages.some((s) => s.amountType === 'remainder')
    onStagesChange([
      ...stages,
      {
        // Client-only id until persisted; replaceInvoiceStages keys on position.
        id: `new-${String(stages.length + 1)}`,
        position: stages.length + 1,
        label: `Payment ${String(stages.length + 1)}`,
        amountType: hasRemainder ? 'percent' : 'remainder',
        amountValue: hasRemainder ? 0 : null,
        amountCents: 0,
        dueDate: null,
        paidAt: null,
      },
    ])
  }

  const applyFromModal = (schedule: PaymentScheduleType) => {
    onApplySchedule(schedule)
    setLibraryOpen(false)
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
            onClick={() => setLibraryOpen(true)}
            className="cursor-pointer text-sm text-text-muted transition-colors hover:text-text"
          >
            Change
          </button>
        )}
      </div>

      {stages.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">The couple pays this invoice in one payment.</p>
          {canEdit &&
            (defaultSchedule ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button variant="primary" size="sm" onClick={() => onApplySchedule(defaultSchedule)}>
                  Apply “{defaultSchedule.name}”
                </Button>
                <span className="text-caption text-text-muted">
                  {describeSchedule(defaultSchedule.stages)}
                </span>
              </div>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setLibraryOpen(true)}>
                Add payment schedule
              </Button>
            ))}
          {canEdit && defaultSchedule && (
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="block cursor-pointer text-sm text-text-muted transition-colors hover:text-text"
            >
              Choose another schedule
            </button>
          )}
        </div>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return
            const ids = stages.map((s) => s.id)
            // onStagesChange renumbers position from array order, so moving the
            // item is the whole operation.
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={addStage}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
            >
              <Plus size={15} strokeWidth={1.5} /> Add stage
            </button>
          ) : (
            <span />
          )}
          {/* A schedule that does not add up is the single most consequential
              mistake on this screen, so the running total is always visible and
              turns to a plain warning when it disagrees with the invoice. */}
          <span
            className={`text-sm tabular-nums ${totalMatches ? 'text-text-muted' : 'text-warning'}`}
          >
            Stages total {formatCurrency(stageSumCents)} of {formatCurrency(totalCents)}
          </span>
        </div>
      )}

      {validationError && <p className="text-sm text-danger">{validationError}</p>}

      <ScheduleLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        schedules={schedules}
        loading={schedulesLoading}
        error={schedulesError}
        hasPaidStage={hasPaidStage}
        onApply={applyFromModal}
        onCreate={onCreateSchedule}
        onUpdate={onUpdateSchedule}
        onDelete={onDeleteSchedule}
        onSetDefault={onSetDefaultSchedule}
      />
    </div>
  )
}
