/**
 * `loadCoupleSnapshot` must source the couple's event date + venue from
 * the `events` table (the canonical store since events moved off the
 * couple row), falling back to the legacy `couples.event_date`/`venue`
 * columns for pre-migration couples.
 *
 * Regression: without this, `{{event.date}}` / `{{venue.name}}` resolve
 * empty for every couple whose event is managed via the Events tab, so a
 * manually-sent template (and automations) ship with the date/venue
 * blank — the "variables default to null" bug.
 */
import { describe, expect, it } from 'vitest'

import { loadCoupleSnapshot } from '@/lib/automations/context'

const COUPLE_ID = 'c1'

interface TableData {
  couples: Record<string, unknown> | null
  portal_people: Record<string, unknown> | null
  events: { date: string | null; venue: string | null } | null
}

/** A chainable Supabase stub that resolves per-table to `data[table]`. */
function makeSupabase(data: TableData) {
  const builder = (table: keyof TableData) => {
    const result = { data: data[table], error: null }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) {
      chain[m] = () => chain
    }
    chain['single'] = () => Promise.resolve(result)
    chain['maybeSingle'] = () => Promise.resolve(result)
    return chain
  }
  return { from: (table: keyof TableData) => builder(table) } as never
}

describe('loadCoupleSnapshot event sourcing', () => {
  it('reads event date + venue from the events table', async () => {
    const supabase = makeSupabase({
      couples: { id: COUPLE_ID, name: 'Sam & Alex', status: 'booked', event_date: null, venue: null },
      portal_people: null,
      events: { date: '2026-11-14', venue: 'The Calile' },
    })

    const snap = await loadCoupleSnapshot(supabase, COUPLE_ID)
    expect(snap?.eventDate).toBe('2026-11-14')
    expect(snap?.venue).toBe('The Calile')
  })

  it('falls back to the legacy couples columns when there is no event', async () => {
    const supabase = makeSupabase({
      couples: { id: COUPLE_ID, name: 'Sam & Alex', status: 'booked', event_date: '2026-09-01', venue: 'Old Hall' },
      portal_people: null,
      events: null,
    })

    const snap = await loadCoupleSnapshot(supabase, COUPLE_ID)
    expect(snap?.eventDate).toBe('2026-09-01')
    expect(snap?.venue).toBe('Old Hall')
  })
})
