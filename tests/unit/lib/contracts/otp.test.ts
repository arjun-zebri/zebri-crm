/**
 * One-time codes for signer verification (`lib/contracts/otp`).
 *
 * These functions decide whether a person can sign a legal document, so the
 * cases below cover the security properties (CSPRNG, constant-time comparison,
 * no plaintext leakage) rather than just happy-path formatting.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  generateOtp,
  generateSalt,
  hashOtp,
  maskEmail,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  verifyOtp,
} from '@/lib/contracts/otp'

describe('generateOtp', () => {
  it('always produces exactly six digits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/)
    }
  })

  it('zero-pads small values rather than shortening the code', () => {
    // A code of "42" would both look broken and shrink the keyspace.
    const codes = Array.from({ length: 500 }, generateOtp)
    expect(codes.every((c) => c.length === OTP_LENGTH)).toBe(true)
  })

  it('does not use Math.random', async () => {
    // Math.random is predictable from prior output, which would let an
    // attacker who can trigger issuance predict the next code.
    const spy = vi.spyOn(Math, 'random')
    generateOtp()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('produces varied output', () => {
    const seen = new Set(Array.from({ length: 200 }, generateOtp))
    expect(seen.size).toBeGreaterThan(150)
  })
})

describe('generateSalt', () => {
  it('varies per call, so two signers with the same code differ', () => {
    const seen = new Set(Array.from({ length: 100 }, generateSalt))
    expect(seen.size).toBeGreaterThan(90)
  })
})

describe('hashOtp', () => {
  it('is stable for the same code and salt', () => {
    expect(hashOtp('123456', 'abc')).toBe(hashOtp('123456', 'abc'))
  })

  it('changes with the salt', () => {
    expect(hashOtp('123456', 'abc')).not.toBe(hashOtp('123456', 'def'))
  })

  it('never contains the plaintext code', () => {
    expect(hashOtp('123456', 'abc')).not.toContain('123456')
  })

  it('is a 64-character hex digest', () => {
    expect(hashOtp('123456', 'abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('verifyOtp', () => {
  it('accepts the right code', () => {
    const salt = 'saltysalt'
    expect(verifyOtp('123456', salt, hashOtp('123456', salt))).toBe(true)
  })

  it('rejects a wrong code', () => {
    const salt = 'saltysalt'
    expect(verifyOtp('654321', salt, hashOtp('123456', salt))).toBe(false)
  })

  it('rejects when the salt does not match', () => {
    expect(verifyOtp('123456', 'other', hashOtp('123456', 'saltysalt'))).toBe(false)
  })

  it('returns false rather than throwing on a malformed stored hash', () => {
    // timingSafeEqual throws on a length mismatch, which would surface as a
    // 500 instead of a clean "wrong code".
    expect(() => verifyOtp('123456', 'salt', 'not-a-hash')).not.toThrow()
    expect(verifyOtp('123456', 'salt', 'not-a-hash')).toBe(false)
    expect(verifyOtp('123456', 'salt', '')).toBe(false)
    expect(verifyOtp('123456', 'salt', 'ab'.repeat(10))).toBe(false)
  })
})

describe('maskEmail', () => {
  it('shows the first letter and the domain only', () => {
    // The page tells the signer WHERE the code went, but a token holder is not
    // necessarily the signer, so the address is never echoed in full.
    expect(maskEmail('sarah@gmail.com')).toBe('s••••@gmail.com')
  })

  it('masks a single-character local part', () => {
    expect(maskEmail('a@b.com')).toBe('a•@b.com')
  })

  it('degrades safely on something that is not an address', () => {
    expect(maskEmail('not-an-email')).toBe('•••')
    expect(maskEmail('@nolocal.com')).toBe('•••')
  })
})

describe('policy constants', () => {
  it('keeps a 10-minute TTL and a 5-attempt cap', () => {
    // The attempt cap is the control that makes a 6-digit code safe; the TTL
    // bounds how long a leaked code stays useful. Both are load-bearing, so a
    // change here should be deliberate.
    expect(OTP_TTL_SECONDS).toBe(600)
    expect(OTP_MAX_ATTEMPTS).toBe(5)
  })
})
