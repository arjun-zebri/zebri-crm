import { describe, expect, it } from 'vitest'

import { STATUS_COLORS } from '@/lib/branding/status-colors'

describe('STATUS_COLORS', () => {
  it('exposes the three documented statuses', () => {
    expect(STATUS_COLORS).toEqual({ error: '#DC2626', success: '#16A34A', warning: '#D97706' })
  })
})
