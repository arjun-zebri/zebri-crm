'use client'

import { useBrandingHead, type PublicBranding } from '@/lib/branding/public-surface'

// Server components can't run useEffect, so this thin client wrapper exists
// to inject favicon + Google Fonts <link> tags for the portal page.
export function BrandingHead({ branding }: { branding: PublicBranding | null }) {
  useBrandingHead(branding)
  return null
}
