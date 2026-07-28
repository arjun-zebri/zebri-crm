import { describe, expect, it } from 'vitest'

import {
  VARIABLES_BY_SURFACE,
  getVariable,
  isKnownVariable,
  formatVariableValue,
} from '@/lib/branding/document-variables'

describe('document variable registry', () => {
  it('offers couple + business variables on every surface', () => {
    for (const vars of Object.values(VARIABLES_BY_SURFACE)) {
      const ids = vars.map((v) => v.id)
      expect(ids).toContain('couple_name')
      expect(ids).toContain('business_name')
    }
  })

  it('offers invoice-specific amounts only on the invoice surface', () => {
    expect(VARIABLES_BY_SURFACE.invoice.map((v) => v.id)).toContain('deposit_amount')
    expect(VARIABLES_BY_SURFACE.contract.map((v) => v.id)).not.toContain('deposit_amount')
  })

  it('resolves and rejects ids via the flat lookup', () => {
    expect(getVariable('couple_name')?.label).toBe('Couple name')
    expect(isKnownVariable('couple_name')).toBe(true)
    expect(getVariable('not_a_variable')).toBeUndefined()
    expect(isKnownVariable('not_a_variable')).toBe(false)
  })

  it('has no duplicate ids with conflicting definitions on a surface', () => {
    for (const vars of Object.values(VARIABLES_BY_SURFACE)) {
      const seen = new Map<string, string>()
      for (const v of vars) {
        const prior = seen.get(v.id)
        if (prior) expect(prior).toBe(v.label) // same id => same label
        seen.set(v.id, v.label)
      }
    }
  })
})

describe('formatVariableValue', () => {
  it('renders a missing value as empty (never a raw chip)', () => {
    expect(formatVariableValue('text', null)).toBe('')
    expect(formatVariableValue('text', undefined)).toBe('')
    expect(formatVariableValue('text', '')).toBe('')
    expect(formatVariableValue('currency', null)).toBe('')
    expect(formatVariableValue('date', undefined)).toBe('')
  })

  it('formats currency in AUD', () => {
    expect(formatVariableValue('currency', 2500)).toBe('$2,500.00')
    expect(formatVariableValue('currency', '180')).toBe('$180.00')
  })

  it('ignores non-numeric currency input', () => {
    expect(formatVariableValue('currency', 'abc')).toBe('')
  })

  it('formats ISO dates in UTC to avoid timezone drift', () => {
    expect(formatVariableValue('date', '2026-04-30')).toBe('30 April 2026')
  })

  it('passes non-ISO date strings through unchanged', () => {
    expect(formatVariableValue('date', 'TBC')).toBe('TBC')
  })

  it('stringifies text values', () => {
    expect(formatVariableValue('text', 'Sarah & James')).toBe('Sarah & James')
  })
})
