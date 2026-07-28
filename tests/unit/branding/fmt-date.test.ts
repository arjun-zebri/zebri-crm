import { describe, expect, it } from 'vitest'

import { fmtDate } from '@/lib/branding/public-blocks/shared'

describe('fmtDate', () => {
  it('formats a YYYY-MM-DD date without timezone drift', () => {
    // Would render "31 December 2026" in UTC but "1 January 2027" in UTC+10
    // if the date were parsed as local time on one side only.
    expect(fmtDate('2026-12-31')).toBe('31 December 2026')
  })

  it('formats mid-year dates', () => {
    expect(fmtDate('2026-09-14')).toBe('14 September 2026')
  })
})
