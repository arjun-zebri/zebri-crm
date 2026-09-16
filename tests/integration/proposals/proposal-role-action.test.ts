/**
 * chooseProposalRoleAction integration test against local Supabase.
 *
 * Covers: a first-time choice seeds two starter packages and their items
 * and stamps `user_branding.proposal_role`; a second choice with an
 * existing package adds nothing; re-choosing a different role still only
 * updates the role; an invalid role is rejected before any write.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { chooseProposalRoleAction } from '@/app/(dashboard)/branding/proposal-role-actions'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user')
    return activeUser.client
  }),
}))

afterEach(() => {
  activeUser = null
})

describe('chooseProposalRoleAction (integration)', () => {
  it('seeds two starter packages and their items, and stamps proposal_role', async () => {
    const user = await createTestUser()
    activeUser = user
    try {
      const result = await chooseProposalRoleAction('celebrant')
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(result.error)
      expect(result.data.packagesAdded).toBe(2)

      const admin = serviceClient()
      const { data: branding } = await admin
        .from('user_branding')
        .select('proposal_role')
        .eq('user_id', user.id)
        .single()
      expect(branding?.proposal_role).toBe('celebrant')

      const { data: packages } = await admin
        .from('packages')
        .select('id, name, is_starter')
        .eq('user_id', user.id)
        .order('position', { ascending: true })
      expect(packages).toHaveLength(2)
      expect(packages?.every((p) => p.is_starter)).toBe(true)
      expect(packages?.map((p) => p.name)).toEqual(['Legals Only', 'Story Ceremony'])

      const { data: items } = await admin
        .from('package_items')
        .select('package_id')
        .eq('user_id', user.id)
      expect(items?.length).toBe(5) // 2 + 3 items across the two celebrant packages
    } finally {
      await user.cleanup()
    }
  })

  it('adds nothing when the MC already owns a package', async () => {
    const user = await createTestUser()
    activeUser = user
    try {
      const admin = serviceClient()
      const { error } = await admin
        .from('packages')
        .insert({ user_id: user.id, name: 'My Own Package', position: 1000 })
      if (error) throw new Error(`fixture package insert failed: ${error.message}`)

      const result = await chooseProposalRoleAction('mc')
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(result.error)
      expect(result.data.packagesAdded).toBe(0)

      const { data: packages } = await admin.from('packages').select('id').eq('user_id', user.id)
      expect(packages).toHaveLength(1)
    } finally {
      await user.cleanup()
    }
  })

  it('is idempotent: calling again with a new role only updates the role', async () => {
    const user = await createTestUser()
    activeUser = user
    try {
      const first = await chooseProposalRoleAction('celebrant')
      expect(first.ok).toBe(true)

      const second = await chooseProposalRoleAction('mc')
      expect(second.ok).toBe(true)
      if (!second.ok) throw new Error(second.error)
      expect(second.data.packagesAdded).toBe(0)

      const admin = serviceClient()
      const { data: branding } = await admin
        .from('user_branding')
        .select('proposal_role')
        .eq('user_id', user.id)
        .single()
      expect(branding?.proposal_role).toBe('mc')

      const { data: packages } = await admin.from('packages').select('id').eq('user_id', user.id)
      expect(packages).toHaveLength(2) // still the celebrant starter pair, no mc rows added
    } finally {
      await user.cleanup()
    }
  })

  it('rejects an invalid role string', async () => {
    const user = await createTestUser()
    activeUser = user
    try {
      // @ts-expect-error deliberately invalid input to prove server-side rejection
      const result = await chooseProposalRoleAction('officiant')
      expect(result.ok).toBe(false)
    } finally {
      await user.cleanup()
    }
  })
})
