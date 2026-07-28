import { describe, it, expect } from 'vitest'

import type { BlocksByDoc } from '@/lib/branding/validate-blocks'
import { repairRow } from '@/scripts/repair-branding-blocks'

/**
 * Unit test for the branding blocks repair sweep.
 *
 * Uses a mock Supabase client to test the repairRow function in isolation
 * without requiring a running database. Tests that:
 * 1. Legacy proposalBody + headerBanner trees are migrated and marked changed
 * 2. Second call on repaired data is idempotent (changed: false)
 */

describe('branding repair sweep', () => {
  it('migrates legacy proposalBody + headerBanner and is idempotent', async () => {
    // Legacy branding_blocks with proposalBody marker (pre-Task-6 format)
    const legacyBlocks: BlocksByDoc = {
      proposal: [
        { id: 'hb', type: 'headerBanner' },
        { id: 'pb', type: 'proposalBody', locked: true },
      ],
      invoice: [],
      contract: [],
      portal: [
        { id: 'hb2', type: 'headerBanner' },
      ],
      vendorTimeline: [],
      questionnaire: [],
    }

    const userId = 'test-user-id'

    // Mock Supabase client: simulates selecting and upserting a row
    let storedBlocks = JSON.parse(JSON.stringify(legacyBlocks)) as BlocksByDoc
    let upsertCalled = false

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'user_branding') {
          return {
            select: () => ({
              eq: (col: string, val: unknown) => ({
                single: async () => {
                  if (col === 'user_id' && val === userId) {
                    return { data: { branding_blocks: storedBlocks }, error: null }
                  }
                  return { data: null, error: { code: 'PGRST116', message: 'Not found' } }
                },
              }),
            }),
            upsert: async (row: { user_id: string; branding_blocks: unknown }) => {
              if (row && row.user_id === userId) {
                storedBlocks = JSON.parse(JSON.stringify(row.branding_blocks)) as BlocksByDoc
                upsertCalled = true
              }
              return { error: null }
            },
          }
        }
        return {}
      },
    }

    // First call: should migrate legacy blocks and return changed: true
    upsertCalled = false
    const first = await repairRow(mockSupabase as never, userId)

    expect(first.changed).toBe(true)
    expect(upsertCalled).toBe(true)

    // Verify stored blocks were repaired
    const proposal = storedBlocks.proposal
    const proposalTypes = proposal.map((b) => b.type)

    // proposalBody should be migrated to packageHeader + packageTotals + other package blocks
    expect(proposalTypes).toContain('packageHeader')
    expect(proposalTypes).toContain('packageTotals')

    // headerBanner should be migrated to image
    expect(proposalTypes).toContain('image')
    // proposalBody marker should no longer exist (replaced by package blocks)
    expect(proposalTypes).not.toContain('proposalBody')

    // Portal should also have headerBanner migrated to image
    const portalTypes = storedBlocks.portal.map((b) => b.type)
    expect(portalTypes).toContain('image')
    expect(portalTypes).not.toContain('headerBanner')

    // Second call on already-repaired data: should return changed: false
    upsertCalled = false
    const second = await repairRow(mockSupabase as never, userId)

    expect(second.changed).toBe(false)
    expect(upsertCalled).toBe(false) // No upsert needed, data didn't change
  })
})
