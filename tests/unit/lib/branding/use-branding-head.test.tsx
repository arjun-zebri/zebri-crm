/**
 * `useBrandingHead` owns the Google Fonts `<link>` on every public surface.
 * It must load Branding's heading + body pair, plus any extra faces the
 * caller names (the proposal page passes the fonts its layout uses), and
 * remove the link on unmount so one MC's fonts never leak into the next.
 *
 * @module tests/unit/lib/branding/use-branding-head
 */
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GOOGLE_FONT_FAMILIES, type FontId } from '@/lib/branding/fonts'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { useBrandingHead } from '@/lib/branding/public-surface'

const branding = buildPublicBranding({ business_name: 'Sam MC', font_heading: 'playfair', font_body: 'inter' })

const fontsLink = () => document.getElementById('zebri-public-branding-fonts') as HTMLLinkElement | null

afterEach(() => { document.head.innerHTML = '' })

describe('useBrandingHead fonts', () => {
  it('loads the heading and body fonts', () => {
    renderHook(() => useBrandingHead(branding, { favicon: false }))
    const href = decodeURIComponent(fontsLink()?.href ?? '')
    expect(href).toContain(`family=${GOOGLE_FONT_FAMILIES.playfair}`)
    expect(href).toContain(`family=${GOOGLE_FONT_FAMILIES.inter}`)
  })

  it('also loads any extra fonts the caller names, once each', () => {
    renderHook(() => useBrandingHead(branding, { favicon: false, fonts: ['great_vibes', 'playfair', 'great_vibes'] }))
    const href = decodeURIComponent(fontsLink()?.href ?? '')
    expect(href).toContain(`family=${GOOGLE_FONT_FAMILIES.great_vibes}`)
    expect(href.split(`family=${GOOGLE_FONT_FAMILIES.great_vibes}`).length).toBe(2)
    expect(href.split(`family=${GOOGLE_FONT_FAMILIES.playfair}`).length).toBe(2)
  })

  it('swaps the link when the extra fonts change and removes it on unmount', () => {
    const { rerender, unmount } = renderHook(({ fonts }: { fonts: FontId[] }) => useBrandingHead(branding, { favicon: false, fonts }), {
      initialProps: { fonts: ['allura'] },
    })
    expect(decodeURIComponent(fontsLink()?.href ?? '')).toContain('Allura')
    rerender({ fonts: ['satisfy'] })
    const href = decodeURIComponent(fontsLink()?.href ?? '')
    expect(href).toContain('Satisfy')
    expect(href).not.toContain('Allura')
    unmount()
    expect(fontsLink()).toBeNull()
  })
})
