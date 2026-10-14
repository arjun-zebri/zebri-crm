/**
 * Pipeline moves are optimistic: the card changes column at once, and a
 * failed save puts the board back exactly as it was.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/ui/toast'
import { useMoveProspect } from '@/features/outreach/views/pipeline/use-move-prospect'
import type { ProspectRow } from '@/lib/outreach/services/queries'

const updateProspectAction = vi.fn()
vi.mock('@/features/outreach/actions', () => ({
  updateProspectAction: (...args: unknown[]) => updateProspectAction(...(args as [])),
}))


const PIPELINE_KEY = ['outreach', 'pipeline']
const ada = { id: 'p1', full_name: 'Ada', stage: 'contacted' } as unknown as ProspectRow
const grace = { id: 'p2', full_name: 'Grace', stage: 'replied' } as unknown as ProspectRow

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  client.setQueryData(PIPELINE_KEY, [ada, grace])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
  const hook = renderHook(() => useMoveProspect(), { wrapper })
  return { client, hook }
}

const stagesNow = (client: QueryClient) =>
  (client.getQueryData<ProspectRow[]>(PIPELINE_KEY) ?? []).map((r) => [r.id, r.stage])

describe('useMoveProspect', () => {
  beforeEach(() => updateProspectAction.mockReset())

  it('moves the card in the cache before the save resolves', async () => {
    let finish!: (v: unknown) => void
    updateProspectAction.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const { client, hook } = setup()

    act(() => hook.result.current.mutate({ row: ada, stage: 'demo_booked' }))

    await waitFor(() => expect(stagesNow(client)).toEqual([['p1', 'demo_booked'], ['p2', 'replied']]))
    await act(async () => finish({ ok: true, data: null }))
  })

  it('restores the board from the snapshot when the save fails', async () => {
    updateProspectAction.mockResolvedValue({ ok: false, error: 'Could not save' })
    const { client, hook } = setup()

    await act(async () => {
      hook.result.current.mutate({ row: ada, stage: 'demo_booked' })
    })

    await waitFor(() => expect(hook.result.current.isError).toBe(true))
    expect(stagesNow(client)).toEqual([['p1', 'contacted'], ['p2', 'replied']])
  })
})
