/**
 * The "Schedule" field at the top of the payment-schedule modal.
 *
 * One control that does the job of both a name and a picker: type to name a new
 * schedule, open the dropdown to load a saved one, or pick "New schedule" to
 * start fresh. Each saved schedule carries an inline set-default star and a
 * delete (the caller shows the undo toast). Merging the two removes the
 * redundant "Start from" + "Name" pair.
 *
 * @module components/builders/parts/schedule-combobox
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { describeSchedule } from '@/lib/payments/describe-schedule'
import type { PaymentSchedule } from '@/types/payment-schedule'

/** Props for {@link ScheduleCombobox}. */
export interface ScheduleComboboxProps {
  name: string
  onNameChange: (name: string) => void
  schedules: PaymentSchedule[]
  loading: boolean
  error: string | null
  onPick: (schedule: PaymentSchedule) => void
  onSetDefault: (id: string) => void
  onDelete: (schedule: PaymentSchedule) => void
}

/** Name input with a dropdown of saved schedules. See {@link ScheduleComboboxProps}. */
export function ScheduleCombobox({
  name,
  onNameChange,
  schedules,
  loading,
  error,
  onPick,
  onSetDefault,
  onDelete,
}: ScheduleComboboxProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Anchor the popover to the whole field so the dropdown matches the
          input width; the chevron alone is the trigger so typing still works. */}
      <Popover.Anchor asChild>
        <div className="relative">
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label="Schedule"
            placeholder="Name this schedule"
            className="[&_input]:pr-8"
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label="Choose a saved schedule"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-text-subtle transition-colors hover:text-text"
            >
              <ChevronDown size={15} strokeWidth={1.5} />
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[95] w-[var(--radix-popover-trigger-width)] rounded-control border border-border bg-card p-1 shadow-lg animate-fade-in"
        >
          {loading ? (
            <p className="px-2 py-2 text-body text-text-subtle">Loading schedules...</p>
          ) : error ? (
            <p className="px-2 py-2 text-body text-danger">{error}</p>
          ) : schedules.length === 0 ? (
            <p className="px-2 py-2 text-body text-text-subtle">No saved schedules yet.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-1 rounded-control px-1 transition hover:bg-surface-muted"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onPick(s)
                      setOpen(false)
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col items-start px-1 py-1.5 text-left"
                  >
                    <span className="flex items-center gap-1 truncate text-body text-text">
                      {s.name}
                      {s.isDefault && (
                        <Star size={11} strokeWidth={1.5} className="shrink-0 text-brand-fg" aria-label="Default" />
                      )}
                    </span>
                    <span className="truncate text-[0.7rem] text-text-subtle">
                      {describeSchedule(s.stages)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetDefault(s.id)}
                    aria-label={`Set ${s.name} as default`}
                    className="shrink-0 cursor-pointer p-1 text-text-subtle transition-colors hover:text-brand-fg"
                  >
                    <Star size={13} strokeWidth={1.5} className={s.isDefault ? 'text-brand-fg' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    aria-label={`Delete ${s.name}`}
                    className="shrink-0 cursor-pointer p-1 text-text-subtle transition-colors hover:text-danger"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
