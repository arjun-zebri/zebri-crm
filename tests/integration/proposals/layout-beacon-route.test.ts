/**
 * The `layout-beacon` route (see its module doc) against local Supabase:
 * an authenticated owner's beacon lands, an unauthenticated one is
 * refused, and a cross-tenant id is refused with the row left untouched -
 * the same RLS guarantee `template-editor-save.test.ts` proves for
 * `updateTemplateLayoutAction`, since this route writes the same table
 * through the same user-context client.
 *
 * @module tests/integration/proposals/layout-beacon-route
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/proposals/templates/layout-beacon/route'
import { createTemplateAction, getTemplateAction, type ProposalLayout } from '@/features/proposals'

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
async function newUser(): Promise<TestUser> {
  const user = await createTestUser({}, pro)
  createdUsers.push(user)
  return user
}

function beaconRequest(id: string, layout: ProposalLayout): Request {
  return new Request('http://localhost/api/proposals/templates/layout-beacon', {
    method: 'POST',
    body: JSON.stringify({ id, layout, baseRevision: 0 }),
  })
}

const emptyLayout: ProposalLayout = { version: 2, sections: [] }
const editedLayout: ProposalLayout = { version: 2, sections: [], page: { allowDownload: true } }

afterEach(async () => {
  for (const user of createdUsers.splice(0)) await user.cleanup()
  activeClient = null
})

describe('POST /api/proposals/templates/layout-beacon', () => {
  it('saves the layout for its owner, readable back through getTemplateAction', async () => {
    const owner = await newUser()
    activeClient = owner.client
    const created = await createTemplateAction({ name: 'Beacon target', layout: emptyLayout })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const response = await POST(beaconRequest(created.template.id, editedLayout))
    expect(response.status).toBe(200)

    const reread = await getTemplateAction(created.template.id)
    expect(reread.ok).toBe(true)
    if (reread.ok) expect(reread.template.layout).toEqual(editedLayout)
  })

  it('refuses an unauthenticated beacon', async () => {
    activeClient = anonClient()
    const response = await POST(beaconRequest('00000000-0000-0000-0000-000000000000', emptyLayout))
    expect(response.status).toBe(401)
  })

  it('refuses a cross-tenant beacon and leaves the row unchanged', async () => {
    const owner = await newUser()
    activeClient = owner.client
    const created = await createTemplateAction({ name: 'Owner template', layout: emptyLayout })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const intruder = await newUser()
    activeClient = intruder.client
    const response = await POST(beaconRequest(created.template.id, editedLayout))
    expect(response.status).toBe(404)

    activeClient = owner.client
    const stillOwners = await getTemplateAction(created.template.id)
    expect(stillOwners.ok).toBe(true)
    if (stillOwners.ok) expect(stillOwners.template.layout).toEqual(emptyLayout)
  })
})
