import { describe, expect, it, vi } from 'vitest'

import { getAccountReadiness } from '@/lib/branding/account-readiness'
import type { EntitlementSource } from '@/lib/auth/entitlements'

describe('getAccountReadiness', () => {
  it('returns all true when stripe connected + all three bank fields + contract template exists', async () => {
    const mockUser: EntitlementSource = {
      app_metadata: { stripe_connect_enabled: true },
      user_metadata: {
        bank_account_name: 'My Business Account',
        bank_bsb: '123456',
        bank_account_number: '98765432',
      },
    }

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({
        data: [],
        count: 1,
        error: null,
      }),
    }

    const result = await getAccountReadiness(mockSupabase as any, mockUser)

    expect(result).toEqual({
      stripeConnected: true,
      bankDetailsFilled: true,
      contractTemplateExists: true,
    })
  })

  it('returns all false when stripe not connected + no bank fields + no contract template', async () => {
    const mockUser: EntitlementSource = {
      app_metadata: { stripe_connect_enabled: false },
      user_metadata: {
        bank_account_name: null,
        bank_bsb: null,
        bank_account_number: null,
      },
    }

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      }),
    }

    const result = await getAccountReadiness(mockSupabase as any, mockUser)

    expect(result).toEqual({
      stripeConnected: false,
      bankDetailsFilled: false,
      contractTemplateExists: false,
    })
  })

  it('returns bankDetailsFilled false when missing bank_account_name', async () => {
    const mockUser: EntitlementSource = {
      app_metadata: { stripe_connect_enabled: true },
      user_metadata: {
        bank_account_name: null,
        bank_bsb: '123456',
        bank_account_number: '98765432',
      },
    }

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({
        data: [],
        count: 1,
        error: null,
      }),
    }

    const result = await getAccountReadiness(mockSupabase as any, mockUser)

    expect(result.bankDetailsFilled).toBe(false)
  })

  it('returns bankDetailsFilled false when missing bank_bsb', async () => {
    const mockUser: EntitlementSource = {
      app_metadata: { stripe_connect_enabled: true },
      user_metadata: {
        bank_account_name: 'My Business Account',
        bank_bsb: null,
        bank_account_number: '98765432',
      },
    }

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({
        data: [],
        count: 1,
        error: null,
      }),
    }

    const result = await getAccountReadiness(mockSupabase as any, mockUser)

    expect(result.bankDetailsFilled).toBe(false)
  })

  it('returns bankDetailsFilled false when missing bank_account_number', async () => {
    const mockUser: EntitlementSource = {
      app_metadata: { stripe_connect_enabled: true },
      user_metadata: {
        bank_account_name: 'My Business Account',
        bank_bsb: '123456',
        bank_account_number: null,
      },
    }

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({
        data: [],
        count: 1,
        error: null,
      }),
    }

    const result = await getAccountReadiness(mockSupabase as any, mockUser)

    expect(result.bankDetailsFilled).toBe(false)
  })

  it('returns contractTemplateExists false when count is 0', async () => {
    const mockUser: EntitlementSource = {
      app_metadata: { stripe_connect_enabled: true },
      user_metadata: {
        bank_account_name: 'My Business Account',
        bank_bsb: '123456',
        bank_account_number: '98765432',
      },
    }

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      }),
    }

    const result = await getAccountReadiness(mockSupabase as any, mockUser)

    expect(result.contractTemplateExists).toBe(false)
  })
})
