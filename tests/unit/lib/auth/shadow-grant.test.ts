// @vitest-environment node
/**
 * The signed shadow grant is the only thing exitShadow and the middleware
 * paywall skip trust, so it must reject anything it did not mint.
 */
import { describe, expect, it } from 'vitest'

import { signShadowGrant, verifyShadowGrant } from '@/lib/auth/shadow-grant'

const SECRET = 'unit-test-service-role-key'
const NOW = 1_800_000_000_000
const claims = {
  adminId: '11111111-1111-4111-8111-111111111111',
  targetUserId: '22222222-2222-4222-8222-222222222222',
  expiresAt: NOW + 60_000,
}

describe('shadow grant', () => {
  it('round-trips the claims it signed', async () => {
    const value = await signShadowGrant(claims, SECRET)
    expect(await verifyShadowGrant(value, SECRET, NOW)).toEqual(claims)
  })

  it('rejects a grant whose target id was swapped', async () => {
    const value = await signShadowGrant(claims, SECRET)
    const tampered = value.replace(claims.targetUserId, '33333333-3333-4333-8333-333333333333')
    expect(tampered).not.toBe(value)
    expect(await verifyShadowGrant(tampered, SECRET, NOW)).toBeNull()
  })

  it('rejects a grant whose expiry was extended', async () => {
    const value = await signShadowGrant(claims, SECRET)
    const tampered = value.replace(`.${claims.expiresAt}.`, `.${claims.expiresAt + 1_000_000}.`)
    expect(tampered).not.toBe(value)
    expect(await verifyShadowGrant(tampered, SECRET, NOW)).toBeNull()
  })

  it('rejects a flipped signature byte', async () => {
    const value = await signShadowGrant(claims, SECRET)
    const last = value.slice(-1)
    const tampered = value.slice(0, -1) + (last === '0' ? '1' : '0')
    expect(await verifyShadowGrant(tampered, SECRET, NOW)).toBeNull()
  })

  it('rejects an expired grant', async () => {
    const value = await signShadowGrant(claims, SECRET)
    expect(await verifyShadowGrant(value, SECRET, claims.expiresAt)).toBeNull()
    expect(await verifyShadowGrant(value, SECRET, claims.expiresAt + 1)).toBeNull()
  })

  it('rejects a grant signed with a different key', async () => {
    const value = await signShadowGrant(claims, 'another-key')
    expect(await verifyShadowGrant(value, SECRET, NOW)).toBeNull()
  })

  it('fails closed with no key, no value, or a bare id', async () => {
    const value = await signShadowGrant(claims, SECRET)
    expect(await verifyShadowGrant(value, null, NOW)).toBeNull()
    expect(await verifyShadowGrant(undefined, SECRET, NOW)).toBeNull()
    expect(await verifyShadowGrant(claims.adminId, SECRET, NOW)).toBeNull()
  })
})
