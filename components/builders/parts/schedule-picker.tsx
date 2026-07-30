/**
 * Saved payment schedule picker for the invoice builder.
 *
 * Mirrors `app/(dashboard)/templates/category-picker-base.tsx` (the Notion
 * pattern): the trigger reads like a Select, the popover lists schedules to
 * apply, and an Edit mode renames, deletes and sets the default without
 * leaving the builder. There is deliberately no create form here. Schedules
 * are created by building stages on an invoice and saving them, so the library
 * cannot fill up with schedules the MC never actually used.
 *
 * @module components/builders/parts/schedule-picker
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Pencil, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PaymentSchedule } from '@/types/payment-schedule'

/**
 * Props for the `SchedulePicker` component.
 * Carries the list of saved schedules, loading and error states, and mutation
 * callbacks for applying, renaming, deleting, and setting schedules as default.
 */
export interface SchedulePickerProps {
  schedules: PaymentSchedule[]
  loading: boolean
  error: string | null
  /** `null` selects the "No schedule (single payment)" entry. */
  onApply: (schedule: PaymentSchedule | null) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}

/** One-line summary of a schedule's shape, for the option row. */
function summarise(schedule: PaymentSchedule): string {
  return schedule.stages
    .map((s) =>
      s.amountType === 'percent'
        ? `${String(s.amountValue ?? 0)}%`
        : s.amountType === 'fixed'
          ? `$${String(s.amountValue ?? 0)}`
          : 'rest',
    )
    .join(' . ')
}

/**
 * Popover control for applying and managing saved payment schedules.
 *
 * Presents a list of saved schedules to apply, plus a "No schedule" entry for
 * single-payment invoices. An Edit mode allows inline rename, delete, and
 * set-as-default operations. Deliberately does not support schedule creation
 * here: schedules are created by building stages on an invoice and saving them,
 * ensuring the library contains only schedules the MC has actually used.
 *
 * See {@link SchedulePickerProps}.
 */
export function SchedulePicker({
  schedules,
  loading,
  error,
  onApply,
  onRename,
  onDelete,
  onSetDefault,
}: SchedulePickerProps) {
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setManaging(false)
      }}
    >
      <Popover.Trigger className="flex h-8 cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-left text-caption text-text transition-colors hover:border-border-strong focus:border-brand-fg focus:outline-none data-[state=open]:border-brand-fg">
        <span>Apply a saved schedule</span>
        <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[90] w-72 rounded-xl border border-border bg-card p-1 shadow-lg animate-fade-in"
        >
          {loading ? (
            <p className="px-2 py-3 text-caption text-text-subtle">Loading schedules...</p>
          ) : error ? (
            <p className="px-2 py-3 text-caption text-danger">{error}</p>
          ) : managing ? (
            <ManageList
              schedules={schedules}
              onRename={onRename}
              onDelete={onDelete}
              onSetDefault={onSetDefault}
              onDone={() => setManaging(false)}
            />
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    onApply(null)
                    setOpen(false)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-caption text-text">
                    No schedule (single payment)
                  </span>
                </button>
                {schedules.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onApply(s)
                      setOpen(false)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1 truncate text-caption text-text">{s.name}</span>
                    <span className="shrink-0 text-caption text-text-subtle tabular-nums">
                      {summarise(s)}
                    </span>
                    {s.isDefault && <Check size={12} strokeWidth={1.5} className="shrink-0 text-text" />}
                  </button>
                ))}
              </div>
              {schedules.length === 0 ? (
                <p className="px-2 py-3 text-caption text-text-subtle">
                  No saved schedules yet. Build one below and save it.
                </p>
              ) : (
                <div className="mt-1 border-t border-border pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-full justify-start gap-1.5 px-2 text-caption"
                    onClick={() => setManaging(true)}
                  >
                    <Pencil size={12} strokeWidth={1.5} />
                    Edit schedules
                  </Button>
                </div>
              )}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Rename / delete / set-default list, shown in the popover's Edit mode. */
function ManageList({
  schedules,
  onRename,
  onDelete,
  onSetDefault,
  onDone,
}: {
  schedules: PaymentSchedule[]
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
  onDone: () => void
}) {
  return (
    <>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {schedules.map((s) => (
          <ManageRow
            key={s.id}
            schedule={s}
            onRename={onRename}
            onDelete={onDelete}
            onSetDefault={onSetDefault}
          />
        ))}
      </div>
      <div className="mt-1 border-t border-border pt-1">
        <Button size="sm" variant="ghost" className="h-7 w-full text-caption" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  )
}

/** One row in Edit mode: inline rename field plus default and delete actions. */
function ManageRow({
  schedule,
  onRename,
  onDelete,
  onSetDefault,
}: {
  schedule: PaymentSchedule
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}) {
  const [name, setName] = useState(schedule.name)

  return (
    <div className="flex items-center gap-1 px-1">
      <Input
        size="sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const next = name.trim()
          if (next && next !== schedule.name) onRename(schedule.id, next)
        }}
        aria-label={`Rename ${schedule.name}`}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-1.5"
        aria-label={`Set ${schedule.name} as default`}
        onClick={() => onSetDefault(schedule.id)}
      >
        <Star
          size={13}
          strokeWidth={1.5}
          className={schedule.isDefault ? 'text-brand-fg' : 'text-text-subtle'}
        />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-1.5"
        aria-label={`Delete ${schedule.name}`}
        onClick={() => onDelete(schedule.id)}
      >
        <Trash2 size={13} strokeWidth={1.5} className="text-text-subtle hover:text-danger" />
      </Button>
    </div>
  )
}
