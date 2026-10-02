/**
 * Branded inline styles for the portal songs section.
 *
 * The portal renders in each MC's own fonts and colours, which are only
 * known at runtime, so these surfaces use computed `style` objects rather
 * than Tailwind tokens (the same reason every other portal section does).
 *
 * @module app/portal/[token]/song-styles
 */
import type { CSSProperties } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'

/** Text style for a type role, with optional overrides (colour, weight). */
export function roleText(
  branding: PublicBranding,
  role: 'body' | 'finePrint',
  overrides: CSSProperties = {},
): CSSProperties {
  const d = roleDefaults(branding, role)
  return {
    fontSize: `${d.fontSize}px`,
    color: d.color,
    fontFamily: FONT_STACKS[d.fontFamily as never],
    fontWeight: d.fontWeight,
    lineHeight: d.lineHeight,
    ...overrides,
  }
}

/** Branded text field: border, radius and body type. */
export function fieldStyle(branding: PublicBranding): CSSProperties {
  return {
    width: '100%',
    border: `1px solid ${branding.border_color}`,
    borderRadius: `${branding.corner_radius}px`,
    padding: '0.5rem 0.75rem',
    outline: 'none',
    ...roleText(branding, 'body'),
  }
}

/** Branded secondary (outlined) button. */
export function secondaryButtonStyle(branding: PublicBranding): CSSProperties {
  return {
    ...roleText(branding, 'body', { color: roleDefaults(branding, 'finePrint').color }),
    border: `1px solid ${branding.border_color}`,
    borderRadius: `${branding.corner_radius}px`,
  }
}

/** Branded primary (filled) button. */
export function primaryButtonStyle(branding: PublicBranding): CSSProperties {
  return {
    ...roleText(branding, 'body', { color: 'white' }),
    backgroundColor: branding.brand_color,
    borderRadius: `${branding.corner_radius}px`,
  }
}
