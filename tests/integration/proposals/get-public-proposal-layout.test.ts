/**
 * `get_public_proposal_layout(token)` is the anon read for the v2 page:
 * the proposal's own layout, or null. Null while the share token is
 * disabled; no view-count side effects (that stays with
 * `get_public_proposal`); never leaks `page.passwordHash`; and, since
 * Phase 1 never writes `proposals.layout`, null even when the owner has a
 * default template (there is no fallback to a template's layout - see the
 * function's why-comment in the migration).
 *
 * @module tests/integration/proposals/get-public-proposal-layout
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const templateLayout = { version: 2, sections: [{ id: 't', kind: 'content', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' }, content: { type: 'doc', content: [] } }] }
const ownLayout = { version: 2, sections: [{ id: 'own', kind: 'content', style: { height: 'fit', contentWidth: 'narrow', padding: 'cozy' }, content: { type: 'doc', content: [] } }] }

describe('get_public_proposal_layout', () => {
  let user: TestUser
  let proposalId: string
  let token: string

  beforeAll(async () => {
    user = await createTestUser({}, pro)
    const { data: couple, error: coupleError } = await user.client.from('couples').insert({ user_id: user.id, name: 'Priya and Tom', status: 'new' }).select('id').single()
    if (coupleError || !couple) throw new Error(coupleError?.message)
    const { data: proposal, error } = await user.client
      .from('proposals')
      .insert({ user_id: user.id, couple_id: couple.id, title: 'Priya and Tom', proposal_number: 'PR-L2-1', deposit_percent: 30, share_token_enabled: false })
      .select('id, share_token')
      .single()
    if (error || !proposal) throw new Error(error?.message)
    proposalId = proposal.id
    token = proposal.share_token
  })
  afterAll(async () => { await user?.cleanup() })

  it('returns null while the share token is disabled', async () => {
    const { data, error } = await anonClient().rpc('get_public_proposal_layout', { token })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('returns null when the proposal has no layout even when a default template exists', async () => {
    const { error: templateError } = await user.client.from('proposal_templates').insert({ user_id: user.id, name: 'Default', layout: templateLayout, is_default: true })
    if (templateError) throw new Error(templateError.message)
    const { error: enableError } = await user.client.from('proposals').update({ share_token_enabled: true }).eq('id', proposalId)
    if (enableError) throw new Error(enableError.message)
    // The proposal itself still has no `layout`: Phase 1 never writes it,
    // so a default template existing must not change what the couple sees.
    const { data, error } = await anonClient().rpc('get_public_proposal_layout', { token })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('returns the proposal\'s own layout, set by hand, and does not bump the view count', async () => {
    // Written with the service client (bypassing RLS) to mirror the shape
    // a future Phase 4 editor save would take, independent of the owner
    // client's own update path.
    const { error } = await serviceClient().from('proposals').update({ layout: ownLayout }).eq('id', proposalId)
    if (error) throw new Error(error.message)
    const before = await user.client.from('proposals').select('view_count').eq('id', proposalId).single()
    const { data } = await anonClient().rpc('get_public_proposal_layout', { token })
    expect(data).toEqual(ownLayout)
    const after = await user.client.from('proposals').select('view_count').eq('id', proposalId).single()
    expect(after.data?.view_count).toBe(before.data?.view_count)
  })

  it('strips page.passwordHash from the returned layout', async () => {
    const { error } = await user.client
      .from('proposals')
      .update({ layout: { ...ownLayout, page: { passwordHash: 'not-a-real-hash', sectionNav: true } } })
      .eq('id', proposalId)
    if (error) throw new Error(error.message)
    const { data } = (await anonClient().rpc('get_public_proposal_layout', { token })) as {
      data: { page?: Record<string, unknown> } | null
    }
    expect(data?.page).toEqual({ sectionNav: true })
  })

  it('returns null for an unknown token', async () => {
    const { data, error } = await anonClient().rpc('get_public_proposal_layout', { token: '00000000-0000-0000-0000-000000000000' })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})
