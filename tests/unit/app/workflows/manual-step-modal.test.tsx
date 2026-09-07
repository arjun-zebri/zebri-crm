/**
 * The manual steps (`todo`, `appointment`) configure themselves in a
 * modal, like every other step whose config is a form.
 *
 * The step's title lives on the row rather than in `config`, and the
 * timing control travels into the modal with the fields, so both hops
 * are driven here through the real `StepConfigForm` rather than
 * against the modal on its own.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MODAL_ACTIONS, StepConfigForm } from '@/app/(dashboard)/workflows/[id]/inspector-panel'
import type { AutomationActionRow } from '@/types/automations'

type UpsertInput = { config: Record<string, unknown>; label?: string }
const upsertMock = vi.fn<(input: UpsertInput) => Promise<{ ok: true }>>(async () => ({ ok: true }))

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
  useQuestionnaireTemplateOptions: () => [],
  useMeetingTypeOptions: () => [{ value: 'm1', label: 'Planning call' }],
}))

function actionRow(type: string, label: string | null = null): AutomationActionRow {
  return {
    id: 'a1',
    automation_id: 'auto1',
    type,
    config: {},
    position: 1,
    label,
    parent_action_id: null,
    branch_path: null,
  } as unknown as AutomationActionRow
}

/** Render one manual step with its modal open. */
function renderStep(type: string, label: string | null = null) {
  const onSaved = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(
    <Wrapper>
      <StepConfigForm
        selection={{ kind: 'action', action: actionRow(type, label) }}
        templateId="auto1"
        onSaved={onSaved}
        modal={{ open: true, onClose: () => {} }}
      />
    </Wrapper>,
  )
  return onSaved
}

describe('the manual steps', () => {
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

  it('open in a modal rather than expanding the card', () => {
    // The canvas reads this set to decide whether a node expands or
    // opens a modal; a manual step that is not in it goes back to the
    // inline panel.
    expect(MODAL_ACTIONS.has('todo')).toBe(true)
    expect(MODAL_ACTIONS.has('appointment')).toBe(true)
  })

  it('persists the name onto the row and the note into config', async () => {
    // The card had nowhere to name a to-do, so every one of them read
    // "To-do / Give it a name" for good.
    const onSaved = renderStep('todo')

    fireEvent.change(screen.getByLabelText('What needs doing'), {
      target: { value: 'Ring the venue' },
    })
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Ask for the access time' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await flushAutosave()

    await waitFor(() => expect(upsertMock).toHaveBeenCalled())
    const row = upsertMock.mock.calls.at(-1)![0]
    expect(row.label).toBe('Ring the venue')
    expect(row.config['description']).toBe('Ask for the access time')
    // The canvas card takes its title from the same payload, so it
    // renames without waiting for the round trip.
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'action', label: 'Ring the venue' }),
    )
  })

  it('refuses to save an unnamed step', async () => {
    renderStep('todo')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await flushAutosave()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('carries the timing control, which the card no longer shows', async () => {
    // Making the node modal-only collapses its inline body for good,
    // so anything left behind on the card becomes unreachable.
    renderStep('todo', 'Ring the venue')
    expect(screen.getByLabelText('When')).toBeInTheDocument()
  })

  it('offers the meeting type on an appointment only', () => {
    renderStep('appointment', 'Planning call')
    expect(screen.getByLabelText('Booked through')).toBeInTheDocument()
  })
})
