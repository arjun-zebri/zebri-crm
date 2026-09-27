// @vitest-environment node
/**
 * The past_due paywall used to be skipped whenever the bare, user-settable
 * `zebri_shadow_admin_id` cookie was present. Only a verified shadow grant
 * naming the session's user may skip it now.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SHADOW_GRANT_TTL_MS, signShadowGrant } from '@/lib/auth/shadow-grant'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const SECRET = 'unit-test-service-role-key'

const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

function pastDueUser(id: string) {
  return { id, app_metadata: { account_type: 'vendor', subscription_status: 'past_due' } }
}

async function run(cookies: Record<string, string>): Promise<string | null> {
  const { middleware } = await import('@/middleware')
  const request = new NextRequest('https://app.zebri.test/couples')
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value)
  const response = await middleware(request)
  return response.headers.get('location')
}

async function grantFor(target: string): Promise<string> {
  return signShadowGrant(
    { adminId: ADMIN_ID, targetUserId: target, expiresAt: Date.now() + SHADOW_GRANT_TTL_MS },
    SECRET,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET
  getUser.mockResolvedValue({ data: { user: pastDueUser(USER_ID) } })
})

describe('middleware past_due paywall', () => {
  it('is not skipped by a bare zebri_shadow_admin_id cookie', async () => {
    const location = await run({ zebri_shadow_admin_id: ADMIN_ID })
    expect(location).toContain('/settings?tab=billing')
  })

  it('is not skipped by a grant that names another user', async () => {
    const location = await run({
      zebri_shadow_admin_id: ADMIN_ID,
      zebri_shadow_grant: await grantFor('33333333-3333-4333-8333-333333333333'),
    })
    expect(location).toContain('/settings?tab=billing')
  })

  it('is skipped for a genuine shadow session', async () => {
    const location = await run({
      zebri_shadow_admin_id: ADMIN_ID,
      zebri_shadow_grant: await grantFor(USER_ID),
    })
    expect(location).toBeNull()
  })

  it('is not skipped when the service-role key is unset, even for a genuine grant', async () => {
    const grant = await grantFor(USER_ID)
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const location = await run({ zebri_shadow_admin_id: ADMIN_ID, zebri_shadow_grant: grant })
    expect(location).toContain('/settings?tab=billing')
  })
})
