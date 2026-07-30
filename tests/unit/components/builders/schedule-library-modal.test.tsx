import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScheduleLibraryModal } from '@/components/builders/parts/schedule-library-modal'
import type { PaymentSchedule } from '@/types/payment-schedule'

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const schedules: PaymentSchedule[] = [
  {
    id: 'a',
    name: 'Default',
    isDefault: true,
    stages: [
      { label: 'Deposit', amountType: 'percent', amountValue: 25, dueOffsetDays: 0 },
      { label: 'Final', amountType: 'remainder', amountValue: null, dueOffsetDays: 30 },
    ],
  },
]

function setup(overrides: Partial<Parameters<typeof ScheduleLibraryModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    schedules,
    loading: false,
    error: null,
    hasPaidStage: false,
    onApply: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSetDefault: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<ScheduleLibraryModal {...props} />)
  return props
}

describe('ScheduleLibraryModal', () => {
  it('applies a schedule when its row is clicked', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /default/i }))
    expect(props.onApply).toHaveBeenCalledWith(schedules[0])
  })

  it('shows a load error inline', () => {
    setup({ error: 'Could not load your saved schedules.' })
    expect(screen.getByText(/could not load your saved schedules/i)).toBeInTheDocument()
  })

  it('opens the editor from Edit and saves an update', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(props.onUpdate).toHaveBeenCalledWith({
      id: 'a',
      name: 'Default',
      stages: schedules[0]!.stages,
    })
  })

  it('prompts before leaving the editor with unsaved changes', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    await userEvent.click(screen.getByRole('button', { name: /add stage/i }))
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByText(/discard changes\?/i)).toBeInTheDocument()
  })

  it('confirms before deleting', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    const dialog = screen.getByText(/delete schedule\?/i).closest('div[role="dialog"]')!
    await userEvent.click(within(dialog as HTMLElement).getByRole('button', { name: /^delete$/i }))
    expect(props.onDelete).toHaveBeenCalledWith('a')
  })

  it('notes preserved paid stages when the invoice has one', () => {
    setup({ hasPaidStage: true })
    expect(screen.getByText(/keeps any stage that is already paid/i)).toBeInTheDocument()
  })
})
