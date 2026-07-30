/**
 * Vertical N-stage payment timeline for the Invoice builder.
 *
 * ```
 * Payment schedule              [ Apply a saved schedule v ]
 * . Deposit    25% . $1,400   Paid 12 Jun            [checkmark]
 * |
 * o Progress   50% . $2,800   Due 10 Sep  [Mark paid]
 * |
 * o Final      rem . $1,400   Due 09 Dec
 * + Add stage                Save this as a schedule
 * ```
 *
 * The stage rows are the authoring surface for saved schedules: there is no
 * separate schedule editor anywhere in the app, so this component plus
 * {@link SchedulePicker} is the whole feature's UI.
 *
 * @module components/builders/parts/payment-schedule
 */
'use client'

import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { InvoiceStage, PaymentSchedule as PaymentScheduleType } from '@/types/payment-schedule'

import { PaymentStageRow } from './payment-stage-row'
import { SchedulePicker } from './schedule-picker'

export interface PaymentScheduleProps {
  canEdit: boolean
  stages: InvoiceStage[]
  schedules: PaymentScheduleType[]
  schedulesLoading: boolean
  schedulesError: string | null
  /** Resolver validation message, shown inline and blocking save. */
  validationError: string | null
  markPendingStageId: string | null
  onStagesChange: (stages: InvoiceStage[]) => void
  onApplySchedule: (schedule: PaymentScheduleType | null) => void
  /** Name comes from the inline footer form; see Step 7. */
  onSaveAsSchedule: (name: string) => void
  /** Present only when an applied schedule has been modified. */
  onUpdateApplied: (() => void) | null
  onMarkPaid: (stageId: string) => void
  onRenameSchedule: (id: string, name: string) => void
  onDeleteSchedule: (id: string) => void
  onSetDefaultSchedule: (id: string) => void
}

export function PaymentSchedule({
  canEdit,
  stages,
  schedules,
  schedulesLoading,
  schedulesError,
  validationError,
  markPendingStageId,
  onStagesChange,
  onApplySchedule,
  onSaveAsSchedule,
  onUpdateApplied,
  onMarkPaid,
  onRenameSchedule,
  onDeleteSchedule,
  onSetDefaultSchedule,
}: PaymentScheduleProps) {
  const [naming, setNaming] = useState(false)
  const [newName, setNewName] = useState('')

  const nextUnpaidId = stages.find((s) => !s.paidAt)?.id ?? null

  const patchStage = (id: string, patch: Partial<InvoiceStage>) => {
    onStagesChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const addStage = () => {
    onStagesChange([
      ...stages,
      {
        // Client-only id until the row is persisted; replaceInvoiceStages keys
        // on position, not id, so a temporary value is safe here.
        id: `new-${String(stages.length + 1)}`,
        position: stages.length + 1,
        label: `Payment ${String(stages.length + 1)}`,
        amountType: stages.some((s) => s.amountType === 'remainder') ? 'percent' : 'remainder',
        amountValue: stages.some((s) => s.amountType === 'remainder') ? 0 : null,
        amountCents: 0,
        dueDate: null,
        paidAt: null,
      },
    ])
  }

  const commitName = () => {
    const name = newName.trim()
    if (!name) return
    onSaveAsSchedule(name)
    setNaming(false)
    setNewName('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted">
          Payment schedule
        </h4>
        {canEdit && (
          <SchedulePicker
            schedules={schedules}
            loading={schedulesLoading}
            error={schedulesError}
            onApply={onApplySchedule}
            onRename={onRenameSchedule}
            onDelete={onDeleteSchedule}
            onSetDefault={onSetDefaultSchedule}
          />
        )}
      </div>

      {stages.length === 0 ? (
        <p className="text-caption text-text-subtle">
          No schedule. The couple pays this invoice in one payment.
        </p>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return
            const ids = stages.map((s) => s.id)
            // onStagesChange renumbers position from array order, so moving the item
            // is the whole operation.
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

      {validationError && <p className="text-caption text-danger">{validationError}</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={addStage}
            className="inline-flex cursor-pointer items-center gap-1.5 text-caption text-text-muted transition-colors hover:text-text"
          >
            <Plus size={13} strokeWidth={1.5} />
            Add stage
          </button>
          {stages.length > 1 && (
            <span className="flex items-center gap-3">
              {onUpdateApplied && (
                <button
                  type="button"
                  onClick={onUpdateApplied}
                  className="cursor-pointer text-caption text-text-muted transition-colors hover:text-text"
                >
                  Update saved schedule
                </button>
              )}
              {naming ? (
                <span className="flex items-center gap-2">
                  <Input
                    size="sm"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitName()
                      }
                      if (e.key === 'Escape') setNaming(false)
                    }}
                    placeholder="Schedule name"
                    aria-label="Schedule name"
                    autoFocus
                  />
                  <Button size="sm" variant="secondary" className="h-7 text-caption" onClick={commitName}>
                    Save
                  </Button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  className="cursor-pointer text-caption text-text-muted transition-colors hover:text-text"
                >
                  Save this as a schedule
                </button>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
