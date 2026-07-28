/**
 * Well-formedness tests for the line-item starter catalogs (packages,
 * invoice templates).
 *
 * These ship as suggested content an MC adds with one click, so a
 * malformed entry (blank name, no items, negative price) would surface
 * directly in the product. Guards structural basics + the `startersByName`
 * resolver's resolve-and-ignore-unknown contract.
 */
import { describe, expect, it } from 'vitest'

import {
  STARTER_INVOICE_TEMPLATES,
  STARTER_PACKAGES,
  startersByName,
  type StarterLineItemSet,
} from '@/lib/payments/starter-line-item-templates'

const CATALOGS: Record<string, readonly StarterLineItemSet[]> = {
  packages: STARTER_PACKAGES,
  invoices: STARTER_INVOICE_TEMPLATES,
}

describe('line-item starter catalogs', () => {
  it('ships the agreed counts', () => {
    // Trimmed to ~3 exemplars per tab (2026-07-09 spec): the Add-on
    // package was dropped so packages read as a clean progression.
    expect(STARTER_PACKAGES).toHaveLength(3)
    expect(STARTER_INVOICE_TEMPLATES).toHaveLength(3)
  })

  for (const [label, catalog] of Object.entries(CATALOGS)) {
    describe(label, () => {
      it('has unique, non-empty names and subtitles', () => {
        const names = catalog.map((s) => s.name)
        expect(new Set(names).size).toBe(names.length)
        for (const set of catalog) {
          expect(set.name.trim().length).toBeGreaterThan(0)
          expect(set.subtitle.trim().length).toBeGreaterThan(0)
        }
      })

      it('has at least one line item, each with a description and a non-negative numeric amount', () => {
        for (const set of catalog) {
          expect(set.items.length).toBeGreaterThan(0)
          for (const item of set.items) {
            expect(item.description.trim().length).toBeGreaterThan(0)
            expect(Number.isFinite(item.amount)).toBe(true)
            expect(item.amount).toBeGreaterThanOrEqual(0)
          }
        }
      })
    })
  }
})

describe('startersByName', () => {
  it('resolves requested names from the given catalog', () => {
    const result = startersByName(STARTER_PACKAGES, ['Full Day MC', 'Ceremony MC'])
    expect(result.map((s) => s.name).sort()).toEqual(['Ceremony MC', 'Full Day MC'])
  })

  it('silently ignores unknown names so a stale client cannot inject content', () => {
    const result = startersByName(STARTER_PACKAGES, ['Full Day MC', 'Not A Real Package'])
    expect(result.map((s) => s.name)).toEqual(['Full Day MC'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(startersByName(STARTER_INVOICE_TEMPLATES, ['nope'])).toEqual([])
  })
})
