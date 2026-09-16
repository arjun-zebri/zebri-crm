import { describe, expect, it } from 'vitest'

import { ALL_SURFACE_TABS, buildEnabledSurfacesMap, resolveEnabledSurfaces } from '@/lib/branding/enabled-surfaces'

describe('enabled surfaces: proposal', () => {
  it('is in the canonical list after lead', () => {
    expect(ALL_SURFACE_TABS).toEqual(['invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire', 'lead', 'proposal'])
  })
  it('a legacy array without proposal still enables it', () => {
    expect(resolveEnabledSurfaces(['invoice'])).toEqual(['invoice', 'lead', 'proposal'])
  })
  it('a legacy map without proposal still enables it, and an explicit false disables it', () => {
    expect(resolveEnabledSurfaces({ invoice: true })).toEqual(['invoice', 'lead', 'proposal'])
    expect(resolveEnabledSurfaces({ invoice: true, proposal: false })).toEqual(['invoice', 'lead'])
  })
  it('the persisted map carries an explicit proposal boolean', () => {
    expect(buildEnabledSurfacesMap(['invoice']).proposal).toBe(false)
  })
})
