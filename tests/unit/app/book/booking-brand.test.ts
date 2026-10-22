/**
 * The MC's colour becomes the booking card's accent: a fill that reads on a
 * white card, with the text colour that reads on that fill.
 *
 * @module tests/unit/app/book/booking-brand
 */
import { describe, expect, it } from 'vitest'

import { bookingAccentVars, bookingCardStyle } from '@/app/book/[token]/booking-brand'

describe('bookingAccentVars', () => {
  it('uses a dark brand colour as the fill with white text', () => {
    expect(bookingAccentVars('#1d4ed8')).toEqual({ '--brand-fg': '#1d4ed8', '--brand-bg': '#ffffff' })
  })

  it('pairs a mid-dark brand colour with white text when it is dark enough', () => {
    expect(bookingAccentVars('#c2410c')).toEqual({ '--brand-fg': '#c2410c', '--brand-bg': '#ffffff' })
  })

  it('falls back to ink when the brand colour is too pale to fill a button on white', () => {
    expect(bookingAccentVars('#fef9c3')).toEqual({ '--brand-fg': '#111827', '--brand-bg': '#ffffff' })
  })

  it('flips the text to ink on a light brand colour that still clears 3:1 against white', () => {
    // A light sage: it fills legibly, so the text has to go dark to read on it.
    expect(bookingAccentVars('#6b7d2a')).toEqual({ '--brand-fg': '#6b7d2a', '--brand-bg': '#111827' })
  })

  it('treats a missing or malformed colour as ink', () => {
    expect(bookingAccentVars(undefined)['--brand-fg']).toBe('#111827')
    expect(bookingAccentVars('blue')['--brand-fg']).toBe('#111827')
  })
})

describe('bookingCardStyle', () => {
  it('carries the accent tokens and the heading font on the card', () => {
    const style = bookingCardStyle('#1d4ed8', '"Poppins", sans-serif') as Record<string, string>

    expect(style['--brand-fg']).toBe('#1d4ed8')
    expect(style['--booking-heading-font']).toBe('"Poppins", sans-serif')
  })
})
