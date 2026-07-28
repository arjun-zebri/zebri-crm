// Requires local Supabase (Docker). Deferred: not executed in the authoring session.

import { describe, it, expect, beforeAll } from 'vitest'

import { repairRow } from '@/scripts/repair-branding-blocks'
import { serviceClient } from '@/tests/integration/helpers/supabase'

/**
 * Integration test for the branding blocks repair sweep.
 *
 * Runs against a real local Supabase instance (Docker required).
 * Tests that the sweep correctly migrates legacy block trees (proposalBody,
 * headerBanner) in actual persisted user_branding rows, and verifies idempotency.
 *
 * This test is deferred until Docker is available. It runs in CI/CD against
 * the real local Supabase stack to verify production-ready behavior.
 */

describe('branding repair sweep (integration)', () => {
  let userId: string

  beforeAll(async () => {
    // Create a test user and insert a legacy user_branding row
    const supabase = serviceClient()

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `repair-sweep-${Date.now()}@test.local`,
      password: 'test-password-do-not-use',
      email_confirm: true,
    })

    if (authError) {
      throw new Error(`Failed to create test user: ${authError.message}`)
    }

    userId = authUser.user.id

    // Insert a legacy user_branding row with proposalBody marker + headerBanner
    const { error: insertError } = await supabase
      .from('user_branding')
      .insert([
        {
          user_id: userId,
          branding_blocks: {
            proposal: [
              { id: 'hb1', type: 'headerBanner' },
              { id: 'pb1', type: 'proposalBody', locked: true },
            ],
            invoice: [
              { id: 'hb2', type: 'headerBanner' },
              { id: 'ib', type: 'invoiceBody', locked: true },
            ],
            contract: [],
            portal: [
              { id: 'hb3', type: 'headerBanner' },
              { id: 'cp', type: 'couplePortal', locked: true },
            ],
            vendorTimeline: [],
            questionnaire: [],
          },
        },
      ])

    if (insertError) {
      throw new Error(`Failed to insert test branding row: ${insertError.message}`)
    }
  })

  it('migrates legacy proposalBody + headerBanner and is idempotent', async () => {
    const supabase = serviceClient()

    // First call: should repair and return changed: true
    const first = await repairRow(supabase, userId)
    expect(first.changed).toBe(true)

    // Verify the stored row has been repaired
    const { data } = await supabase
      .from('user_branding')
      .select('branding_blocks')
      .eq('user_id', userId)
      .single()

    expect(data).toBeDefined()

    const proposal = (data!.branding_blocks as { proposal: { type: string }[] }).proposal
    const proposalTypes = proposal.map((b) => b.type)

    // proposalBody should be migrated to package blocks (packageHeader, packageTotals, etc.)
    expect(proposalTypes).toContain('packageHeader')
    expect(proposalTypes).toContain('packageTotals')

    // headerBanner should be migrated to image
    expect(proposalTypes).toContain('image')

    // proposalBody marker should not exist (replaced by package blocks)
    expect(proposalTypes).not.toContain('proposalBody')

    // Second call on already-repaired data: should return changed: false
    const second = await repairRow(supabase, userId)
    expect(second.changed).toBe(false)
  })
})
