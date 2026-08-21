/**
 * The update-couple mutation sends an explicit field whitelist to
 * `updateCoupleAction`. Every column the couple profile can edit has to be on
 * that list: the action's Zod schema defaults a missing field to null and
 * writes it, so an omitted field is not "left alone", it is wiped.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useUpdateCouple } from '@/app/(dashboard)/couples/use-couples'
import type { Couple } from '@/types/couple'

const updateCoupleAction = vi.fn()

vi.mock('@/app/(dashboard)/couples/actions', () => ({
  createCoupleAction: vi.fn(),
  bulkCreateCouplesAction: vi.fn(),
  deleteCoupleAction: vi.fn(),
  bulkDeleteCouplesAction: vi.fn(),
  bulkUpdateCoupleStatusAction: vi.fn(),
  upsertCoupleEventDateAction: vi.fn(),
  updateCoupleAction: (input: unknown) => updateCoupleAction(input),
}))

const couple: Couple = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'user-1',
  name: 'Jack and Jill',
  email: '',
  phone: '',
  event_date: null,
  venue: '',
  notes: '',
  status: 'new',
  lead_source: null,
  kanban_position: 0,
  created_at: '2026-01-01T00:00:00Z',
  selected_package_id: '22222222-2222-4222-8222-222222222222',
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  updateCoupleAction.mockReset()
  updateCoupleAction.mockResolvedValue({ ok: true, data: couple })
})

describe('useUpdateCouple payload', () => {
  it('carries the selected package so a later save does not wipe it', async () => {
    const { result } = renderHook(() => useUpdateCouple(), { wrapper })

    await result.current.mutateAsync(couple)

    await waitFor(() => expect(updateCoupleAction).toHaveBeenCalledTimes(1))
    expect(updateCoupleAction.mock.calls[0]![0]).toMatchObject({
      id: couple.id,
      selected_package_id: '22222222-2222-4222-8222-222222222222',
    })
  })

  it('sends null rather than omitting the field when no package is chosen', async () => {
    const { result } = renderHook(() => useUpdateCouple(), { wrapper })

    await result.current.mutateAsync({ ...couple, selected_package_id: null })

    await waitFor(() => expect(updateCoupleAction).toHaveBeenCalledTimes(1))
    const payload = updateCoupleAction.mock.calls[0]![0] as Record<string, unknown>
    expect('selected_package_id' in payload).toBe(true)
    expect(payload.selected_package_id).toBeNull()
  })
})
