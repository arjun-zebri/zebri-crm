/**
 * Unit tests for `ProposalRoleChooser`, the role-picker modal shown the
 * first time an MC opens the proposal surface.
 *
 * @module tests/unit/app/branding/proposal-role-chooser
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const chooseProposalRoleActionMock = vi.hoisted(() => vi.fn())
vi.mock('@/app/(dashboard)/branding/proposal-role-actions', () => ({
  chooseProposalRoleAction: chooseProposalRoleActionMock,
}))

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

import { ProposalRoleChooser } from '@/app/(dashboard)/branding/proposal-role-chooser'

describe('ProposalRoleChooser', () => {
  it('calls the action with the clicked role, then onChosen on success', async () => {
    chooseProposalRoleActionMock.mockResolvedValueOnce({ ok: true, data: { packagesAdded: 2 } })
    const onChosen = vi.fn()
    const user = userEvent.setup()

    render(<ProposalRoleChooser open onChosen={onChosen} />)
    await user.click(screen.getByRole('button', { name: 'Celebrant' }))

    await waitFor(() => expect(chooseProposalRoleActionMock).toHaveBeenCalledWith('celebrant'))
    expect(onChosen).toHaveBeenCalledWith('celebrant')
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Starter design applied'), 'success')
  })

  it('shows an error toast and does not call onChosen when the action fails', async () => {
    chooseProposalRoleActionMock.mockResolvedValueOnce({ ok: false, error: 'Could not save your choice.' })
    const onChosen = vi.fn()
    const user = userEvent.setup()

    render(<ProposalRoleChooser open onChosen={onChosen} />)
    await user.click(screen.getByRole('button', { name: 'MC' }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Could not save your choice.', 'error'))
    expect(onChosen).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    render(<ProposalRoleChooser open={false} onChosen={vi.fn()} />)
    expect(screen.queryByText('What do you offer?')).not.toBeInTheDocument()
  })
})
