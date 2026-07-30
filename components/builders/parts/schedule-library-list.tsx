/**
 * The list mode of the schedule library modal: one row per saved schedule.
 *
 * Clicking a row applies it (the common case, one tap). The trailing overflow
 * menu holds the management actions so Apply and management never sit side by
 * side inside a row, which is the ambiguity this redesign removes.
 *
 * @module components/builders/parts/schedule-library-list
 */
'use client'

import { Plus, Star } from 'lucide-react'

import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { describeSchedule } from '@/lib/payments/describe-schedule'
import type { PaymentSchedule } from '@/types/payment-schedule'

/** Props for {@link ScheduleLibraryList}. */
export interface ScheduleLibraryListProps {
  schedules: PaymentSchedule[]
  onApply: (schedule: PaymentSchedule) => void
  onEdit: (schedule: PaymentSchedule) => void
  onDuplicate: (schedule: PaymentSchedule) => void
  onSetDefault: (id: string) => void
  onDelete: (schedule: PaymentSchedule) => void
  onNew: () => void
}

/** New-schedule affordance, shared by the empty and populated states. */
function NewButton({ onNew }: { onNew: () => void }) {
  return (
    <button
      type="button"
      onClick={onNew}
      className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
    >
      <Plus size={15} strokeWidth={1.5} /> New schedule
    </button>
  )
}

/** Schedule rows with an overflow menu, or an empty-library line. */
export function ScheduleLibraryList({
  schedules,
  onApply,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
  onNew,
}: ScheduleLibraryListProps) {
  if (schedules.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-muted">You have no saved schedules.</p>
        <NewButton onNew={onNew} />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {schedules.map((s) => (
        <div
          key={s.id}
          className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-muted"
        >
          <button
            type="button"
            onClick={() => onApply(s)}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-text">{s.name}</span>
              {s.isDefault && (
                <Star size={13} strokeWidth={1.5} className="shrink-0 text-brand-fg" aria-label="Default" />
              )}
            </span>
            <span className="block truncate text-caption text-text-muted">
              {describeSchedule(s.stages)}
            </span>
          </button>
          <RowActionsMenu
            alwaysVisible
            size="sm"
            actions={[
              { label: 'Edit', onSelect: () => onEdit(s) },
              { label: 'Duplicate', onSelect: () => onDuplicate(s) },
              { label: 'Set as default', onSelect: () => onSetDefault(s.id) },
              { label: 'Delete', destructive: true, onSelect: () => onDelete(s) },
            ]}
          />
        </div>
      ))}
      <div className="pt-1">
        <NewButton onNew={onNew} />
      </div>
    </div>
  )
}
