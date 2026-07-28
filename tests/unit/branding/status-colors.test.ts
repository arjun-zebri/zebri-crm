import { describe, expect, it } from 'vitest'

import { STATUS_COLORS } from '@/lib/branding/status-colors'

describe('STATUS_COLORS', () => {
  it('exposes the three documented statuses', () => {
    expect(STATUS_COLORS).toEqual({ error: '#DC2626', success: '#16A34A', warning: '#D97706' })
  })

  // The assertion above pins the values but moves with them if someone edits
  // both together. These check properties a careless change would break
  // without the editor noticing: an added status nobody handles, or a value
  // written in a format the inline style attributes cannot consume.
  it('carries exactly the statuses the surfaces know how to render', () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual(['error', 'success', 'warning'])
  })

  it('states every colour as a six-digit hex', () => {
    for (const value of Object.values(STATUS_COLORS)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/)
    }
  })
})
