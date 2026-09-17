/**
 * AU financial-year (Jul-Jun) and BAS-quarter (calendar quarter) range
 * math for the payments reports date filter.
 */
import { describe, expect, it } from 'vitest'

import { getCurrentQuarter, getCustomRange, getFinancialYear } from '@/lib/payments/financial-year'

describe('getFinancialYear', () => {
  it('places a date in Jan-Jun in the FY that started the previous July', () => {
    const range = getFinancialYear(new Date('2026-03-15'))
    expect(range.start).toBe('2025-07-01')
    expect(range.end).toBe('2026-06-30')
  })

  it('places a date in Jul-Dec in the FY that starts that July', () => {
    const range = getFinancialYear(new Date('2026-09-15'))
    expect(range.start).toBe('2026-07-01')
    expect(range.end).toBe('2027-06-30')
  })

  it('steps back yearsAgo full financial years', () => {
    const range = getFinancialYear(new Date('2026-09-15'), 1)
    expect(range.start).toBe('2025-07-01')
    expect(range.end).toBe('2026-06-30')
  })

  it('labels with the short date format, not raw ISO', () => {
    const range = getFinancialYear(new Date('2026-09-15'))
    expect(range.label).toBe('FY27 (1 Jul 2026 - 30 Jun 2027)')
  })
})

describe('getCurrentQuarter', () => {
  it('resolves a Jul-Sep date to Q1', () => {
    const range = getCurrentQuarter(new Date('2026-08-01'))
    expect(range.start).toBe('2026-07-01')
    expect(range.end).toBe('2026-09-30')
  })

  it('resolves an Oct-Dec date to Q2', () => {
    const range = getCurrentQuarter(new Date('2026-11-15'))
    expect(range.start).toBe('2026-10-01')
    expect(range.end).toBe('2026-12-31')
  })

  it('resolves a Jan-Mar date to Q3, spanning a leap-day February', () => {
    const range = getCurrentQuarter(new Date('2028-02-10'))
    expect(range.start).toBe('2028-01-01')
    expect(range.end).toBe('2028-03-31')
  })

  it('resolves an Apr-Jun date to Q4', () => {
    const range = getCurrentQuarter(new Date('2026-05-01'))
    expect(range.start).toBe('2026-04-01')
    expect(range.end).toBe('2026-06-30')
  })

  it('uses the same short-date label format as a financial year', () => {
    const range = getCurrentQuarter(new Date('2026-08-01'))
    expect(range.label).toBe('Q1 BAS (1 Jul 2026 - 30 Sep 2026)')
  })
})

describe('getCustomRange', () => {
  it('carries the given start/end through, labelled "Custom"', () => {
    const range = getCustomRange('2026-01-01', '2026-03-31')
    expect(range.start).toBe('2026-01-01')
    expect(range.end).toBe('2026-03-31')
    expect(range.label).toBe('Custom (1 Jan 2026 - 31 Mar 2026)')
  })
})
