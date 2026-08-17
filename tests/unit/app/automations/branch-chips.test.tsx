/**
 * The branch step's condition chip.
 *
 * Two contracts matter. Every predicate the chip can write has to
 * parse against `branchPredicateSchema` — it is a union of *complete*
 * members, so a half-seeded predicate is a branch that throws a config
 * error at run time rather than splitting. And the phrase the chip
 * shows has to be the phrase the collapsed card shows, since both come
 * from `branchCondition`.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { branchChips } from '@/app/(dashboard)/automations/[id]/branch-chips'
import {
  branchCondition,
  branchConditions,
  branchJoin,
} from '@/app/(dashboard)/automations/[id]/step-summary'
import { branchPredicateSchema } from '@/lib/automations/conditions'

const STATUSES = [
  { value: 'booked', label: 'Booked' },
  { value: 'enquiry', label: 'Enquiry' },
]
/** The predicate a config carries, for the schema to check. */
function predicateOf(config: Record<string, unknown>) {
  return config['predicate']
}

/** One chip out of the row this config would show. */
function chipFor(config: Record<string, unknown>, key: string) {
  return branchChips(config, STATUSES).find((c) => c.key === key)!
}

/** The keys of the chips this config would render. */
function keys(config: Record<string, unknown>) {
  return branchChips(config, STATUSES).map((c) => c.key)
}

describe('the branch chip row', () => {
  const single = { predicate: { kind: 'event_in', op: '<=', days: 60 } }
  const chained = {
    predicate: {
      kind: 'and',
      predicates: [
        { kind: 'event_in', op: '<=', days: 60 },
        { kind: 'couple_field', field: 'status', op: 'eq', value: 'booked' },
      ],
    },
  }

  it('starts empty, on the add button alone', () => {
    // A fresh branch arrives with no predicate rather than a guess
    // about which condition was meant.
    expect(branchConditions({})).toEqual([])
    expect(keys({}).filter((k) => k.startsWith('condition-'))).toEqual([])
  })

  it('offers every condition in the add menu, one row each', () => {
    // Picking a row creates that condition outright — no placeholder
    // pill you then have to open and choose inside.
    const menu = branchChips({}, STATUSES)
      .filter((c) => c.key.startsWith('add:'))
      .map((c) => c.label)
    expect(menu).toContain('How far away the wedding is')
    expect(menu).toContain('Stage')
    expect(menu).toContain('Lead source')
    expect(menu).toContain('The invoice is paid in full')

    const created = branchChips({}, STATUSES).find((c) => c.key === 'add:has_paid_deposit')!.add({})
    expect(predicateOf(created)).toEqual({ kind: 'has_paid_deposit' })
    expect(branchPredicateSchema.safeParse(predicateOf(created)).success).toBe(true)
  })

  it('gives its phrase-length rows a panel wide enough to read', () => {
    // "How far away the wedding is" was truncated in the default
    // panel, which clips rather than wrapping.
    expect(chipFor(single, 'condition-0').panelWidth).toBe('lg')
    expect(chipFor(chained, 'join').panelWidth).toBe('lg')
  })

  it('gives one condition exactly one pill', () => {
    // Splitting a single condition across a subject pill, an operator
    // pill and a value pill made one thought look like three settings.
    expect(keys(single).filter((k) => !k.startsWith('add:'))).toEqual(['condition-0'])
    expect(chipFor(single, 'condition-0').valueLabel(single)).toBe(
      'wedding is at most 60 days away',
    )
  })

  it('chains conditions, with one join between them', () => {
    expect(keys(chained).filter((k) => !k.startsWith('add:'))).toEqual([
      'condition-0',
      'join',
      'condition-1',
    ])
    expect(chipFor(chained, 'condition-1').valueLabel(chained)).toBe('stage is booked')
    expect(branchCondition(chained)).toBe(
      'wedding is at most 60 days away and stage is booked',
    )
  })

  it('adds a second condition by rewriting into a group the runner reads', () => {
    const added = chipFor(single, 'add:has_signed_contract').add(single)
    expect(branchPredicateSchema.safeParse(predicateOf(added)).success).toBe(true)
    expect(branchConditions(added)).toHaveLength(2)
    expect(branchJoin(added)).toBe('and')
  })

  it('flips the whole group between all and any', () => {
    const flipped = chipFor(chained, 'join').apply!(chained, 'or')
    expect(branchJoin(flipped)).toBe('or')
    expect(branchPredicateSchema.safeParse(predicateOf(flipped)).success).toBe(true)
    expect(branchCondition(flipped)).toContain(' or ')
  })

  it('collapses back to a bare predicate when a condition is removed', () => {
    // Nothing saved before chaining existed should change shape on
    // disk just because the branch was opened.
    const removed = chipFor(chained, 'condition-1').remove(chained)
    expect(predicateOf(removed)).toEqual({ kind: 'event_in', op: '<=', days: 60 })
    expect(branchPredicateSchema.safeParse(predicateOf(removed)).success).toBe(true)
  })

  it('refuses to remove the last condition', () => {
    // A branch with nothing to test cannot split, so the lone chip has
    // no ✕ at all.
    expect(chipFor(single, 'condition-0').required).toBe(true)
    expect(chipFor(chained, 'condition-0').required).toBeUndefined()
  })

  it('reseeds when the subject changes, rather than merging', () => {
    // Leaving `days` behind on a couple_field predicate fails the
    // union parse, which is a branch that throws instead of splitting.
    const onChange = vi.fn()
    render(chipFor(single, 'condition-0').render!(single, onChange) as ReactElement)
    fireEvent.click(screen.getByText('How far away the wedding is'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stage' }))

    const written = onChange.mock.calls[0]![0] as Record<string, unknown>
    expect(predicateOf(written)).toEqual({
      kind: 'couple_field',
      field: 'status',
      op: 'eq',
      value: '',
    })
    expect(branchPredicateSchema.safeParse(predicateOf(written)).success).toBe(true)
  })

  it('says "1 day" rather than "1 days"', () => {
    const config = { predicate: { kind: 'event_in', op: '<=', days: 1 } }
    expect(chipFor(config, 'condition-0').valueLabel(config)).toBe(
      'wedding is at most 1 day away',
    )
  })

  it('reads an operand-free comparison without a trailing blank', () => {
    const config = { predicate: { kind: 'couple_field', field: 'venue', op: 'is_unset' } }
    expect(chipFor(config, 'condition-0').valueLabel(config)).toBe('venue is empty')
    // …and the runner still accepts it without an operand.
    expect(branchPredicateSchema.safeParse(predicateOf(config)).success).toBe(true)
  })

  it('phrases the new invoice condition', () => {
    const config = { predicate: { kind: 'has_paid_invoice' } }
    expect(branchPredicateSchema.safeParse(predicateOf(config)).success).toBe(true)
    expect(branchCondition(config)).toBe('the invoice is paid in full')
  })

  it('still describes a retired custom-field branch', () => {
    // The kind is no longer offered, but a branch saved against it has
    // to keep reading as something rather than "a condition".
    expect(
      branchCondition({ predicate: { kind: 'custom_field', key: 'style', value: 'boho' } }),
    ).toContain('style')
  })
})

describe('the condition popover', () => {
  const single = { predicate: { kind: 'event_in', op: '<=', days: 60 } }

  it('is the trigger filters own comparison control, not a lookalike', () => {
    render(chipFor(single, 'condition-0').render!(single, vi.fn()) as ReactElement)
    expect(screen.getByLabelText('Number of days away')).toHaveValue('60')
    expect(screen.getByRole('menuitem', { name: 'at most' })).toBeInTheDocument()
  })

  it('commits the number on blur, keeping the operator', () => {
    const onChange = vi.fn()
    render(chipFor(single, 'condition-0').render!(single, onChange) as ReactElement)
    const field = screen.getByLabelText('Number of days away')
    fireEvent.change(field, { target: { value: '14' } })
    fireEvent.blur(field)
    expect(predicateOf(onChange.mock.calls[0]![0] as Record<string, unknown>)).toEqual({
      kind: 'event_in',
      op: '<=',
      days: 14,
    })
  })

  it('opens straight onto the subject list when there is nothing to configure', () => {
    // "The deposit is paid" has no operator and no value, so a header
    // row over an empty panel would be all there was to show.
    const config = { predicate: { kind: 'has_paid_deposit' } }
    render(chipFor(config, 'condition-0').render!(config, vi.fn()) as ReactElement)
    expect(screen.getByRole('menuitem', { name: 'The deposit is paid' })).toBeInTheDocument()
  })

  it('keeps the value field above the operators for a couple field', () => {
    const config = {
      predicate: { kind: 'couple_field', field: 'venue', op: 'contains', value: 'Calile' },
    }
    render(chipFor(config, 'condition-0').render!(config, vi.fn()) as ReactElement)
    expect(screen.getByLabelText('Value to match')).toHaveValue('Calile')
  })
})
