/**
 * `loadDueSteps`: the executor's due read (Phase 3, fix 2).
 *
 * The bug it replaces dropped the read's error, so a failed read looked
 * exactly like "nothing is due" and the tick reported a clean pass. The
 * promise here is the seam itself: an error throws, an empty result is
 * an empty array, and no id list rides with the call.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { loadDueSteps } from '@/lib/workflows/due-steps'
import { AUTOMATED_STEP_TYPES } from '@/lib/workflows/steps'
import type { Database } from '@/types/database'

function clientReturning(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result)
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> }
}

const NOW = new Date('2026-09-24T00:00:00.000Z')

describe('loadDueSteps', () => {
  it('throws when the read fails, rather than returning nothing due', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'URI too long' } })

    await expect(loadDueSteps(client, { now: NOW, limit: 200 })).rejects.toThrow(
      'could not read due workflow steps: URI too long',
    )
  })

  it('returns an empty array for an empty result', async () => {
    const { client } = clientReturning({ data: [], error: null })

    await expect(loadDueSteps(client, { now: NOW, limit: 200 })).resolves.toEqual([])
  })

  it('sends the cut-off, the automated types and the limit, and no owner for the cron', async () => {
    const { client, rpc } = clientReturning({ data: [], error: null })

    await loadDueSteps(client, { now: NOW, limit: 200 })

    expect(rpc).toHaveBeenCalledWith('workflow_due_steps', {
      p_now: NOW.toISOString(),
      p_types: AUTOMATED_STEP_TYPES,
      p_limit: 200,
    })
  })

  it('scopes to one owner for the kick', async () => {
    const { client, rpc } = clientReturning({ data: [], error: null })

    await loadDueSteps(client, { now: NOW, limit: 200, userId: 'user-1' })

    expect(rpc).toHaveBeenCalledWith(
      'workflow_due_steps',
      expect.objectContaining({ p_user_id: 'user-1' }),
    )
  })
})
