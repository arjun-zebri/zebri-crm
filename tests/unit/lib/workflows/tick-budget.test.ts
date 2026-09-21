import { describe, expect, it, vi } from 'vitest'

import { runTimeEmitters } from '@/lib/automations/time-emitters'

// Every registered emitter would need a live database; a deadline already
// in the past must stop the loop before the first one runs.
describe('runTimeEmitters deadline', () => {
  it('skips every emitter when the deadline has passed and says how many', async () => {
    const supabase = { from: vi.fn(() => { throw new Error('must not query') }) }
    const result = await runTimeEmitters(supabase as never, { deadline: Date.now() - 1 })
    expect(result.totalEmitted).toBe(0)
    expect(result.skippedEmitters).toBeGreaterThan(0)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
