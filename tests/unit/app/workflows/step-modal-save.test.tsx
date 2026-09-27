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

import { StepConfigForm } from '@/app/(dashboard)/workflows/[id]/inspector-panel'
import { ToastProvider } from '@/components/ui/toast'
import type { AutomationActionRow } from '@/types/automations'

type UpsertInput = { config: Record<string, unknown>; requiresApproval?: boolean }
type UpsertResult = { ok: true } | { ok: false; error: string }
const upsertMock = vi.fn<(input: UpsertInput) => Promise<UpsertResult>>(async () => ({ ok: true }))

vi.mock('@/app/(dashboard)/workflows/actions', () => ({
  upsertTemplateStepRow: (input: UpsertInput) => upsertMock(input),
  setApplyRuleAction: vi.fn(),
  loadSenderIdentityAction: async () => ({
    businessName: 'Acme MC Co',
    contactName: 'Charlie Park',
    email: 'charlie@acmemc.com',
    branding: null,
  }),
}))

vi.mock('@/app/(dashboard)/workflows/[id]/filter-options', () => ({
  useCoupleStatuses: () => [],
  useQuestionnaireTemplateOptions: () => [{ value: 'q1', label: 'Ceremony details' }],
}))

// Heavy leaves with their own tests; not what this is about.
const composerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('@/app/(dashboard)/workflows/[id]/email-composer-modal', () => ({
  EmailComposerModal: (props: Record<string, unknown>) => {
    composerProps.current = props
    return null
  },
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
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
  render(
    <Wrapper>
      <StepConfigForm
        selection={{ kind: 'action', action: actionRow(type, config) }}
        templateId="auto1"
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

describe('the review toggle on a modal-only step', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('reaches the email composer, which is the only place left to set it', async () => {
    // `send_email`'s card never expands, so the toggle the inline panel
    // renders is unreachable for it. The composer carries it instead.
    renderStep('send_email')
    await waitFor(() => expect(composerProps.current).not.toBeNull())

    const review = composerProps.current!['review'] as
      | { checked: boolean; onChange: (v: boolean) => void }
      | undefined
    expect(review).toBeDefined()
    expect(review!.checked).toBe(false)

    await act(async () => {
      review!.onChange(true)
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    expect(upsertMock.mock.calls.at(-1)![0].requiresApproval).toBe(true)
  })
})

describe('a step whose copy lives in its schema', () => {
  it('opens the composer already written', async () => {
    // The post-event emails store `{}` until edited, because their
    // subject and body are Zod `.default()` values applied when the
    // runner parses. Handed the raw config, the modal opened blank on
    // an email that was fully written.
    renderStep('send_thank_you_message')
    await waitFor(() => expect(composerProps.current).not.toBeNull())

    const config = composerProps.current!['config'] as Record<string, unknown>
    expect(String(config['subject']).length).toBeGreaterThan(0)
    expect(String(config['body'])).toContain('{{couple.primary_name}}')
  })
})

describe('a save the runner would reject (Task 33)', () => {
  beforeEach(() => {
    upsertMock.mockReset()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('says why, rather than failing silently', async () => {
    const refusal =
      'The "Send couple questionnaire" step has invalid settings: Title is required. Fix this before saving.'
    upsertMock.mockResolvedValue({ ok: false, error: refusal })
    renderStep('send_couple_questionnaire', { questionnaireTemplateId: 'q1' })
    fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(await screen.findByText(refusal)).toBeInTheDocument()
  })

  it('leaves the canvas card on its stored values when refused (review I1)', async () => {
    upsertMock.mockResolvedValue({ ok: false, error: 'Refused.' })
    const onSaved = renderStep('send_couple_questionnaire', { questionnaireTemplateId: 'q1' })
    fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value: 'Never saved' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    await screen.findByText('Refused.')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('updates the card with exactly what the server accepted', async () => {
    let resolve: (v: UpsertResult) => void = () => {}
    upsertMock.mockImplementation(() => new Promise<UpsertResult>((r) => { resolve = r }))
    const onSaved = renderStep('send_couple_questionnaire', { questionnaireTemplateId: 'q1' })
    fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value: 'Accepted' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    // Not before the server answers.
    expect(onSaved).not.toHaveBeenCalled()
    await act(async () => {
      resolve({ ok: true })
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
    const payload = onSaved.mock.calls[0]![0] as { config: Record<string, unknown> }
    expect(payload.config['title']).toBe('Accepted')
  })

  it('does not toast a refusal for a save a newer one already replaced (Task 33 re-review)', async () => {
    // The first save is slow and refused; the second is fast and accepted.
    const answers: ((v: UpsertResult) => void)[] = []
    upsertMock.mockImplementation(() => new Promise<UpsertResult>((r) => answers.push(r)))
    renderStep('send_couple_questionnaire', { questionnaireTemplateId: 'q1' })
    for (const value of ['old', 'new']) {
      fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await act(async () => {
        vi.advanceTimersByTime(400)
      })
    }
    await waitFor(() => expect(answers).toHaveLength(2))
    await act(async () => {
      answers[1]!({ ok: true })
    })
    await act(async () => {
      answers[0]!({ ok: false, error: 'Stale refusal.' })
    })
    expect(screen.queryByText('Stale refusal.')).not.toBeInTheDocument()
  })

  it('does not repeat the same refusal toast while the MC keeps typing (review M1)', async () => {
    upsertMock.mockResolvedValue({ ok: false, error: 'Refused again.' })
    renderStep('send_couple_questionnaire', { questionnaireTemplateId: 'q1' })
    for (const value of ['a', 'ab']) {
      fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await act(async () => {
        vi.advanceTimersByTime(400)
      })
      await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    }
    await screen.findByText('Refused again.')
    expect(screen.getAllByText('Refused again.')).toHaveLength(1)
  })
})
