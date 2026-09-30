/**
 * The expiry cron route: bearer-gated, calls `expire_proposals()` with the
 * admin client (the RPC is revoked from `authenticated`), reports the
 * count, and alerts on failure so a silent cron never goes unnoticed.
 *
 * @module tests/unit/app/api/cron/expire-proposals.test
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/cron-auth', () => ({
  isCronAuthorized: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(),
}))

const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc }),
}))

import { GET, POST } from '@/app/api/cron/expire-proposals/route'
import { sendAlert } from '@/lib/alerts/send-alert'
import { isCronAuthorized } from '@/lib/api/cron-auth'

function request() {
  return new NextRequest('https://zebri.test/api/cron/expire-proposals')
}

describe('/api/cron/expire-proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isCronAuthorized).mockReturnValue(true)
    rpc.mockResolvedValue({ data: ['a', 'b'], error: null })
  })

  it('rejects an unauthorised caller before touching the database', async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false)
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls expire_proposals and reports how many it stamped', async () => {
    const res = await POST(request())
    expect(rpc).toHaveBeenCalledWith('expire_proposals')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, expired: 2 })
  })

  it('reports zero when nothing expired', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const res = await GET(request())
    await expect(res.json()).resolves.toEqual({ ok: true, expired: 0 })
  })

  it('alerts and returns 500 when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await GET(request())
    expect(res.status).toBe(500)
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cron_job_failed', job: 'expire-proposals', errorMessage: 'boom' }),
    )
  })
})
