/**
 * The optimistic-concurrency guard on template layout writes (migration
 * `20260930000000_proposal_template_revision.sql`) against local Supabase:
 * every write carries the revision it was based on, a match bumps it, a
 * miss comes back as a conflict carrying the current row with nothing
 * overwritten. The beacon path matches on the same guard but never bumps.
 *
 * Root-cause regression for the 2026-09-20 "lost on refresh" report: a
 * reloaded tab holding a stale copy could autosave it wholesale over a
 * newer one, because the update had no guard at all.
 *
 * @module tests/integration/proposals/template-revision
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/proposals/templates/layout-beacon/route'
import { createTemplateAction, getTemplateAction, updateTemplateLayoutAction, type ProposalLayout } from '@/features/proposals'

import { createTestUser, type TestUser } from '../helpers/supabase'

let activeClient: TestUser['client'] | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeClient) throw new Error('No active test client')
    return activeClient
  }),
}))

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const createdUsers: TestUser[] = []

const empty: ProposalLayout = { version: 2, sections: [] }
const first: ProposalLayout = { version: 2, sections: [], page: { allowDownload: true } }
const second: ProposalLayout = { version: 2, sections: [], page: { allowDownload: false } }

async function freshTemplate() {
  const user = await createTestUser({}, pro)
  createdUsers.push(user)
  activeClient = user.client
  const created = await createTemplateAction({ name: 'Guarded', layout: empty })
  if (!created.ok) throw new Error(created.error)
  return created.template
}

function beacon(id: string, layout: ProposalLayout, baseRevision: number): Request {
  return new Request('http://localhost/api/proposals/templates/layout-beacon', {
    method: 'POST',
    body: JSON.stringify({ id, layout, baseRevision }),
  })
}

afterEach(async () => {
  for (const user of createdUsers.splice(0)) await user.cleanup()
  activeClient = null
})

describe('template layout revision guard', () => {
  it('starts at revision 0 and bumps by one on every matched write', async () => {
    const template = await freshTemplate()
    expect(template.revision).toBe(0)

    const one = await updateTemplateLayoutAction({ id: template.id, layout: first, baseRevision: 0 })
    expect(one).toEqual({ ok: true, revision: 1 })

    const two = await updateTemplateLayoutAction({ id: template.id, layout: second, baseRevision: 1 })
    expect(two).toEqual({ ok: true, revision: 2 })

    const reread = await getTemplateAction(template.id)
    expect(reread.ok && reread.template.revision).toBe(2)
    expect(reread.ok && reread.template.layout).toEqual(second)
  })

  it('refuses a stale base revision, returns the current row, and leaves it untouched', async () => {
    const template = await freshTemplate()
    const ok = await updateTemplateLayoutAction({ id: template.id, layout: first, baseRevision: 0 })
    expect(ok.ok).toBe(true)

    const stale = await updateTemplateLayoutAction({ id: template.id, layout: second, baseRevision: 0 })
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.conflict).toEqual({ revision: 1, layout: first })

    const reread = await getTemplateAction(template.id)
    expect(reread.ok && reread.template.layout).toEqual(first)
    expect(reread.ok && reread.template.revision).toBe(1)
  })

  it('still reports an unknown id as not found, not as a conflict', async () => {
    await freshTemplate()
    const result = await updateTemplateLayoutAction({ id: '00000000-0000-0000-0000-000000000000', layout: first, baseRevision: 0 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('Template not found')
    expect(result.conflict).toBeUndefined()
  })

  it('beacon: writes on a matching base revision without bumping it', async () => {
    const template = await freshTemplate()
    const response = await POST(beacon(template.id, first, 0))
    expect(response.status).toBe(200)

    const reread = await getTemplateAction(template.id)
    expect(reread.ok && reread.template.layout).toEqual(first)
    expect(reread.ok && reread.template.revision).toBe(0)

    // The reloaded tab's normal autosave, still based on 0, then lands.
    const follow = await updateTemplateLayoutAction({ id: template.id, layout: second, baseRevision: 0 })
    expect(follow).toEqual({ ok: true, revision: 1 })
  })

  it('beacon: refuses a stale base revision with 409 and leaves the row untouched', async () => {
    const template = await freshTemplate()
    const ok = await updateTemplateLayoutAction({ id: template.id, layout: first, baseRevision: 0 })
    expect(ok.ok).toBe(true)

    const response = await POST(beacon(template.id, second, 0))
    expect(response.status).toBe(409)

    const reread = await getTemplateAction(template.id)
    expect(reread.ok && reread.template.layout).toEqual(first)
  })
})
