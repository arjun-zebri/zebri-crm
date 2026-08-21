/**
 * The "Schedule" field at the top of the payment-schedule modal.
 *
 * Notion-style combobox: type to name a schedule, click or focus the input to
 * open the dropdown and load a saved one. Typing filters the saved schedules;
 * if the typed text doesn't match any schedule, a "Create '<typed>'" row appears
 * at the top of the list. Each saved schedule carries an inline set-default star
 * and a delete (the caller shows the undo toast). The input keeps focus while
 * the dropdown is open; Escape closes it. Keyboard accessibility is preserved.
 *
 * @module components/builders/parts/schedule-combobox
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'

import { ScheduleComboboxRow } from '@/components/builders/parts/schedule-combobox-row'
import { Input } from '@/components/ui/input'
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
  /** Called when the MC clicks "Create '<typed>'" for a new schedule name.
   *  The caller seeds the modal with this name and an empty draft. */
  onCreateNew: (name: string) => void
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
  onCreateNew,
}: ScheduleComboboxProps) {
  const [open, setOpen] = useState(false)

  // Filter schedules by the typed name (case-insensitive substring match).
  const filtered = schedules.filter((s) =>
    s.name.toLowerCase().includes(name.toLowerCase()),
  )

  // If the typed name doesn't match any schedule, offer a Create option.
  const showCreate =
    name.trim() !== '' &&
    !schedules.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Anchor the popover to the whole field so the dropdown matches the
          input width; input now opens the dropdown (Notion-style combobox).
          Keep the popover open while the input has text or has focus. */}
      <Popover.Anchor asChild>
        <div className="relative">
          <Input
            value={name}
            onChange={(e) => {
              onNameChange(e.target.value)
              // Typing keeps the dropdown open (showing filtered results or Create option).
              if (!open) setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
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
          // Keep focus in the input while the list is open so the MC can keep
          // typing to filter or to name a new schedule (Radix moves focus into
          // the content by default, which would swallow the keystrokes).
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-[95] w-[var(--radix-popover-trigger-width)] rounded-control border border-border bg-card p-1 shadow-lg animate-fade-in"
        >
          {loading ? (
            <p className="px-2 py-2 text-body text-text-subtle">Loading schedules...</p>
          ) : error ? (
            <p className="px-2 py-2 text-body text-danger">{error}</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {showCreate && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onCreateNew(name.trim())
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-1 rounded-control px-2 py-1.5 text-left text-body text-text-muted transition hover:bg-surface-muted cursor-pointer"
                  >
                    <Plus size={13} strokeWidth={1.5} />
                    <span>Create '{name.trim()}'</span>
                  </button>
                  {filtered.length > 0 && <div className="h-px bg-border mx-1" />}
                </>
              )}
              {filtered.map((s) => (
                <ScheduleComboboxRow
                  key={s.id}
                  schedule={s}
                  onPick={(picked) => {
                    onPick(picked)
                    setOpen(false)
                  }}
                  onSetDefault={onSetDefault}
                  onDelete={onDelete}
                />
              ))}
              {!showCreate && filtered.length === 0 && (
                <p className="px-2 py-2 text-body text-text-subtle">No saved schedules yet.</p>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
