#!/usr/bin/env tsx

/**
 * One-time idempotent repair sweep over all user_branding rows.
 *
 * Streams every user_branding record, applies repairAllSurfaces() to the
 * branding_blocks, and writes back only when JSON changed. Safe to re-run.
 *
 * Usage: tsx scripts/repair-branding-blocks.ts
 * (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars)
 *
 * @module scripts/repair-branding-blocks
 */

import { createClient } from '@supabase/supabase-js'

import { repairAllSurfaces, type BlocksByDoc } from '@/lib/branding/validate-blocks'
import type { Database } from '@/types/database'

/**
 * Stable JSON stringify: sorts keys so identical objects have identical JSON,
 * enabling deep-equality checks without special comparison logic.
 */
function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort())
}

/**
 * Repair a single user's branding_blocks row.
 *
 * Fetches the current branding_blocks, applies repairAllSurfaces(), compares
 * the JSON representation, and upserts only if changed.
 *
 * @param supabase - Supabase client (service role or authenticated)
 * @param userId - UUID of the user
 * @returns Promise resolving to { changed: boolean }
 */
export async function repairRow(supabase: ReturnType<typeof createClient<Database>>, userId: string): Promise<{ changed: boolean }> {
  // Select the branding_blocks for this user
  const { data, error: selectError } = await supabase
    .from('user_branding')
    .select('branding_blocks')
    .eq('user_id', userId)
    .single()

  if (selectError) {
    // User may not have a branding row yet (not an error)
    if (selectError.code === 'PGRST116') {
      return { changed: false }
    }
    throw selectError
  }

  if (!data) {
    return { changed: false }
  }

  const blocks = (data.branding_blocks ?? {}) as Partial<BlocksByDoc>
  const original = stableStringify(blocks)

  // Apply repair
  const repaired = repairAllSurfaces(blocks)
  const repairResult = stableStringify(repaired)

  // If unchanged, skip the write
  if (original === repairResult) {
    return { changed: false }
  }

  // Upsert the repaired blocks
  const { error: upsertError } = await supabase
    .from('user_branding')
    .upsert({ user_id: userId, branding_blocks: repaired } as never, { onConflict: 'user_id' })

  if (upsertError) {
    throw new Error(`Failed to upsert branding blocks: ${upsertError.message}`)
  }

  return { changed: true }
}

/**
 * Main: stream all user_branding rows and repair each.
 * Logs a summary of changed rows.
 */
async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient<Database>(supabaseUrl, serviceKey)

  console.log('Starting branding blocks repair sweep...')

  let totalRows = 0
  let changedRows = 0
  const pageSize = 100
  let offset = 0

  // Pagination loop over all user_branding rows
  while (true) {
    const { data, error: pageError } = await supabase
      .from('user_branding')
      .select('user_id')
      .range(offset, offset + pageSize - 1)

    if (pageError) {
      console.error('Error fetching page:', pageError)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      break
    }

    for (const row of data) {
      totalRows++
      try {
        const result = await repairRow(supabase, row.user_id)
        if (result.changed) {
          changedRows++
          console.log(`  ✓ repaired ${row.user_id}`)
        }
      } catch (err) {
        console.error(`  ✗ failed ${row.user_id}:`, err)
      }
    }

    offset += pageSize

    // Stop if we got fewer rows than the page size (last page)
    if (data.length < pageSize) {
      break
    }
  }

  console.log(`\nRepair complete: ${changedRows}/${totalRows} rows changed`)
  process.exit(0)
}

// Run if executed directly (not imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
