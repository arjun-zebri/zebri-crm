/**
 * Brand plumbing for the public booking page.
 *
 * The MC's colour becomes the page's accent by overriding the two brand tokens
 * on the booking card. Button primary, input focus rings, the selected pill and
 * the calendar all read `--brand-fg` / `--brand-bg` already, so nothing else on
 * the page needs a branch for it.
 *
 * @module app/book/[token]/booking-brand
 */
import type { CSSProperties } from 'react'

import { getContrastRatio, getTextColor } from '@/lib/branding/contrast'

const WHITE = '#ffffff'
const INK = '#111827'
const HEX = /^#[0-9a-f]{6}$/i

/**
 * The accent colour used as a fill, plus the text colour that reads on it.
 *
 * A pale brand colour is useless as a button fill on a white card, so anything
 * under 3:1 against white falls back to ink. A fill that light would make the
 * primary button effectively invisible.
 *
 * @param brandColor - the MC's `brand_color`, a six-digit hex
 */
export function bookingAccentVars(brandColor: string | null | undefined): Record<'--brand-fg' | '--brand-bg', string> {
  const candidate = brandColor && HEX.test(brandColor) ? brandColor : INK;
  const accent = getContrastRatio(candidate, WHITE) >= 3 ? candidate : INK;
  return { '--brand-fg': accent, '--brand-bg': getTextColor(accent) };
}

/**
 * Style for the card wrapper: the accent tokens and the MC's heading font.
 * These are branding values that only exist at runtime, which is the one
 * place inline style is allowed in this app.
 *
 * @param brandColor - the MC's `brand_color`
 * @param headingFamily - the CSS font stack for headings
 */
export function bookingCardStyle(brandColor: string | null | undefined, headingFamily: string): CSSProperties {
  return {
    ...bookingAccentVars(brandColor),
    '--booking-heading-font': headingFamily,
  } as CSSProperties;
}

/** Applied to every heading on the page, so the MC's heading face shows through. */
export const HEADING_STYLE: CSSProperties = { fontFamily: 'var(--booking-heading-font)' };
