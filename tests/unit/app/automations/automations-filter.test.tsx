/**
 * Filter logic test for the /automations home page.
 *
 * `applyFilter` is the pure status + query filter applied to the
 * enriched rows before they hit the list renderer. Pure → no
 * React required.
 */
import { describe, expect, it } from 'vitest'

import { applyFilter } from '@/app/(dashboard)/automations/automations-filter'
import type { AutomationStatus } from '@/types/automations'

type Row = { status: AutomationStatus; name: string; triggerLabel: string }

const rows: Row[] = [
  { status: 'active', name: 'Quote follow-up', triggerLabel: 'Quote accepted' },
  { status: 'paused', name: 'Wedding week', triggerLabel: 'X time before wedding' },
  { status: 'draft', name: 'Anniversary', triggerLabel: 'Anniversary of wedding' },
  { status: 'active', name: 'Onboarding pack', triggerLabel: 'Contract signed' },
]

describe('applyFilter', () => {
  it("returns everything when status='all' and no query", () => {
    expect(applyFilter(rows, 'all', '')).toHaveLength(4)
  })

  it('narrows by status', () => {
    const out = applyFilter(rows, 'active', '')
    expect(out).toHaveLength(2)
    expect(out.map((r) => r.name)).toEqual(['Quote follow-up', 'Onboarding pack'])
  })

  it('narrows by query - name match', () => {
    const out = applyFilter(rows, 'all', 'anniv')
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('Anniversary')
  })

  it('narrows by query - trigger label match', () => {
    const out = applyFilter(rows, 'all', 'contract')
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('Onboarding pack')
  })

  it('combines status and query (intersection)', () => {
    const out = applyFilter(rows, 'active', 'quote')
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('Quote follow-up')
  })
})
