import { describe, expect, it } from 'vitest'

import {
  ALL_SURFACE_TABS,
  buildEnabledSurfacesMap,
  resolveEnabledSurfaces,
} from '@/lib/branding/enabled-surfaces'

describe('resolveEnabledSurfaces', () => {
  it('enables every surface when nothing is saved', () => {
    expect(resolveEnabledSurfaces(null)).toEqual(ALL_SURFACE_TABS)
    expect(resolveEnabledSurfaces(undefined)).toEqual(ALL_SURFACE_TABS)
  })

  it('reads the legacy map shape and defaults a missing lead key to enabled', () => {
    const saved = {
      invoice: true,
      contract: true,
      portal: true,
      vendorTimeline: true,
      questionnaire: true,
    }
    expect(resolveEnabledSurfaces(saved)).toEqual(ALL_SURFACE_TABS)
  })

  it('keeps surfaces the user disabled (absent keys in the legacy map) off', () => {
    const saved = { contract: true, portal: true }
    // lead and proposal both predate this map shape, so both default on.
    expect(resolveEnabledSurfaces(saved)).toEqual(['contract', 'portal', 'lead', 'proposal'])
  })

  it('respects an explicit lead: false', () => {
    const saved = { invoice: true, lead: false }
    // proposal is unset here, so it still defaults on even though lead is off.
    expect(resolveEnabledSurfaces(saved)).toEqual(['invoice', 'proposal'])
  })

  it('reads the legacy array shape (DB column default) and adds lead', () => {
    const saved = ['invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire']
    expect(resolveEnabledSurfaces(saved)).toEqual(ALL_SURFACE_TABS)
  })

  it('ignores unknown surface names in either shape', () => {
    expect(resolveEnabledSurfaces(['invoice', 'unknownSurface'])).toEqual(['invoice', 'lead', 'proposal'])
    expect(resolveEnabledSurfaces({ invoice: true, unknownSurface: true })).toEqual([
      'invoice',
      'lead',
      'proposal',
    ])
  })

  it('returns surfaces in canonical order regardless of input order', () => {
    expect(resolveEnabledSurfaces(['questionnaire', 'invoice', 'lead'])).toEqual([
      'invoice',
      'questionnaire',
      'lead',
      'proposal',
    ])
  })
})

describe('buildEnabledSurfacesMap', () => {
  it('writes an explicit boolean for every surface so disables persist', () => {
    expect(buildEnabledSurfacesMap(['invoice', 'portal'])).toEqual({
      invoice: true,
      contract: false,
      portal: true,
      vendorTimeline: false,
      questionnaire: false,
      lead: false,
      proposal: false,
    })
  })

  it('round-trips through resolveEnabledSurfaces without resurrecting lead', () => {
    const map = buildEnabledSurfacesMap(['invoice'])
    expect(resolveEnabledSurfaces(map)).toEqual(['invoice'])
  })
})
