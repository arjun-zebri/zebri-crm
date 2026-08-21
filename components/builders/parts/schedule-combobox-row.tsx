/**
 * One saved-schedule row inside the {@link ScheduleCombobox} dropdown:
 * the pickable name + stage summary, with inline set-default (star) and
 * delete actions that reveal on hover.
 *
 * @module components/builders/parts/schedule-combobox-row
 */
'use client'

import { Star, Trash2 } from 'lucide-react'

import { describeSchedule } from '@/lib/payments/describe-schedule'
import type { PaymentSchedule } from '@/types/payment-schedule'

/** Props for {@link ScheduleComboboxRow}. */
export interface ScheduleComboboxRowProps {
  schedule: PaymentSchedule
  onPick: (schedule: PaymentSchedule) => void
  onSetDefault: (id: string) => void
  onDelete: (schedule: PaymentSchedule) => void
}

/** A single saved schedule in the combobox dropdown. */
export function ScheduleComboboxRow({
  schedule,
  onPick,
  onSetDefault,
  onDelete,
}: ScheduleComboboxRowProps) {
  return (
    <div className="group flex items-center gap-1 rounded-control px-1 transition hover:bg-surface-muted">
      <button
        type="button"
        onClick={() => onPick(schedule)}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start px-1 py-1.5 text-left"
      >
        <span className="flex items-center gap-1 truncate text-body text-text">
          {schedule.name}
          {schedule.isDefault && (
            <Star
              size={11}
              strokeWidth={1.5}
              className="shrink-0 text-brand-fg"
              aria-label="Default"
            />
          )}
        </span>
        <span className="truncate text-[0.7rem] text-text-subtle">
          {describeSchedule(schedule.stages)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onSetDefault(schedule.id)}
        aria-label={`Set ${schedule.name} as default`}
        className="shrink-0 cursor-pointer p-1 text-text-subtle transition-colors hover:text-brand-fg"
      >
        <Star
          size={13}
          strokeWidth={1.5}
          className={schedule.isDefault ? 'text-brand-fg' : ''}
        />
      </button>
      <button
        type="button"
        onClick={() => onDelete(schedule)}
        aria-label={`Delete ${schedule.name}`}
        className="shrink-0 cursor-pointer p-1 text-text-subtle transition-colors hover:text-danger"
      >
        <Trash2 size={13} strokeWidth={1.5} />
      </button>
    </div>
  )
}
