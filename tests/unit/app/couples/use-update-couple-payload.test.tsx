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

  it('normalises null email/phone/venue/notes to empty strings instead of failing the save', async () => {
    // `email`/`phone`/`venue`/`notes` are typed as plain `string` on
    // `Couple`, but the DB columns are nullable, so a couple can reach the
    // app with one of them still `null` (e.g. a lead submitted with no
    // venue). `updateCoupleAction`'s Zod schema requires a string for
    // these fields, so a `null` here used to fail the whole save with
    // "Invalid couple data" (reported live against the inline
    // couple-name rename in couple-profile-header.tsx). Cast past the
    // type to model that real runtime shape.
    const nullFieldCouple = {
      ...couple,
      email: null,
      phone: null,
      venue: null,
      notes: null,
    } as unknown as Couple

    const { result } = renderHook(() => useUpdateCouple(), { wrapper })

    await result.current.mutateAsync(nullFieldCouple)

    await waitFor(() => expect(updateCoupleAction).toHaveBeenCalledTimes(1))
    // Exact payload: the null fields normalise to '', and nothing else
    // about the couple changes value in the process.
    expect(updateCoupleAction.mock.calls[0]![0]).toEqual({
      id: couple.id,
      name: couple.name,
      email: '',
      phone: '',
      primary_name: null,
      primary_email: null,
      primary_phone: null,
      secondary_name: null,
      secondary_email: null,
      secondary_phone: null,
      event_date: couple.event_date,
      venue: '',
      notes: '',
      status: couple.status,
      lead_source: couple.lead_source,
      referral_source: null,
      selected_package_id: couple.selected_package_id,
      kanban_position: couple.kanban_position,
    })
  })
})
