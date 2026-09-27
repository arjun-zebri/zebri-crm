/**
 * send-contract writes the 'sent' audit row through the service-role
 * client. Clients have no EXECUTE on `emit_contract_audit_event` since
 * migration 20261001310000 (it can write into any tenant's audit log),
 * so a call through the MC's session client would fail and the row would
 * be silently lost.
 *
 * Uses `deliver: false` so the route stops after the lock and audit write,
 * before any email is sent.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CONTRACT_ID = 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1'
const USER_ID = 'u1u1u1u1-u1u1-4u1u-9u1u-u1u1u1u1u1u1'

const userRpc = vi.fn()
const adminRpc = vi.fn()

/**
 * A chainable stand-in for the session client: every builder method
 * returns the chain, and awaiting it (or `.single()` / `.maybeSingle()`)
 * yields the row configured for that table.
 */
function sessionClient() {
  const rows: Record<string, unknown> = {
    contracts: {
      id: CONTRACT_ID,
      title: 'Wedding MC agreement',
      contract_number: 'CTR-0001',
      content: { type: 'doc', content: [] },
      status: 'draft',
      share_token: 'tok',
      expires_at: null,
      couple_id: 'couple-1',
      signing_mode: 'parallel',
      couples: { name: 'Sam', email: 'sam@example.test', primary_email: 'sam@example.test' },
    },
  }
  const from = (table: string) => {
    const result = { data: rows[table] ?? null, error: null }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit', 'update', 'insert']) {
      chain[m] = () => chain
    }
    chain.single = async () => result
    chain.maybeSingle = async () => result
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result)
    return chain
  }
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: USER_ID, email: 'mc@example.test', user_metadata: {} } },
      }),
    },
    from,
    rpc: userRpc,
  }
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => sessionClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: adminRpc }) }))
vi.mock('@/lib/alerts/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/alerts/slack', () => ({ sendSlackAlert: vi.fn(async () => undefined) }))
vi.mock('@/lib/email', () => ({ sendContractEmail: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/email/branding', () => ({ emailBrandingForUser: vi.fn(async () => null) }))
vi.mock('@/lib/email/sender-identity', () => ({ resolveSender: vi.fn(async () => null) }))

beforeEach(() => {
  vi.clearAllMocks()
  userRpc.mockResolvedValue({ data: null, error: null })
  adminRpc.mockResolvedValue({ data: null, error: null })
})

describe('POST /api/email/send-contract audit row', () => {
  it("writes the 'sent' audit event with the service-role client", async () => {
    const { POST } = await import('@/app/api/email/send-contract/route')
    const res = await POST(
      new NextRequest('https://zebri.test/api/email/send-contract', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
        body: JSON.stringify({ contractId: CONTRACT_ID, deliver: false }),
      }),
    )

    expect(res.status).toBe(200)
    expect(adminRpc).toHaveBeenCalledWith('emit_contract_audit_event', {
      p_contract_id: CONTRACT_ID,
      p_event_type: 'sent',
      p_actor: 'mc',
    })
    expect(userRpc).not.toHaveBeenCalledWith('emit_contract_audit_event', expect.anything())
  })
})
