import { createHmac } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

/**
 * Pure-function coverage for the signed unsubscribe token: round-trip,
 * tamper resistance, and malformed input. The DB-facing behaviour (does a
 * valid token actually suppress the address, is a tampered one rejected end
 * to end) lives in `tests/integration/email/unsubscribe.test.ts`; this file
 * only proves the crypto and parsing are correct in isolation.
 */
describe('unsubscribe-token', () => {
  // RFC 4122-shaped (version nibble 4, variant nibble in 8-b): z.uuid()
  // enforces both, and real rows minted by Postgres's gen_random_uuid()
  // always are, so the fixtures have to be too.
  const userId = '11111111-1111-4111-8111-111111111111'
  const coupleId = '22222222-2222-4222-8222-222222222222'

  beforeEach(() => {
    vi.stubEnv('UNSUBSCRIBE_TOKEN_SECRET', 'unit-test-secret-do-not-use-in-prod')
  })

  it('round-trips a valid token, lower-casing the address', () => {
    const token = createUnsubscribeToken({ userId, coupleId, email: 'Couple@Example.com' })
    const payload = verifyUnsubscribeToken(token)
    expect(payload).toEqual({ v: 1, uid: userId, cid: coupleId, email: 'couple@example.com' })
  })

  it('rejects a token with a flipped signature byte', () => {
    const token = createUnsubscribeToken({ userId, coupleId, email: 'couple@example.com' })
    const parts = token.split('.')
    const payloadB64 = parts[0] ?? ''
    const sig = parts[1] ?? ''
    const flipped = sig.at(-1) === 'A' ? 'B' : 'A'
    const tampered = `${payloadB64}.${sig.slice(0, -1)}${flipped}`
    expect(verifyUnsubscribeToken(tampered)).toBeNull()
  })

  it('rejects every last-char variant, including ones that decode to the same bytes', () => {
    // The 43rd char of a 32-byte base64url signature carries 2 padding bits
    // the decoder ignores, so 3 of the 63 variants below decode to the real
    // signature's bytes. Covering all of them keeps this deterministic
    // instead of depending on which char the HMAC happened to end in.
    const token = createUnsubscribeToken({ userId, coupleId, email: 'couple@example.com' })
    const [payloadB64, sig = ''] = token.split('.')
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    for (const ch of alphabet) {
      if (ch === sig.at(-1)) continue
      expect(verifyUnsubscribeToken(`${payloadB64}.${sig.slice(0, -1)}${ch}`)).toBeNull()
    }
  })

  it('rejects a token whose payload was edited (signature no longer matches)', () => {
    const token = createUnsubscribeToken({ userId, coupleId, email: 'couple@example.com' })
    const parts = token.split('.')
    const sig = parts[1] ?? ''
    const forgedPayload = Buffer.from(
      JSON.stringify({ v: 1, uid: userId, cid: coupleId, email: 'someoneelse@example.com' }),
      'utf8',
    ).toString('base64url')
    expect(verifyUnsubscribeToken(`${forgedPayload}.${sig}`)).toBeNull()
    // Sanity: the original is still valid, proving the rejection above is
    // about the edit and not an unrelated bug.
    expect(verifyUnsubscribeToken(token)).not.toBeNull()
  })

  it('rejects a token signed under a different secret (key rotation invalidates old links)', () => {
    const token = createUnsubscribeToken({ userId, coupleId, email: 'couple@example.com' })
    vi.stubEnv('UNSUBSCRIBE_TOKEN_SECRET', 'a-different-secret-entirely')
    expect(verifyUnsubscribeToken(token)).toBeNull()
  })

  it.each([
    ['empty string', ''],
    ['no dot separator', 'notadottedtoken'],
    ['too many parts', 'a.b.c'],
    ['non-base64url payload', '***.sig'],
    ['empty signature', 'cGF5bG9hZA.'],
  ])('rejects malformed input: %s', (_label, input) => {
    expect(verifyUnsubscribeToken(input)).toBeNull()
  })

  it('rejects a well-signed payload that fails schema validation (wrong version)', () => {
    // Can't go through createUnsubscribeToken (it always stamps the current
    // version), so this signs a v:2 payload by hand the same way the module
    // does, to prove verify rejects on shape, not just on signature.
    const payload = { v: 2, uid: userId, cid: coupleId, email: 'couple@example.com' }
    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
    const sig = createHmac('sha256', 'unit-test-secret-do-not-use-in-prod')
      .update(payloadB64)
      .digest('base64url')
    expect(verifyUnsubscribeToken(`${payloadB64}.${sig}`)).toBeNull()
  })
})
