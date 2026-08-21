/**
 * Unit tests for `usePackages`.
 *
 * The hook is shared by the couple profile's Overview row (which always has an
 * owner id) and the Add/Edit Couple modal (which has none until the couple is
 * saved). The empty case is the one that was broken.
 *
 * @module tests/unit/app/couples/use-packages.test
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePackages } from '@/app/(dashboard)/couples/use-packages'
import { createClient } from '@/lib/supabase/client'

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))

/** Records the value the query filters `user_id` on. */
let ownerFilter: string | undefined

function mockSupabase(sessionUserId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        sessionUserId
          ? { data: { user: { id: sessionUserId } }, error: null }
          : { data: { user: null }, error: null },
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_col: string, value: string) => {
          ownerFilter = value
          return {
            is: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'pkg-1',
                    name: 'Full day',
                    description: null,
                    gst_inclusive: true,
                    package_items: [
                      { amount: 1000, quantity: 1, optional: false },
                      { amount: 250, quantity: 2, optional: false },
                      { amount: 500, quantity: 1, optional: true },
                    ],
                  },
                ],
                error: null,
              }),
            })),
          }
        }),
      })),
    })),
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('usePackages', () => {
  beforeEach(() => {
    ownerFilter = undefined
    vi.clearAllMocks()
  })

  it('filters on the supplied owner when there is one', async () => {
    vi.mocked(createClient).mockReturnValue(
      mockSupabase('session-user') as unknown as ReturnType<typeof createClient>,
    )

    const { result } = renderHook(() => usePackages('couple-owner'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(ownerFilter).toBe('couple-owner')
  })

  // The Add Couple modal has no couple to read an owner from, and passed ''
  // straight through. PostgREST rejects `user_id=eq.` on a uuid column with a
  // 22P02, so the chooser reported "No packages available" for every new
  // couple while React Query retried the failure in the background.
  it('falls back to the signed-in user when no owner is supplied', async () => {
    vi.mocked(createClient).mockReturnValue(
      mockSupabase('session-user') as unknown as ReturnType<typeof createClient>,
    )

    const { result } = renderHook(() => usePackages(''), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(ownerFilter).toBe('session-user')
    expect(ownerFilter).not.toBe('')
    expect(result.current.data).toHaveLength(1)
  })

  it('totals required items only, multiplied by quantity', async () => {
    vi.mocked(createClient).mockReturnValue(
      mockSupabase('session-user') as unknown as ReturnType<typeof createClient>,
    )

    const { result } = renderHook(() => usePackages(''), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // 1000 * 1 + 250 * 2, with the optional 500 add-on excluded.
    expect(result.current.data![0]!.total_amount).toBe(1500)
  })

  it('errors rather than querying with an empty owner when signed out', async () => {
    vi.mocked(createClient).mockReturnValue(
      mockSupabase(null) as unknown as ReturnType<typeof createClient>,
    )

    const { result } = renderHook(() => usePackages(''), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(ownerFilter).toBeUndefined()
  })
})
