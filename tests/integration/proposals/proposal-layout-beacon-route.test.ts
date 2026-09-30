/**
 * The per-proposal `layout-beacon` route (see its module doc) against
 * local Supabase. The beacon is the last line of defence for work typed
 * inside the autosave debounce when a tab closes, so the cases that
 * matter are: the owner's write lands and does NOT move
 * `layout_revision` (a bump would make the restored tab's first real
 * autosave look like a conflict against its own write), an accepted
 * proposal is frozen, and another tenant's proposal is untouchable.
 *
 * `@/lib/supabase/server` is mocked to hand back the signed-in test
 * user's client, the same pattern `create-from-template.test.ts` uses, so
 * the route runs with real RLS and no request context.
 *
 * @module tests/integration/proposals/proposal-layout-beacon-route
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createProposalFromTemplateAction } from '@/app/(dashboard)/proposals/create-from-template'
import { POST } from '@/app/api/proposals/layout-beacon/route'
import { createTemplateAction, type ProposalLayout } from '@/features/proposals'

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase'

let activeClient: TestUser['client'] | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeClient) throw new Error('No active test client')
    return activeClient
  }),
}))

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const createdUsers: TestUser[] = []

const emptyLayout: ProposalLayout = { version: 2, sections: [] }
const beaconedLayout: ProposalLayout = { version: 2, sections: [], page: { allowDownload: true } }

function beaconRequest(id: string, layout: ProposalLayout, baseRevision = 0): Request {
  return new Request('http://localhost/api/proposals/layout-beacon', {
    method: 'POST',
    body: JSON.stringify({ id, layout, baseRevision }),
  })
}

/** A signed-in user with a draft proposal created from a template, plus that proposal's id. */
async function arrange(): Promise<{ user: TestUser; proposalId: string }> {
  const user = await createTestUser({}, pro)
  createdUsers.push(user)
  activeClient = user.client
  const { data: couple, error } = await user.client
    .from('couples').insert({ user_id: user.id, name: 'Anna & Jake', status: 'new' }).select('id').single()
  if (error || !couple) throw new Error(`couple insert failed: ${error?.message}`)
  const template = await createTemplateAction({ name: 'Beacon target', layout: emptyLayout })
  if (!template.ok) throw new Error(template.error)
  const proposal = await createProposalFromTemplateAction({ coupleId: couple.id, templateId: template.template.id, expiresAt: null })
  if (!proposal.ok) throw new Error(proposal.error)
  return { user, proposalId: proposal.proposalId }
}

afterEach(async () => {
  for (const user of createdUsers.splice(0)) await user.cleanup()
  activeClient = null
})

describe('POST /api/proposals/layout-beacon', () => {
  it('saves the layout for its owner and leaves layout_revision where it was', async () => {
    const { user, proposalId } = await arrange()
    const response = await POST(beaconRequest(proposalId, beaconedLayout))
    expect(response.status).toBe(200)

    const { data } = await user.client.from('proposals').select('layout, layout_revision').eq('id', proposalId).single()
    expect(data?.layout).toEqual(beaconedLayout)
    // Same generation, deliberately: see the route's module doc.
    expect(data?.layout_revision).toBe(0)
  })

  it('refuses an unauthenticated beacon', async () => {
    activeClient = anonClient()
    const response = await POST(beaconRequest('00000000-0000-0000-0000-000000000000', emptyLayout))
    expect(response.status).toBe(401)
  })

  it('refuses a stale revision without overwriting', async () => {
    const { user, proposalId } = await arrange()
    const bumped = await user.client.from('proposals').update({ layout_revision: 3 }).eq('id', proposalId)
    expect(bumped.error).toBeNull()

    const response = await POST(beaconRequest(proposalId, beaconedLayout))
    expect(response.status).toBe(409)
    const { data } = await user.client.from('proposals').select('layout').eq('id', proposalId).single()
    expect(data?.layout).toEqual(emptyLayout)
  })

  it('freezes an accepted proposal', async () => {
    const { user, proposalId } = await arrange()
    const accepted = await user.client
      .from('proposals').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', proposalId)
    expect(accepted.error).toBeNull()

    const response = await POST(beaconRequest(proposalId, beaconedLayout))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('accepted') })
    const { data } = await user.client.from('proposals').select('layout').eq('id', proposalId).single()
    expect(data?.layout).toEqual(emptyLayout)
  })

  it('refuses another tenant\'s proposal and leaves the row unchanged', async () => {
    const owner = await arrange()
    const intruder = await arrange()
    // `arrange` leaves the most recent user active, so this runs as the intruder.
    void intruder
    const response = await POST(beaconRequest(owner.proposalId, beaconedLayout))
    expect(response.status).toBe(404)

    activeClient = owner.user.client
    const { data } = await owner.user.client.from('proposals').select('layout').eq('id', owner.proposalId).single()
    expect(data?.layout).toEqual(emptyLayout)
  })
})
