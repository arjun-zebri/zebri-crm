/**
 * Validating a drawn signature (`lib/contracts/signature-image`).
 *
 * This runs on a value an ANONYMOUS caller supplies to a `security definer`
 * RPC, so the cases below are a security boundary rather than input tidiness.
 */
import { describe, expect, it } from 'vitest'

import {
  isValidSignatureDataUrl,
  normaliseSignature,
  SIGNATURE_MAX_BYTES,
} from '@/lib/contracts/signature-image'

const png = (payload = 'iVBORw0KGgo=') => `data:image/png;base64,${payload}`

describe('isValidSignatureDataUrl', () => {
  it('accepts a base64 PNG data URL', () => {
    expect(isValidSignatureDataUrl(png())).toBe(true)
    expect(isValidSignatureDataUrl(png('AAAA'))).toBe(true)
  })

  it('rejects SVG', () => {
    // An SVG is a document that can carry script, and the signature renders
    // into a freshly-opened print window. No upside worth that surface.
    expect(isValidSignatureDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false)
  })

  it('rejects other image types', () => {
    expect(isValidSignatureDataUrl('data:image/jpeg;base64,AAAA')).toBe(false)
    expect(isValidSignatureDataUrl('data:image/gif;base64,AAAA')).toBe(false)
  })

  it('rejects a remote URL', () => {
    // Would reintroduce the print-timing race the data URL exists to avoid,
    // and would let a signer point their signature at anything.
    expect(isValidSignatureDataUrl('https://example.com/signature.png')).toBe(false)
  })

  it('rejects anything over the size cap', () => {
    const tooBig = png('A'.repeat(SIGNATURE_MAX_BYTES))
    expect(tooBig.length).toBeGreaterThan(SIGNATURE_MAX_BYTES)
    expect(isValidSignatureDataUrl(tooBig)).toBe(false)
  })

  it('accepts a payload right at the cap', () => {
    const prefix = 'data:image/png;base64,'
    const exact = prefix + 'A'.repeat(SIGNATURE_MAX_BYTES - prefix.length)
    expect(exact.length).toBe(SIGNATURE_MAX_BYTES)
    expect(isValidSignatureDataUrl(exact)).toBe(true)
  })

  it('rejects non-base64 characters in the payload', () => {
    expect(isValidSignatureDataUrl('data:image/png;base64,<script>')).toBe(false)
    expect(isValidSignatureDataUrl('data:image/png;base64,a b c')).toBe(false)
  })

  it('rejects non-strings and empty input', () => {
    expect(isValidSignatureDataUrl(null)).toBe(false)
    expect(isValidSignatureDataUrl(undefined)).toBe(false)
    expect(isValidSignatureDataUrl(42)).toBe(false)
    expect(isValidSignatureDataUrl('')).toBe(false)
    expect(isValidSignatureDataUrl('data:image/png;base64,')).toBe(false)
  })
})

describe('normaliseSignature', () => {
  it('drops any image in typed mode', () => {
    // A signer who draws, then switches back to Type, must not leave a stale
    // drawing attached to a typed signature.
    expect(normaliseSignature('typed', png())).toEqual({ mode: 'typed', image: null })
  })

  it('keeps a valid drawn image', () => {
    expect(normaliseSignature('drawn', png())).toEqual({ mode: 'drawn', image: png() })
  })

  it('refuses drawn mode with no image or an invalid one', () => {
    expect(normaliseSignature('drawn', null)).toBeNull()
    expect(normaliseSignature('drawn', 'https://example.com/x.png')).toBeNull()
  })
})
