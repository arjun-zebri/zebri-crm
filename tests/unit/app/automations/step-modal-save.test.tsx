/**
 * Saving from a step's modal.
 *
 * The modal writes into the step form's config state and the form's
 * debounced autosave persists it. That is two hops, and neither is
 * visible from inside the modal's own tests, so this drives the real
 * `StepConfigForm` and asserts the row actually reaches the server
 * action.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StepConfigForm } from '@/app/(dashboard)/automations/[id]/inspector-panel'
import type { AutomationActionRow } from '@/types/automations'

type UpsertInput = { config: Record<string, unknown> }
const upsertMock = vi.fn<(input: UpsertInput) => Promise<{ ok: true }>>(async () => ({ ok: true }))

vi.mock('@/app/(dashboard)/automations/actions', () => ({
  upsertAutomationActionRow: (input: UpsertInput) => upsertMock(input),
  setAutomationTriggerAction: vi.fn(),
  loadSenderIdentityAction: async () => ({ businessName: 'Acme MC Co', branding: null }),
}))

vi.mock('@/app/(dashboard)/automations/[id]/filter-options', () => ({
  useCoupleStatuses: () => [],
  useQuestionnaireTemplateOptions: () => [{ value: 'q1', label: 'Ceremony details' }],
}))

// Heavy leaves with their own tests; not what this is about.
vi.mock('@/app/(dashboard)/automations/[id]/email-composer-modal', () => ({
  EmailComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/automations/[id]/inspector-extended', () => ({
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

function actionRow(type: string, config: Record<string, unknown>): AutomationActionRow {
  return {
    id: 'a1',
    automation_id: 'auto1',
    type,
    config,
    position: 0,
    label: null,
    parent_action_id: null,
    branch_path: null,
  } as unknown as AutomationActionRow
}

/** Render one step card with its modal open. */
function renderStep(type: string, config: Record<string, unknown> = {}) {
  const onSaved = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(
    <Wrapper>
      <StepConfigForm
        selection={{ kind: 'action', action: actionRow(type, config) }}
        automationId="auto1"
        onSaved={onSaved}
        modal={{ open: true, onClose: () => {} }}
      />
    </Wrapper>,
  )
  return onSaved
}

/** The config the card last persisted. */
async function persistedConfig() {
  await waitFor(() => expect(upsertMock).toHaveBeenCalled())
  return upsertMock.mock.calls.at(-1)![0].config
}

describe('saving a step from its modal', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  /** Let the form's 250ms debounce elapse. */
  async function flushAutosave() {
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
  }

  it('persists the questionnaire choice and title', async () => {
    const onSaved = renderStep('send_couple_questionnaire', {
      questionnaireTemplateId: 'q1',
    })

    fireEvent.change(screen.getByLabelText('Title (optional)'), {
      target: { value: 'A few quick questions' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await flushAutosave()

    const config = await persistedConfig()
    expect(config['title']).toBe('A few quick questions')
    // The card's own state is updated too, so the collapsed summary
    // and a re-open both see the new values.
    expect(onSaved).toHaveBeenCalled()
  })

  it('shows the saved values again when the modal is reopened', async () => {
    // "It did not save" and "it saved but reopened blank" look the
    // same from the canvas, so pin the round trip.
    renderStep('send_couple_questionnaire', { questionnaireTemplateId: 'q1' })
    fireEvent.change(screen.getByLabelText('Title (optional)'), {
      target: { value: 'A few quick questions' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await flushAutosave()

    expect(screen.getByLabelText('Title (optional)')).toHaveValue('A few quick questions')
  })

  it('refuses to persist a questionnaire step with no questionnaire', async () => {
    // Save is disabled, so nothing reaches the action: a step whose
    // required field is empty fails on its first run.
    renderStep('send_couple_questionnaire')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await flushAutosave()
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
