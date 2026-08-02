// Requires local Supabase (Docker). Deferred: not executed in the authoring session.

import { describe, it, expect, beforeAll } from 'vitest'

import { repairRow } from '@/scripts/repair-branding-blocks'
import { serviceClient } from '@/tests/integration/helpers/supabase'

/**
 * Integration test for the branding blocks repair sweep.
 *
 * Runs against a real local Supabase instance (Docker required).
 * Tests that the sweep correctly migrates legacy block trees (headerBanner
 * to image) in actual persisted user_branding rows, and verifies idempotency.
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

    // Insert a legacy user_branding row with headerBanner blocks to migrate
    const { error: insertError } = await supabase
      .from('user_branding')
      .insert([
        {
          user_id: userId,
          branding_blocks: {
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

  it('migrates legacy headerBanner blocks and is idempotent', async () => {
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

    const blocks = data!.branding_blocks as {
      invoice: { type: string }[]
      portal: { type: string }[]
    }

    // headerBanner should be migrated to image on the invoice surface; the
    // unknown legacy invoiceBody marker is dropped.
    const invoiceTypes = blocks.invoice.map((b) => b.type)
    expect(invoiceTypes).toContain('image')
    expect(invoiceTypes).not.toContain('headerBanner')
    expect(invoiceTypes).not.toContain('invoiceBody')

    // Portal headerBanner should also migrate to image, couplePortal preserved.
    const portalTypes = blocks.portal.map((b) => b.type)
    expect(portalTypes).toContain('image')
    expect(portalTypes).not.toContain('headerBanner')
    expect(portalTypes).toContain('couplePortal')

    // Second call on already-repaired data: should return changed: false
    const second = await repairRow(supabase, userId)
    expect(second.changed).toBe(false)
  })
})
