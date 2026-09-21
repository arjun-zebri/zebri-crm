/**
 * Builder step-save timing validation.
 *
 * The builder's save path must refuse a timing the engine would
 * otherwise silently coerce to the default. `upsertTemplateStepRow`
 * now validates `timing` through the same `stepTimingSchema` the
 * copilot and the engine use, so an off-grid minutes delay is rejected
 * before it ever reaches the column.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestUser, type TestUser } from '../helpers/supabase'

// `revalidatePath` needs a Next request store, which vitest has no way
// to provide; stub it the same way `instance-actions.test.ts` does.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user: set activeUser first')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import { upsertTemplateStepRow } from '@/app/(dashboard)/workflows/actions'

describe('upsertTemplateStepRow timing validation', () => {
  let user: TestUser
  let templateId: string

  beforeAll(async () => {
    user = await createTestUser()
    const { data, error } = await user.client
      .from('workflow_templates')
      .insert({
        user_id: user.id,
        name: 'Timing',
        status: 'draft',
        apply_rule_type: 'manual',
        apply_rule_config: {},
      } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    templateId = (data as { id: string }).id
  })

  afterEach(() => {
    activeUser = null
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  it('rejects off-grid minutes', async () => {
    activeUser = user
    const result = await upsertTemplateStepRow({
      templateId,
      position: 0,
      type: 'todo',
      config: {},
      label: 'x',
      timing: { mode: 'after_previous', delayAmount: 10, unit: 'minutes' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Invalid timing: .*multiple of 15/)
  })
})
