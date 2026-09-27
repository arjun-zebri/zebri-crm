/**
 * The Wait card has one number.
 *
 * Every step card carried the generic "When: after the step above, N
 * days" block, and a Wait also has its own duration chip, so the MC saw
 * two numbers and the real delay was their sum. The Wait card now shows
 * only its duration, never "Ask me before this runs" (a Wait sends
 * nothing), and saves with no start offset and no review flag. Every
 * other step keeps both controls.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StepConfigForm } from '@/app/(dashboard)/workflows/[id]/inspector-panel'
import type { AutomationActionRow } from '@/types/automations'

type UpsertInput = {
  config: Record<string, unknown>
  timing?: unknown
  requiresApproval?: boolean
}
const upsertMock = vi.fn<(input: UpsertInput) => Promise<{ ok: true }>>(async () => ({ ok: true }))

vi.mock('@/app/(dashboard)/workflows/actions', () => ({
  upsertTemplateStepRow: (input: UpsertInput) => upsertMock(input),
  setApplyRuleAction: vi.fn(),
}))

// Heavy leaves with their own tests; not what this is about.
vi.mock('@/app/(dashboard)/workflows/[id]/email-composer-modal', () => ({
  EmailComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/workflows/[id]/inspector-extended', () => ({
  ApprovalExtraFields: () => null,
  BranchExtraFields: () => null,
  CalendarEventExtraFields: () => null,
  ExtendedActionForm: () => null,
  ExtendedTriggerFields: () => null,
  RunSheetExtraFields: () => null,
  StopExtraFields: () => null,
  SubFlowExtraFields: () => null,
  UpdateCustomFieldsExtraFields: () => null,
  UpdateTimelineEventExtraFields: () => null,
}))
vi.mock('@/app/(dashboard)/workflows/[id]/filter-options', () => ({
  useCoupleStatuses: () => [],
  useQuestionnaireTemplateOptions: () => [],
}))

const TWO_DAYS_AFTER = { mode: 'after_previous', delayAmount: 2, unit: 'days' }

function row(type: string, config: Record<string, unknown>): AutomationActionRow {
  return {
    id: 'a1',
    automation_id: 'auto1',
    type,
    config,
    position: 1,
    label: null,
    parent_action_id: null,
    branch_path: null,
    // A step saved before the change: a start offset and the review flag.
    timing: TWO_DAYS_AFTER,
    requires_approval: true,
  } as unknown as AutomationActionRow
}

function renderCard(type: string, config: Record<string, unknown>) {
  render(
    <StepConfigForm
      selection={{ kind: 'action', action: row(type, config) }}
      templateId="auto1"
      onSaved={vi.fn()}
    />,
  )
}

describe('the Wait step card', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('shows one number and no review toggle', () => {
    renderCard('wait', { mode: 'duration', durationMinutes: 60 * 24, respectQuietHours: true })

    expect(screen.queryByRole('spinbutton', { name: 'How many' })).toBeNull()
    expect(screen.queryByText('When')).toBeNull()
    expect(screen.queryByRole('switch', { name: /Ask me before this runs/i })).toBeNull()
    // The old offset is folded in, so the one number is the whole delay.
    expect(screen.getByText(/3 days later/)).toBeInTheDocument()
    expect(screen.getByText(/hold until they end/)).toBeInTheDocument()
  })

  it('saves with no start offset and no review flag', async () => {
    renderCard('wait', { mode: 'duration', durationMinutes: 60 * 24, respectQuietHours: true })

    fireEvent.click(screen.getByRole('button', { name: /Remove quiet hours/i }))
    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    const sent = upsertMock.mock.calls.at(-1)![0]
    expect(sent.timing).toEqual({ mode: 'after_previous', delayAmount: 0, unit: 'days' })
    expect(sent.requiresApproval).toBe(false)
    expect(sent.config['durationMinutes']).toBe(3 * 60 * 24)
  })
})

describe('every other step card', () => {
  it('still shows the timing block and the review toggle', () => {
    renderCard('create_task', { title: 'Call the couple' })

    expect(screen.getByRole('spinbutton', { name: 'How many' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Ask me before this runs/i })).toBeInTheDocument()
  })
})
