/**
 * Chip removal through a real step card.
 *
 * The chips themselves were already covered; what was not was the
 * wiring between them and the form's state. Every chip row used to be
 * handed the *merging* setter, so a `fieldFilter` chip — whose
 * `remove` deletes its keys — had them spread straight back on. The
 * chip vanished from the card while the runner carried on using the
 * value, which is the worst shape a bug can take in a builder. (The
 * task due chip survived it by writing `undefined` rather than
 * deleting, which is luck, not design.)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StepConfigForm } from '@/app/(dashboard)/automations/[id]/inspector-panel'
import type { AutomationActionRow } from '@/types/automations'

const upsertMock = vi.fn(async () => ({ ok: true }))

vi.mock('@/app/(dashboard)/automations/actions', () => ({
  upsertAutomationActionRow: (...args: unknown[]) => upsertMock(...(args as [])),
  setAutomationTriggerAction: vi.fn(),
}))

// The composer (and the TipTap editor behind it) is a large module
// graph that has its own tests; pulling it into this worker made the
// whole unit project several times slower.
vi.mock('@/app/(dashboard)/automations/[id]/email-composer-modal', () => ({
  EmailComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/automations/[id]/task-composer-modal', () => ({
  TaskComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/automations/[id]/note-composer-modal', () => ({
  NoteComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/automations/[id]/questionnaire-composer-modal', () => ({
  QuestionnaireComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/automations/[id]/timeline-composer-modal', () => ({
  TimelineComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/automations/[id]/run-sheet-composer-modal', () => ({
  RunSheetComposerModal: () => null,
}))
vi.mock('@/app/(dashboard)/automations/[id]/document-composer-modal', () => ({
  DocumentComposerModal: () => null,
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

// The couple-status options hit Supabase; the chips under test don't
// need them.
vi.mock('@/app/(dashboard)/automations/[id]/filter-options', () => ({
  useCoupleStatuses: () => [],
  useQuestionnaireTemplateOptions: () => [],
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

/** Render one action's card and return the saved-config spy. */
function renderStep(type: string, config: Record<string, unknown>) {
  const onSaved = vi.fn()
  render(
    <StepConfigForm
      selection={{ kind: 'action', action: actionRow(type, config) }}
      automationId="auto1"
      onSaved={onSaved}
    />,
  )
  return onSaved
}

/** The config the card last autosaved. */
async function savedConfig(onSaved: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  const last = onSaved.mock.calls.at(-1)![0] as { config: Record<string, unknown> }
  return last.config
}

describe('removing a chip from a step card', () => {
  it('clears the field it owned on create_task', async () => {
    const onSaved = renderStep('create_task', {
      title: 'Call the couple',
      relativeToEvent: { amount: 7, unit: 'days', direction: 'before' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Remove due/i }))

    const config = await savedConfig(onSaved)
    expect(config['relativeToEvent']).toBeUndefined()
    // The rest of the step is untouched — removal is not a reset.
    expect(config['title']).toBe('Call the couple')
  })

  it('clears an optional field on create_couple', async () => {
    const onSaved = renderStep('create_couple', { name: 'Anna & Jake', phone: '0400 000 000' })

    fireEvent.click(screen.getByRole('button', { name: /Remove phone/i }))

    const config = await savedConfig(onSaved)
    expect(config['phone']).toBeUndefined()
    expect(config['name']).toBe('Anna & Jake')
  })
})
