/**
 * The "Start from" control at the top of the payment-schedule modal.
 *
 * A popover, not a plain Select, because each saved schedule carries inline
 * management: a star to set it as the default and a trash to delete it (with an
 * undo toast owned by the caller). Picking a schedule loads its stages into the
 * timeline; "Build from scratch" clears it.
 *
 * @module components/builders/parts/schedule-start-dropdown
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { describeSchedule } from '@/lib/payments/describe-schedule'
import type { PaymentSchedule } from '@/types/payment-schedule'

/** Props for {@link ScheduleStartDropdown}. */
export interface ScheduleStartDropdownProps {
  schedules: PaymentSchedule[]
  loading: boolean
  error: string | null
  /** Label shown on the trigger (the loaded schedule name, or a hint). */
  triggerLabel: string
  onPick: (schedule: PaymentSchedule | null) => void
  onSetDefault: (id: string) => void
  onDelete: (schedule: PaymentSchedule) => void
}

/** Saved-schedule picker with inline set-default and delete. */
export function ScheduleStartDropdown({
  schedules,
  loading,
  error,
  triggerLabel,
  onPick,
  onSetDefault,
  onDelete,
}: ScheduleStartDropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-border-strong bg-surface px-3 text-left text-sm text-text transition-colors hover:border-border-strong focus:border-brand-fg focus:outline-none data-[state=open]:border-brand-fg">
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown size={15} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[95] w-[var(--radix-popover-trigger-width)] rounded-xl border border-border bg-card p-1 shadow-lg animate-fade-in"
        >
          {loading ? (
            <p className="px-2 py-3 text-caption text-text-subtle">Loading schedules...</p>
          ) : error ? (
            <p className="px-2 py-3 text-caption text-danger">{error}</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onPick(null)
                  setOpen(false)
                }}
                className="flex w-full cursor-pointer items-center rounded-lg px-2 py-2 text-left text-sm text-text-muted transition hover:bg-surface-muted"
              >
                Build from scratch
              </button>
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-1 rounded-lg px-1 transition hover:bg-surface-muted"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onPick(s)
                      setOpen(false)
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col items-start px-1 py-2 text-left"
                  >
                    <span className="flex items-center gap-1.5 truncate text-sm text-text">
                      {s.name}
                      {s.isDefault && (
                        <Star size={12} strokeWidth={1.5} className="shrink-0 text-brand-fg" aria-label="Default" />
                      )}
                    </span>
                    <span className="truncate text-caption text-text-subtle">
                      {describeSchedule(s.stages)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetDefault(s.id)}
                    aria-label={`Set ${s.name} as default`}
                    className="shrink-0 cursor-pointer p-1 text-text-subtle transition-colors hover:text-brand-fg"
                  >
                    <Star size={14} strokeWidth={1.5} className={s.isDefault ? 'text-brand-fg' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    aria-label={`Delete ${s.name}`}
                    className="shrink-0 cursor-pointer p-1 text-text-subtle transition-colors hover:text-danger"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              {schedules.length === 0 && (
                <p className="px-2 py-2 text-caption text-text-subtle">No saved schedules yet.</p>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
