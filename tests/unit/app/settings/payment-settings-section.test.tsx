/**
 * Settings, bank details (Task 23c): a blur saves the changed fields
 * through the 2FA-guarded RPC, never through `auth.updateUser`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PaymentSettingsSection } from '@/app/(dashboard)/settings/payment-settings-section'

const toastMock = vi.fn()
const rpc = vi.fn()
const updateUser = vi.fn()
const refreshSession = vi.fn()

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc, auth: { updateUser, refreshSession, getUser: vi.fn() } }),
}))
vi.mock('@stripe/connect-js/pure', () => ({ loadConnectAndInitialize: vi.fn() }))
vi.mock('@stripe/react-connect-js', () => ({
  ConnectAccountManagement: () => null,
  ConnectAccountOnboarding: () => null,
  ConnectComponentsProvider: () => null,
  ConnectNotificationBanner: () => null,
}))

function renderSection() {
  render(
    <PaymentSettingsSection
      initialBankAccountName="Jane Events"
      initialBankBsb="062-000"
      initialBankAccountNumber="12345678"
      stripeConnectAccountId={null}
      stripeConnectEnabled={false}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: {}, error: null })
  refreshSession.mockResolvedValue({ data: {}, error: null })
})

describe('PaymentSettingsSection bank details', () => {
  it('sends only the changed field to set_my_payment_details, never updateUser', async () => {
    renderSection()
    const bsb = screen.getByPlaceholderText('e.g. 062-000')
    fireEvent.change(bsb, { target: { value: '083-004' } })
    fireEvent.blur(bsb)
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('set_my_payment_details', { p_details: { bank_bsb: '083-004' } }),
    )
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('does nothing on a blur with no change', () => {
    renderSection()
    fireEvent.blur(screen.getByPlaceholderText('e.g. 062-000'))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('explains a malformed BSB instead of saving it', async () => {
    renderSection()
    const bsb = screen.getByPlaceholderText('e.g. 062-000')
    fireEvent.change(bsb, { target: { value: '12' } })
    fireEvent.blur(bsb)
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('BSB must be 6 digits', 'error'))
    expect(rpc).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('shows the database refusal (a password-only session of a 2FA MC)', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'second factor required' } })
    renderSection()
    const number = screen.getByPlaceholderText('e.g. 12345678')
    fireEvent.change(number, { target: { value: '87654321' } })
    fireEvent.blur(number)
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('Confirm your two-factor code, then try again.', 'error'),
    )
  })
})
