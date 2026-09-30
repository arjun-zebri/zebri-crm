/**
 * The layout-card to `proposal_options` id mapping (`render/package-ids`).
 *
 * A proposal made from a template renders the template's own package
 * cards, whose ids are the editor's `pk-…` / `pi-…` strings, while the
 * accept route takes uuids: the couple could read the proposal and not
 * accept it. The mapper keeps the cards and swaps their ids for the
 * proposal's rows, matched by position, and refuses the whole substitution
 * the moment the two sides stop lining up.
 *
 * @module tests/unit/features/proposals/render/package-ids
 */
import { describe, expect, it } from 'vitest'

import { withProposalOptionIds } from '@/features/proposals'
import type { PublicProposalItem, PublicProposalOption } from '@/lib/proposals/public-types'

/** One priced line. `position` defaults to the order the caller lists them in. */
function item(id: string, is_addon: boolean, position: number): PublicProposalItem {
  return { id, description: id, note: null, amount: 100, quantity: 1, is_addon, default_included: false, position }
}

/** One card or option row; everything but `id`/`items` is presentation the mapper must carry through untouched. */
function option(id: string, items: PublicProposalItem[], position = 0): PublicProposalOption {
  return {
    id, position, title: `title of ${id}`, description: null, pricing_mode: 'single', fixed_price: 1400,
    gst_inclusive: true, weekend_loading_percent: null, is_popular: false, subtotal: 1400, items,
    cta_label: 'Choose this one', cta_background_color: '#112233',
  }
}

const ROW_A = 'cf3e94b3-5569-4a8d-92b6-b7b0bde12306'
const ROW_B = '4a6d1f02-7f1a-4a3e-9c2f-0b5d8e6a1c44'

describe('withProposalOptionIds substitutes by position', () => {
  it('equal counts: each card takes its row id, add-ons and inclusions in order', () => {
    const cards = [
      option('pk-starter-1', [item('pi-1', false, 0), item('pi-2', true, 1), item('pi-3', true, 2)]),
      option('pk-starter-2', [item('pi-4', false, 0)], 1),
    ]
    const rows = [
      option(ROW_A, [item('row-inc-1', false, 0), item('row-add-1', true, 1), item('row-add-2', true, 2)]),
      option(ROW_B, [item('row-inc-2', false, 0)], 1),
    ]
    const mapped = withProposalOptionIds(cards, rows)
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.options.map((o) => o.id)).toEqual([ROW_A, ROW_B])
    expect(mapped.options[0]!.items.map((i) => i.id)).toEqual(['row-inc-1', 'row-add-1', 'row-add-2'])
    expect(mapped.options[1]!.items.map((i) => i.id)).toEqual(['row-inc-2'])
  })

  it('keeps the card\'s presentation: only the ids change', () => {
    const cards = [option('pk-1', [item('pi-1', false, 0)])]
    const rows = [option(ROW_A, [item('row-1', false, 0)])]
    const mapped = withProposalOptionIds(cards, rows)
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.options[0]).toEqual({ ...cards[0]!, id: ROW_A, items: [{ ...cards[0]!.items[0]!, id: 'row-1' }] })
  })

  it('matches each kind of line within its own kind, so an add-on never takes an inclusion\'s id', () => {
    // The card lists its add-on first, the row lists it last: what matters
    // is that add-on ids stay add-on ids (the accept schema's `addonIds`).
    const cards = [option('pk-1', [item('pi-add', true, 0), item('pi-inc', false, 1)])]
    const rows = [option(ROW_A, [item('row-inc', false, 0), item('row-add', true, 1)])]
    const mapped = withProposalOptionIds(cards, rows)
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.options[0]!.items.map((i) => [i.id, i.is_addon])).toEqual([['row-add', true], ['row-inc', false]])
  })

  it('reads the row\'s items in position order, not the order the payload happened to arrive in', () => {
    const cards = [option('pk-1', [item('pi-1', false, 0), item('pi-2', false, 1)])]
    const rows = [option(ROW_A, [item('row-second', false, 1), item('row-first', false, 0)])]
    const mapped = withProposalOptionIds(cards, rows)
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.options[0]!.items.map((i) => i.id)).toEqual(['row-first', 'row-second'])
  })

  it('ids that are already the row uuids pass through unchanged', () => {
    const cards = [option(ROW_A, [item('row-1', false, 0)])]
    const rows = [option(ROW_A, [item('row-1', false, 0)])]
    const mapped = withProposalOptionIds(cards, rows)
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.options).toEqual(cards)
  })
})

describe('withProposalOptionIds falls back rather than guess', () => {
  it('a card-count mismatch', () => {
    const cards = [option('pk-1', [item('pi-1', false, 0)]), option('pk-2', [item('pi-2', false, 0)], 1)]
    const mapped = withProposalOptionIds(cards, [option(ROW_A, [item('row-1', false, 0)])])
    expect(mapped.ok).toBe(false)
    if (mapped.ok) return
    expect(mapped.reason).toContain('2 layout cards against 1 option rows')
  })

  it('an add-on-count mismatch inside an otherwise matching card', () => {
    const cards = [option('pk-1', [item('pi-1', false, 0), item('pi-2', true, 1)])]
    const mapped = withProposalOptionIds(cards, [option(ROW_A, [item('row-1', false, 0)])])
    expect(mapped.ok).toBe(false)
    if (mapped.ok) return
    expect(mapped.reason).toContain('card 1 has 1 add-on lines against 0')
  })

  it('an inclusion-count mismatch inside an otherwise matching card', () => {
    const cards = [option('pk-1', [item('pi-1', false, 0), item('pi-2', false, 1)])]
    const mapped = withProposalOptionIds(cards, [option(ROW_A, [item('row-1', false, 0)])])
    expect(mapped.ok).toBe(false)
    if (mapped.ok) return
    expect(mapped.reason).toContain('card 1 has 2 inclusion lines against 1')
  })

  it('an empty options list, and an absent one', () => {
    const cards = [option('pk-1', [item('pi-1', false, 0)])]
    expect(withProposalOptionIds(cards, []).ok).toBe(false)
    expect(withProposalOptionIds(cards, undefined).ok).toBe(false)
  })

  it('one bad card fails the whole mapping, never a half-substituted page', () => {
    const cards = [option('pk-1', [item('pi-1', false, 0)]), option('pk-2', [item('pi-2', true, 0)], 1)]
    const rows = [option(ROW_A, [item('row-1', false, 0)]), option(ROW_B, [item('row-2', false, 0)], 1)]
    expect(withProposalOptionIds(cards, rows).ok).toBe(false)
  })
})
