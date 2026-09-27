// @vitest-environment node
/**
 * `exitShadow` must only mint an admin session for a caller who is
 * genuinely inside a shadow session that admin started.
 *
 * Before the fix it trusted the bare, attacker-settable
 * `zebri_shadow_admin_id` cookie: anyone who set it to a known user id
 * and posted the action was signed in as that user.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SHADOW_GRANT_TTL_MS, signShadowGrant, verifyShadowMarker } from '@/lib/auth/shadow-grant'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_ID = '33333333-3333-4333-8333-333333333333'

const jar = new Map<string, string>()
const cookieOptions = new Map<string, Record<string, unknown>>()
const cookieStore = {
  get: (name: string) => {
    const value = jar.get(name)
    return value === undefined ? undefined : { name, value }
  },
  set: (name: string, value: string, options: Record<string, unknown> = {}) => {
    jar.set(name, value)
    cookieOptions.set(name, options)
  },
  delete: (name: string) => void jar.delete(name),
}
let clientIp = '203.0.113.1'
let ipCounter = 0

const sessionGetUser = vi.fn()
const verifyOtp = vi.fn()
const signOut = vi.fn()
const getUserById = vi.fn()
const generateLink = vi.fn()
const adminSignOut = vi.fn()
const sendAlert = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers({ 'x-forwarded-for': clientIp }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/payments/stripe', () => ({ stripe: {} }))
vi.mock('@/lib/admin/audit', () => ({ recordAdminAction: vi.fn() }))
vi.mock('@/lib/alerts', () => ({ sendAlert: (...args: unknown[]) => sendAlert(...args) }))
// Branch delta (Task 23, I3): enterShadow now also reads the session's
// assurance level. An aal2 token here; the admin record below gains a
// verified factor in the one enterShadow test that expects success.
// Task 25: the token also carries the Supabase session_id claim that
// exitShadow reads to close the shadow-session record.
const SHADOW_SESSION_ID = '44444444-4444-4444-8444-444444444444'
const MINTED_SESSION_ID = '55555555-5555-4555-8555-555555555555'
const jwt = (payload: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`
const aal2Token = jwt({ aal: 'aal2', session_id: SHADOW_SESSION_ID })
const startShadowSession = vi.fn()
const endShadowSession = vi.fn()
vi.mock('@/lib/admin/shadow-sessions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/shadow-sessions')>()),
  startShadowSession: (...args: unknown[]) => startShadowSession(...args),
  endShadowSession: (...args: unknown[]) => endShadowSession(...args),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: sessionGetUser,
      getSession: async () => ({ data: { session: { access_token: aal2Token } } }),
      verifyOtp,
      signOut,
    },
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { getUserById, generateLink, signOut: adminSignOut } } }),
}))

function adminRecord(accountType: string) {
  return {
    id: ADMIN_ID,
    email: 'admin@example.test',
    app_metadata: { account_type: accountType },
    user_metadata: {},
  }
}

const SECRET = 'unit-test-service-role-key'

/** Put the cookies enterShadow would have set for ADMIN_ID shadowing `target`. */
async function enterAs(
  target: string,
  adminId: string = ADMIN_ID,
  expiresAt: number = Date.now() + SHADOW_GRANT_TTL_MS,
) {
  jar.set('zebri_shadow_admin_id', adminId)
  jar.set('zebri_is_shadowing', '1')
  jar.set(
    'zebri_shadow_grant',
    await signShadowGrant({ adminId, targetUserId: target, expiresAt }, SECRET),
  )
}

async function runExit(): Promise<string> {
  const { exitShadow } = await import('@/app/admin/actions')
  try {
    await exitShadow()
  } catch (err) {
    return (err as Error).message
  }
  return 'NO_REDIRECT'
}

beforeEach(() => {
  jar.clear()
  cookieOptions.clear()
  vi.clearAllMocks()
  // A fresh module per test gives fresh process-local limiters, and a
  // fresh IP keeps one test's refusals out of another's bucket.
  vi.resetModules()
  ipCounter += 1
  clientIp = `203.0.113.${ipCounter}`
  signOut.mockResolvedValue({ error: null })
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET
  sessionGetUser.mockResolvedValue({ data: { user: { id: TARGET_ID } } })
  getUserById.mockResolvedValue({ data: { user: adminRecord('admin') }, error: null })
  generateLink.mockResolvedValue({
    data: { properties: { email_otp: '123456' } },
    error: null,
  })
  verifyOtp.mockResolvedValue({
    data: { session: { access_token: jwt({ session_id: MINTED_SESSION_ID }) } },
    error: null,
  })
  startShadowSession.mockResolvedValue(null)
  endShadowSession.mockResolvedValue(null)
  adminSignOut.mockResolvedValue({ data: null, error: null })
})

describe('exitShadow', () => {
  it('refuses a forged zebri_shadow_admin_id cookie with no grant', async () => {
    jar.set('zebri_shadow_admin_id', ADMIN_ID)

    const result = await runExit()

    expect(result).toBe('REDIRECT:/login')
    expect(generateLink).not.toHaveBeenCalled()
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('alerts with ids and a reason on refusal, never emails', async () => {
    jar.set('zebri_shadow_admin_id', ADMIN_ID)

    await runExit()

    expect(sendAlert).toHaveBeenCalledWith({
      type: 'admin_shadow_exit_refused',
      severity: 'warn',
      reason: 'invalid_grant',
      sessionUserId: TARGET_ID,
      claimedAdminId: ADMIN_ID,
    })
    expect(JSON.stringify(sendAlert.mock.calls)).not.toContain('@')
    expect(jar.has('zebri_shadow_admin_id')).toBe(false)
  })

  it('refuses when the grant targets a different user than the session', async () => {
    await enterAs(OTHER_ID)

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'target_mismatch' }))
  })

  it('refuses when the admin cookie is swapped for another id', async () => {
    await enterAs(TARGET_ID)
    jar.set('zebri_shadow_admin_id', OTHER_ID)

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(generateLink).not.toHaveBeenCalled()
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'admin_cookie_mismatch' }),
    )
  })

  it('refuses when the named admin is no longer an admin', async () => {
    await enterAs(TARGET_ID)
    getUserById.mockResolvedValue({ data: { user: adminRecord('vendor') }, error: null })

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(generateLink).not.toHaveBeenCalled()
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'not_admin' }))
  })

  it('refuses a grant signed with another key', async () => {
    await enterAs(TARGET_ID)
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'a-different-key'

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('refuses when no one is signed in', async () => {
    await enterAs(TARGET_ID)
    sessionGetUser.mockResolvedValue({ data: { user: null } })

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('restores the admin session on the genuine path and clears every shadow cookie', async () => {
    await enterAs(TARGET_ID)

    expect(await runExit()).toBe('REDIRECT:/admin')
    expect(getUserById).toHaveBeenCalledWith(ADMIN_ID)
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'admin@example.test',
      token: '123456',
      type: 'magiclink',
    })
    expect(sendAlert).not.toHaveBeenCalled()
    expect([...jar.keys()]).toEqual([])
    // Task 25: the shadow-session record is closed by the session's own id.
    expect(endShadowSession).toHaveBeenCalledWith(expect.anything(), {
      sessionId: SHADOW_SESSION_ID,
      adminId: ADMIN_ID,
      targetUserId: TARGET_ID,
    })
  })

  it('never touches the shadow-session record on a refusal', async () => {
    await enterAs(OTHER_ID)

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(endShadowSession).not.toHaveBeenCalled()
  })

  it('still exits, and alerts, when the record cannot be closed', async () => {
    await enterAs(TARGET_ID)
    endShadowSession.mockResolvedValue('db down')

    expect(await runExit()).toBe('REDIRECT:/admin')
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'admin.exitShadow' }),
    )
  })

  it('signs out this browser only (never globally) when a session is refused', async () => {
    jar.set('zebri_shadow_admin_id', ADMIN_ID)

    await runExit()

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(signOut).not.toHaveBeenCalledWith({ scope: 'global' })
    expect(signOut).not.toHaveBeenCalledWith()
  })

  it('does not call signOut when there is no session to end', async () => {
    sessionGetUser.mockResolvedValue({ data: { user: null } })

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('refuses an expired grant', async () => {
    await enterAs(TARGET_ID, ADMIN_ID, Date.now() - 1)

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(generateLink).not.toHaveBeenCalled()
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'invalid_grant' }))
  })

  it('refuses when the admin lookup fails', async () => {
    await enterAs(TARGET_ID)
    getUserById.mockResolvedValue({ data: { user: null }, error: new Error('boom') })

    expect(await runExit()).toBe('REDIRECT:/login')
    expect(generateLink).not.toHaveBeenCalled()
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'admin_lookup_failed' }),
    )
  })

  it('stops alerting after the per-IP refusal limit but keeps refusing', async () => {
    const { SHADOW_RATE_LIMITS } = await import('@/lib/api/rate-limit')
    const max = SHADOW_RATE_LIMITS.exitRefusalIp.max
    sessionGetUser.mockResolvedValue({ data: { user: null } })

    for (let i = 0; i < max + 3; i += 1) {
      expect(await runExit()).toBe('REDIRECT:/login')
    }

    expect(sendAlert).toHaveBeenCalledTimes(max)
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('caps refusal alerts globally when the flood spreads over many IPs', async () => {
    const { SHADOW_RATE_LIMITS } = await import('@/lib/api/rate-limit')
    const cap = SHADOW_RATE_LIMITS.exitRefusalAlerts.max
    sessionGetUser.mockResolvedValue({ data: { user: null } })

    for (let i = 0; i < cap + 5; i += 1) {
      clientIp = `198.51.100.${i + 1}`
      expect(await runExit()).toBe('REDIRECT:/login')
    }

    expect(sendAlert).toHaveBeenCalledTimes(cap)
  })
})

// Phase 4 fix wave (review I1, I2): a genuine exit revokes the target
// session this browser holds, scope local, before the admin session is
// minted; the refusal path is the hotfix's and never touches it.
describe('exitShadow revokes the target session', () => {
  it('revokes the shadow session by its own token, locally, before minting the admin session', async () => {
    await enterAs(TARGET_ID)
    jar.set('zebri_shadow_session', SHADOW_SESSION_ID)

    expect(await runExit()).toBe('REDIRECT:/admin')
    expect(adminSignOut).toHaveBeenCalledTimes(1)
    expect(adminSignOut).toHaveBeenCalledWith(aal2Token, 'local')
    expect(adminSignOut.mock.invocationCallOrder[0]!).toBeLessThan(verifyOtp.mock.invocationCallOrder[0]!)
    // The marker goes with the other shadow cookies.
    expect([...jar.keys()]).toEqual([])
  })

  it('still exits, and alerts with ids only, when the revoke fails', async () => {
    await enterAs(TARGET_ID)
    adminSignOut.mockResolvedValue({ data: null, error: { message: 'auth down' } })

    expect(await runExit()).toBe('REDIRECT:/admin')
    expect(verifyOtp).toHaveBeenCalled()
    expect(sendAlert).toHaveBeenCalledWith({
      type: 'app_error',
      severity: 'error',
      source: 'admin.exitShadow',
      message: `shadow target session ${SHADOW_SESSION_ID} of user ${TARGET_ID} not revoked: auth down`,
    })
    expect(JSON.stringify(sendAlert.mock.calls)).not.toContain('@')
  })

  it('still exits when the revoke throws', async () => {
    await enterAs(TARGET_ID)
    adminSignOut.mockRejectedValue(new Error('network'))

    expect(await runExit()).toBe('REDIRECT:/admin')
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'admin.exitShadow', message: expect.stringMatching(/not revoked: network/) }),
    )
  })

  it('never revokes through the service role on a refusal', async () => {
    await enterAs(OTHER_ID)
    expect(await runExit()).toBe('REDIRECT:/login')
    jar.clear()
    jar.set('zebri_shadow_admin_id', ADMIN_ID)
    expect(await runExit()).toBe('REDIRECT:/login')
    expect(adminSignOut).not.toHaveBeenCalled()
  })
})

describe('enterShadow', () => {
  const targetRecord = {
    id: TARGET_ID,
    email: 'customer@example.test',
    app_metadata: { account_type: 'vendor' },
    user_metadata: {},
  }

  async function runEnter(target: string): Promise<string> {
    const { enterShadow } = await import('@/app/admin/actions')
    try {
      await enterShadow(target)
    } catch (err) {
      return (err as Error).message
    }
    return 'NO_REDIRECT'
  }

  it('refuses a non-admin (user_metadata admin only) and mints nothing', async () => {
    sessionGetUser.mockResolvedValue({
      data: {
        user: {
          id: OTHER_ID,
          app_metadata: { account_type: 'vendor' },
          user_metadata: { account_type: 'admin' },
        },
      },
    })

    expect(await runEnter(TARGET_ID)).toBe('Unauthorized')
    expect(getUserById).not.toHaveBeenCalled()
    expect(generateLink).not.toHaveBeenCalled()
    expect(verifyOtp).not.toHaveBeenCalled()
    expect([...jar.keys()]).toEqual([])
  })

  it('sets a grant that exitShadow then accepts (real sign and verify)', async () => {
    // Enter as the admin. Branch delta (Task 23, I3): the admin has 2FA.
    sessionGetUser.mockResolvedValue({
      data: { user: { ...adminRecord('admin'), factors: [{ status: 'verified', factor_type: 'totp' }] } },
    })
    getUserById.mockResolvedValue({ data: { user: targetRecord }, error: null })

    expect(await runEnter(TARGET_ID)).toBe('REDIRECT:/')
    expect(cookieOptions.get('zebri_shadow_grant')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SHADOW_GRANT_TTL_MS / 1000,
    })
    expect(cookieOptions.get('zebri_shadow_admin_id')?.maxAge).toBe(SHADOW_GRANT_TTL_MS / 1000)
    expect(cookieOptions.get('zebri_is_shadowing')?.maxAge).toBe(SHADOW_GRANT_TTL_MS / 1000)
    // Fix wave (I1): the marker names the minted session and outlives
    // the grant, so middleware can end the session once the grant dies.
    // Signed (N1): it verifies, and names the minted session and target.
    expect(await verifyShadowMarker(jar.get('zebri_shadow_session'), SECRET)).toEqual({
      sessionId: MINTED_SESSION_ID,
      targetUserId: TARGET_ID,
    })
    expect(cookieOptions.get('zebri_shadow_session')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 168 * 60 * 60,
    })
    expect(cookieOptions.get('zebri_shadow_session')!.maxAge as number).toBeGreaterThan(SHADOW_GRANT_TTL_MS / 1000)
    // Task 25: the minted session is recorded by its own session_id.
    expect(startShadowSession).toHaveBeenCalledWith(expect.anything(), {
      sessionId: MINTED_SESSION_ID,
      adminId: ADMIN_ID,
      targetUserId: TARGET_ID,
    })

    // The browser is now the customer; exit with exactly the cookies set.
    vi.clearAllMocks()
    sessionGetUser.mockResolvedValue({ data: { user: { id: TARGET_ID } } })
    getUserById.mockResolvedValue({ data: { user: adminRecord('admin') }, error: null })
    generateLink.mockResolvedValue({ data: { properties: { email_otp: '654321' } }, error: null })
    verifyOtp.mockResolvedValue({ data: { session: null }, error: null })

    expect(await runExit()).toBe('REDIRECT:/admin')
    expect(getUserById).toHaveBeenCalledWith(ADMIN_ID)
    expect(verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@example.test', token: '654321' }),
    )
    expect(sendAlert).not.toHaveBeenCalled()
    expect([...jar.keys()]).toEqual([])
  })

  it('refuses entry, signs the minted session out and clears cookies when it cannot be recorded', async () => {
    sessionGetUser.mockResolvedValue({
      data: { user: { ...adminRecord('admin'), factors: [{ status: 'verified', factor_type: 'totp' }] } },
    })
    getUserById.mockResolvedValue({ data: { user: targetRecord }, error: null })
    startShadowSession.mockResolvedValue('insert failed')

    expect(await runEnter(TARGET_ID)).toMatch(/Could not start shadow mode/)
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect([...jar.keys()]).toEqual([])
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_error', source: 'admin.enterShadow' }),
    )
  })

  it('refuses entry when the minted token carries no session_id', async () => {
    sessionGetUser.mockResolvedValue({
      data: { user: { ...adminRecord('admin'), factors: [{ status: 'verified', factor_type: 'totp' }] } },
    })
    getUserById.mockResolvedValue({ data: { user: targetRecord }, error: null })
    verifyOtp.mockResolvedValue({ data: { session: { access_token: jwt({}) } }, error: null })

    expect(await runEnter(TARGET_ID)).toMatch(/Could not start shadow mode/)
    expect(startShadowSession).not.toHaveBeenCalled()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
