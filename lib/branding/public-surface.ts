'use client'

import { useEffect } from 'react'
import {
  FONT_STACKS,
  googleFontsHref,
  type HeadingFont,
  type BodyFont,
  type FontWeight,
} from './fonts'
import type { Density } from './themes'

export type { Density }

// Canonical definition moved to the pure module so server code (email
// shell, send route) can use it; re-exported here so the many existing
// public-page imports keep working.
export type { PublicBranding } from './public-branding'
import type { PublicBranding } from './public-branding'

// Re-exported under the original DENSITY_PAD name so the four public pages
// don't all need to update their imports. Canonical map lives in ./density.ts.
export { DENSITY_PADDING as DENSITY_PAD } from './density'

export function headingFontFamily(b: Pick<PublicBranding, 'font_heading'>) {
  return FONT_STACKS[b.font_heading]
}

export function bodyFontFamily(b: Pick<PublicBranding, 'font_body'>) {
  return FONT_STACKS[b.font_body]
}

const BRANDING_FAVICON_ID = 'zebri-public-branding-favicon'
const BRANDING_FONTS_ID = 'zebri-public-branding-fonts'

/**
 * Apply favicon + Google Font CDN link to <head> based on the user's branding.
 * Cleans up on unmount and when values change, so navigating between two MCs'
 * public links in the same tab doesn't leak the previous MC's assets.
 */
export function useBrandingHead(branding: PublicBranding | null | undefined) {
  const favicon = branding?.favicon_url ?? null
  const heading = branding?.font_heading
  const body = branding?.font_body
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Favicon: store the host's original href so we can put it back on unmount,
    // since the document may have an existing <link rel="icon"> from Next.js
    // metadata that we'd otherwise clobber permanently.
    let originalHref: string | null = null
    let existingFaviconLink = document.querySelector(`link#${BRANDING_FAVICON_ID}`) as HTMLLinkElement | null
    const hostFavicon = document.querySelector("link[rel='icon']:not([id='" + BRANDING_FAVICON_ID + "'])") as HTMLLinkElement | null
    if (favicon) {
      if (hostFavicon) {
        originalHref = hostFavicon.getAttribute('href')
        hostFavicon.setAttribute('href', favicon)
      } else {
        if (!existingFaviconLink) {
          existingFaviconLink = document.createElement('link')
          existingFaviconLink.id = BRANDING_FAVICON_ID
          existingFaviconLink.rel = 'icon'
          document.head.appendChild(existingFaviconLink)
        }
        existingFaviconLink.href = favicon
      }
    }

    // Fonts: replace any existing branded-fonts link with the new one.
    if (heading && body) {
      const href = googleFontsHref([heading, body])
      const existing = document.getElementById(BRANDING_FONTS_ID) as HTMLLinkElement | null
      if (existing && existing.href !== href) existing.remove()
      if (!document.getElementById(BRANDING_FONTS_ID)) {
        const link = document.createElement('link')
        link.id = BRANDING_FONTS_ID
        link.rel = 'stylesheet'
        link.href = href
        document.head.appendChild(link)
      }
    }

    return () => {
      // Restore the host favicon if we overwrote it; remove ours if we appended one.
      if (hostFavicon && originalHref !== null) hostFavicon.setAttribute('href', originalHref)
      document.getElementById(BRANDING_FAVICON_ID)?.remove()
      document.getElementById(BRANDING_FONTS_ID)?.remove()
    }
  }, [favicon, heading, body])
}
