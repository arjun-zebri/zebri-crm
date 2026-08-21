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
} from '@/app/(dashboard)/payments/schedule-actions'
import { resolveStages, toTemplateStages } from '@/lib/payments/resolve-stages'
import type { InvoiceStage, ResolvedStage, TemplateStage } from '@/types/payment-schedule'

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
  dueDate: string | null
  initialStages: InvoiceStage[]
}) {
  const { invoiceId, totalCents, issueDate, dueDate, initialStages } = input
  const queryClient = useQueryClient()

  // `draft` holds only what the MC edits: labels, amount types, values, dates.
  // Amounts are NOT stored here; see the `stages` memo below.
  const [draft, setDraft] = useState<InvoiceStage[]>(initialStages)

  /**
   * Manually set due dates, keyed by stage id.
   *
   * A stage's date is normally a pure function of its offset, so
   * {@link resolveStages} recomputes it on every render and `persist` writes
   * what the resolver produced. That silently threw away a date the MC had
   * just typed into the row's DatePicker: the edit showed on screen (the
   * display reads `draft`) and saved without error, then reverted on reopen.
   * Overrides are held apart from `draft` so the resolver stays pure and the
   * offset the stage came from is still round-tripped to the schedule modal.
   */
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({})

  // Re-seed the draft when the invoice this hook is bound to changes. The
  // `useState` initializer only runs on mount, and on mount the invoice query
  // is still pending — so `initialStages` is [] and the draft would stay empty
  // even after the invoice (and its saved stages) load a moment later. Adjusting
  // state during render (React's sanctioned pattern) re-seeds without a
  // `useEffect`, which this repo bans for setState. It fires only on an id
  // change, so an applied-but-unsaved draft on the current invoice is preserved.
  const [seededInvoiceId, setSeededInvoiceId] = useState(invoiceId)
  if (invoiceId !== seededInvoiceId) {
    setSeededInvoiceId(invoiceId)
    setDraft(initialStages)
    // A different invoice's stage ids can never match these, but clearing
    // keeps the map from growing for the life of the modal.
    setDueDateOverrides({})
  }

  const schedulesQuery = useQuery({ queryKey: ['payment-schedules'], queryFn: listSchedules })

  /** Template view of the current stages, for re-resolution and saving. */
  const template = useMemo<TemplateStage[]>(() => toTemplateStages(draft), [draft])

  const resolved = useMemo(
    () => resolveStages(template, totalCents, issueDate, dueDate),
    [template, totalCents, issueDate, dueDate],
  )

  const validationError = resolved.ok ? null : messageFor(resolved.errors[0]?.code ?? '')

  /**
   * The resolved stages with any manual date edits laid back over the top.
   *
   * This is what gets persisted. Matching is positional because `resolved`
   * is built from `draft` in order, so index i on one is index i on the other.
   */
  const resolvedForPersist = useMemo<ResolvedStage[]>(() => {
    if (!resolved.ok) return []
    return resolved.stages.map((stage, i) => {
      const id = draft[i]?.id
      const override = id ? dueDateOverrides[id] : undefined
      return override ? { ...stage, dueDate: override } : stage
    })
  }, [resolved, draft, dueDateOverrides])

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

  /**
   * Resolve a template against this invoice and set it as the stages. Called by
   * the modal's Apply. Paid stages are preserved in the database at persist time
   * by `replaceInvoiceStages`; here the draft takes the newly resolved shape.
   */
  const applyTemplate = useCallback(
    (stagesTemplate: TemplateStage[]) => {
      const next = resolveStages(stagesTemplate, totalCents, issueDate, dueDate)
      if (!next.ok) return
      setDraft(
        next.stages.map((s) => ({
          ...s,
          id: `applied-${String(s.position)}`,
          paidAt: null,
        })),
      )
      // Reapplying a schedule recomputes every date from its offsets, which
      // is the point of reapplying. Keeping the old overrides would pin dates
      // to a shape the MC has just replaced.
      setDueDateOverrides({})
    },
    [totalCents, issueDate, dueDate],
  )

  const changeStages = useCallback((next: InvoiceStage[]) => {
    setDraft(next.map((s, i) => ({ ...s, position: i + 1 })))
  }, [])

  /**
   * Update the due date of an unpaid stage.
   *
   * Writes to both the draft (so the row shows it immediately) and the
   * override map (so `persist` writes it instead of the offset-derived date).
   * Reapplying a template clears overrides: that recomputes all dates, which
   * is intentional, and the MC can re-edit afterwards.
   */
  const updateStageDueDate = useCallback((stageId: string, newDueDate: string) => {
    setDraft((current) =>
      current.map((s) => (s.id === stageId ? { ...s, dueDate: newDueDate } : s)),
    )
    setDueDateOverrides((current) => ({ ...current, [stageId]: newDueDate }))
  }, [])

  // Library writes take explicit stages from the modal, never the current
  // invoice: the library and the invoice are two separate scopes. Save always
  // creates (the modal handles name collisions), so there is no update path.
  const createMutation = useMutation({
    mutationFn: (input: { name: string; stages: TemplateStage[] }) => createSchedule(input),
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

  /**
   * Persist the current stages. Called by the invoice's Save handler, which
   * passes the freshly-created invoice id for a brand-new invoice: the hook's
   * own `invoiceId` is still null on that first save, so without the override
   * a new invoice's schedule would silently never be written.
   */
  const persist = useCallback(
    async (overrideId?: string) => {
      const id = overrideId ?? invoiceId
      if (!id) return
      if (!resolved.ok) throw new Error(validationError ?? 'Schedule is not valid')
      await replaceInvoiceStages({ invoiceId: id, stages: resolvedForPersist })
    },
    [invoiceId, resolved, resolvedForPersist, validationError],
  )

  return {
    stages,
    setStages: changeStages,
    updateStageDueDate,
    schedules: schedulesQuery.data ?? [],
    schedulesLoading: schedulesQuery.isLoading,
    schedulesError: schedulesQuery.error ? 'Could not load your saved schedules.' : null,
    /** The MC's default schedule, so the invoice empty state can name it. */
    defaultSchedule: (schedulesQuery.data ?? []).find((s) => s.isDefault) ?? null,
    validationError,
    applyTemplate,
    markPaid: (stageId: string) => markPaidMutation.mutate(stageId),
    markPendingStageId: markPaidMutation.isPending ? (markPaidMutation.variables ?? null) : null,
    // Async wrappers so the modal can await a write and toast on failure.
    createSchedule: (input: { name: string; stages: TemplateStage[] }) =>
      createMutation.mutateAsync(input).then(() => undefined),
    deleteSchedule: (id: string) => deleteMutation.mutateAsync(id).then(() => undefined),
    setDefaultSchedule: (id: string) => defaultMutation.mutateAsync(id).then(() => undefined),
    persist,
  }
}
