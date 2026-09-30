/**
 * `optionsMatchLayout`: the guard that decides whether a proposal's saved
 * layout has actually changed its packages, and so whether the couple's
 * `proposal_options` rows have to be rewritten from it.
 *
 * It is the difference between the editor churning every option row (and
 * its id) on every 800ms autosave and leaving them alone, so each field it
 * does and does not compare is pinned down here.
 *
 * @module tests/unit/lib/proposals/options-match
 */
import { describe, expect, it } from 'vitest'

import { optionsMatchLayout, type StoredProposalOption, type StoredProposalOptionItem } from '@/lib/proposals/options-match'
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types'

/** A stored option row as PostgREST hands it back, overridable field by field. */
function row(patch: Partial<StoredProposalOption> = {}): StoredProposalOption {
  return {
    position: 1,
    title: 'Reception MC',
    description: 'Five hours',
    pricing_mode: 'single',
    fixed_price: 1400,
    gst_inclusive: true,
    weekend_loading_percent: null,
    is_popular: false,
    proposal_option_items: [item()],
    ...patch,
  }
}

/** One stored line inside {@link row}. */
function item(patch: Partial<StoredProposalOptionItem> = {}): StoredProposalOptionItem {
  return { position: 1, description: 'Reception hosting', amount: 0, quantity: 1, is_addon: false, default_included: true, ...patch }
}

/** The same option in the shape `packageOptionsToInputs` produces. */
function input(patch: Partial<ProposalOptionInput> = {}): ProposalOptionInput {
  return {
    id: 'new-1',
    position: 1,
    title: 'Reception MC',
    description: 'Five hours',
    sourcePackageId: null,
    pricingMode: 'single',
    fixedPrice: 1400,
    gstInclusive: true,
    weekendLoadingPercent: null,
    isPopular: false,
    items: [inputItem()],
    ...patch,
  }
}

/** One desired line inside {@link input}. */
function inputItem(patch: Partial<ProposalItemInput> = {}): ProposalItemInput {
  return { id: 'new-i1', description: 'Reception hosting', note: null, amount: 0, quantity: 1, isAddon: false, defaultIncluded: true, position: 1, ...patch }
}

describe('optionsMatchLayout', () => {
  it('matches a row that says the same thing as the layout', () => {
    expect(optionsMatchLayout([row()], [input()])).toBe(true)
  })

  it('matches two empty lists, so a proposal with no packages is never rewritten', () => {
    expect(optionsMatchLayout([], [])).toBe(true)
  })

  it('ignores ids: the stored uuid and the layout card id could never be equal', () => {
    expect(optionsMatchLayout([row()], [input({ id: '9f1d2b8a-0000-4000-8000-000000000000' })])).toBe(true)
  })

  it('ignores a per-line note, which nothing in the layout can set', () => {
    expect(optionsMatchLayout([row()], [input({ items: [inputItem({ note: 'Added by hand' })] })])).toBe(true)
  })

  it('reads a blank stored description as no description', () => {
    expect(optionsMatchLayout([row({ description: '' })], [input({ description: null })])).toBe(true)
  })

  it('compares against the couple\'s reading order, not the row order', () => {
    const stored = [row({ position: 2, title: 'Full day' }), row({ position: 1 })]
    expect(optionsMatchLayout(stored, [input(), input({ position: 2, title: 'Full day' })])).toBe(true)
  })

  it.each([
    ['a retitled option', input({ title: 'Reception host' })],
    ['a rewritten description', input({ description: 'Six hours' })],
    ['a different pricing mode', input({ pricingMode: 'itemised' })],
    ['a new price', input({ fixedPrice: 1600 })],
    ['a GST change', input({ gstInclusive: false })],
    ['weekend loading added', input({ weekendLoadingPercent: 15 })],
    ['the popular flag moved', input({ isPopular: true })],
  ])('spots %s', (_label, desired) => {
    expect(optionsMatchLayout([row()], [desired])).toBe(false)
  })

  it.each([
    ['a reworded line', inputItem({ description: 'Reception hosting and MC' })],
    ['a new amount', inputItem({ amount: 250 })],
    ['a new quantity', inputItem({ quantity: 2 })],
    ['a line turned into an add-on', inputItem({ isAddon: true })],
    ['a line no longer included by default', inputItem({ defaultIncluded: false })],
    ['a line moved up or down', inputItem({ position: 2 })],
  ])('spots %s', (_label, line) => {
    expect(optionsMatchLayout([row()], [input({ items: [line] })])).toBe(false)
  })

  it('spots an option added, and one removed', () => {
    expect(optionsMatchLayout([row()], [input(), input({ position: 2, title: 'Full day' })])).toBe(false)
    expect(optionsMatchLayout([row(), row({ position: 2, title: 'Full day' })], [input()])).toBe(false)
  })

  it('spots a line added to an option', () => {
    expect(optionsMatchLayout([row()], [input({ items: [inputItem(), inputItem({ position: 2, description: 'Rehearsal' })] })])).toBe(false)
  })

  it('treats a numeric column handed back as a string as the same number', () => {
    // Postgres `numeric` normally arrives as a JSON number; a driver that
    // stringifies it must not read as a price change on every save.
    const stringy = { ...row(), fixed_price: '1400.00' } as unknown as StoredProposalOption
    expect(optionsMatchLayout([stringy], [input()])).toBe(true)
  })
})
