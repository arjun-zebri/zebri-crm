/**
 * The expire-contracts cron must call `expire_contracts()` with the
 * service-role client: clients have no EXECUTE on it since migration
 * 20261001310000 (it used to be granted to anon, so anyone could expire
 * every tenant's contracts). The cron secret is the only gate.
 *
 * @module tests/unit/app/api/cron/expire-contracts.test
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/cron-auth', () => ({
  isCronAuthorized: vi.fn().mockReturnValue(true),
}))

const adminRpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: adminRpc }),
}))

const sessionClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => sessionClient(...args),
}))

import { GET, POST } from '@/app/api/cron/expire-contracts/route'
import { isCronAuthorized } from '@/lib/api/cron-auth'

function request() {
  return new NextRequest('https://zebri.test/api/cron/expire-contracts')
}

describe('/api/cron/expire-contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isCronAuthorized).mockReturnValue(true)
    adminRpc.mockResolvedValue({ data: ['c1', 'c2'], error: null })
  })

  it('calls expire_contracts with the service-role client', async () => {
    const res = await GET(request())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, expired: 2 })
    expect(adminRpc).toHaveBeenCalledWith('expire_contracts')
    expect(sessionClient).not.toHaveBeenCalled()
  })

  it('refuses without cron auth and touches nothing', async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false)

    const res = await POST(request())

    expect(res.status).toBe(401)
    expect(adminRpc).not.toHaveBeenCalled()
  })

  it('reports an RPC failure as a 500', async () => {
    adminRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const res = await GET(request())

    expect(res.status).toBe(500)
  })
})
