import { describe, expect, it } from 'vitest'

import { formatAUD } from '@/lib/payments/format'

describe('formatAUD', () => {
  it('renders whole dollars without cents', () => {
    expect(formatAUD(1500)).toBe('$1,500')
    expect(formatAUD(0)).toBe('$0')
  })

  it('renders cents when present', () => {
    expect(formatAUD(1500.5)).toBe('$1,500.50')
    expect(formatAUD(0.05)).toBe('$0.05')
  })

  it('rounds sub-cent noise instead of showing it', () => {
    expect(formatAUD(10.999)).toBe('$11')
    expect(formatAUD(10.005)).toBe('$10.01')
  })

  it('treats non-finite input as zero', () => {
    expect(formatAUD(NaN)).toBe('$0')
  })
})
