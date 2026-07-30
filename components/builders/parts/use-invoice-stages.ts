/**
 * Stage state for the invoice builder.
 *
 * Owns the stage array, the saved-schedule list, and every mutation the
 * timeline needs. Extracted from `invoice-builder-modal.tsx` because that file
 * is already 986 lines and this feature would otherwise add another hundred.
 *
 * Amounts re-resolve whenever the invoice total changes, except on paid stages,
 * which are frozen: money has moved against them.
 *
 * @module components/builders/parts/use-invoice-stages
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  markStagePaid,
  replaceInvoiceStages,
  setDefaultSchedule,
  updateSchedule,
} from '@/app/(dashboard)/payments/schedule-actions'
import { resolveStages, toTemplateStages } from '@/lib/payments/resolve-stages'
import type { InvoiceStage, PaymentSchedule, TemplateStage } from '@/types/payment-schedule'

/** Human-readable text for a resolver validation failure. */
function messageFor(code: string): string {
  switch (code) {
    case 'multiple_remainders':
      return 'Only one stage can take the remaining balance.'
    case 'remainder_not_last':
      return 'The remaining-balance stage has to be last.'
    case 'sum_mismatch':
      return 'The stages do not add up to the invoice total.'
    case 'fixed_exceeds_total':
      return 'A fixed amount is larger than the invoice total.'
    case 'single_stage':
      return 'A schedule needs at least two stages.'
    default:
      return 'This schedule is not valid yet.'
  }
}

export function useInvoiceStages(input: {
  invoiceId: string | null
  totalCents: number
  issueDate: string
  initialStages: InvoiceStage[]
}) {
  const { invoiceId, totalCents, issueDate, initialStages } = input
  const queryClient = useQueryClient()

  // `draft` holds only what the MC edits: labels, amount types, values, dates.
  // Amounts are NOT stored here; see the `stages` memo below.
  const [draft, setDraft] = useState<InvoiceStage[]>(initialStages)

  const schedulesQuery = useQuery({ queryKey: ['payment-schedules'], queryFn: listSchedules })

  /** Template view of the current stages, for re-resolution and saving. */
  const template = useMemo<TemplateStage[]>(
    () => toTemplateStages(draft, issueDate),
    [draft, issueDate],
  )

  const resolved = useMemo(
    () => resolveStages(template, totalCents, issueDate),
    [template, totalCents, issueDate],
  )

  const validationError = resolved.ok ? null : messageFor(resolved.errors[0]?.code ?? '')

  /**
   * Stages with their amounts derived during render.
   *
   * An amount is a pure function of (stage shape, invoice total, issue date), so
   * deriving it here means changing a line item re-resolves the unpaid stages
   * automatically, with no effect and no second render. Mirroring the resolved
   * amounts back into state inside a `useEffect` would trip
   * `react-hooks/set-state-in-effect`, which is an ESLint error in this repo,
   * and it is the wrong shape anyway: derived data does not belong in state.
   *
   * A paid stage keeps the `amountCents` it was loaded with. That is the figure
   * the couple was actually charged, and it must not move when the MC later
   * edits an unrelated line item.
   */
  const stages = useMemo<InvoiceStage[]>(() => {
    if (!resolved.ok) return draft
    return draft.map((s, i) =>
      s.paidAt ? s : { ...s, amountCents: resolved.stages[i]?.amountCents ?? s.amountCents },
    )
  }, [draft, resolved])

  const applySchedule = useCallback(
    (schedule: PaymentSchedule | null) => {
      if (!schedule) {
        setDraft((current) => current.filter((s) => s.paidAt))
        return
      }
      const next = resolveStages(schedule.stages, totalCents, issueDate)
      if (!next.ok) return
      setDraft(
        next.stages.map((s) => ({
          ...s,
          id: `applied-${String(s.position)}`,
          paidAt: null,
        })),
      )
    },
    [totalCents, issueDate],
  )

  const changeStages = useCallback((next: InvoiceStage[]) => {
    setDraft(next.map((s, i) => ({ ...s, position: i + 1 })))
  }, [])

  // Library writes take explicit stages from the schedule editor, never the
  // current invoice: the library and the invoice are two separate scopes.
  const createMutation = useMutation({
    mutationFn: (input: { name: string; stages: TemplateStage[] }) => createSchedule(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name?: string; stages?: TemplateStage[] }) => updateSchedule(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })

  const markPaidMutation = useMutation({
    mutationFn: async (stageId: string) => markStagePaid(stageId),
    onSuccess: (_data, stageId) => {
      setDraft((current) =>
        current.map((s) => (s.id === stageId ? { ...s, paidAt: new Date().toISOString() } : s)),
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })
  const defaultMutation = useMutation({
    mutationFn: setDefaultSchedule,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['payment-schedules'] }),
  })

  /** Persist the current stages. Called by the modal's Save handler. */
  const persist = useCallback(async () => {
    if (!invoiceId) return
    if (!resolved.ok) throw new Error(validationError ?? 'Schedule is not valid')
    await replaceInvoiceStages({ invoiceId, stages: resolved.stages })
  }, [invoiceId, resolved, validationError])

  return {
    stages,
    setStages: changeStages,
    schedules: schedulesQuery.data ?? [],
    schedulesLoading: schedulesQuery.isLoading,
    schedulesError: schedulesQuery.error ? 'Could not load your saved schedules.' : null,
    /** The MC's default schedule, so the invoice empty state can name it. */
    defaultSchedule: (schedulesQuery.data ?? []).find((s) => s.isDefault) ?? null,
    validationError,
    applySchedule,
    markPaid: (stageId: string) => markPaidMutation.mutate(stageId),
    markPendingStageId: markPaidMutation.isPending ? (markPaidMutation.variables ?? null) : null,
    // Async wrappers so the modal can await a write and toast on failure.
    createSchedule: (input: { name: string; stages: TemplateStage[] }) =>
      createMutation.mutateAsync(input).then(() => undefined),
    updateSchedule: (input: { id: string; name?: string; stages?: TemplateStage[] }) =>
      updateMutation.mutateAsync(input).then(() => undefined),
    deleteSchedule: (id: string) => deleteMutation.mutateAsync(id).then(() => undefined),
    setDefaultSchedule: (id: string) => defaultMutation.mutateAsync(id).then(() => undefined),
    persist,
  }
}
