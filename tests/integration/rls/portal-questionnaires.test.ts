import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * The public `get_portal_questionnaires(token)` RPC surfaces a couple's
 * questionnaires inside the client portal. It must be gated by the portal
 * token, expose only sent/completed questionnaires (never drafts), and return
 * nothing for an unknown token.
 */
describe('RPC: get_portal_questionnaires', () => {
  let userA: TestUser
  let portalToken: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)

    const { data: couple } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sam & Alex', email: 'sam@example.com', status: 'new' })
      .select('id')
      .single()
    const coupleId = couple!.id

    // Enable the portal and capture its token.
    const { data: enabled } = await userA.client
      .from('couples')
      .update({ portal_token_enabled: true })
      .eq('id', coupleId)
      .select('portal_token')
      .single()
    portalToken = enabled!.portal_token

    const base = { user_id: userA.id, couple_id: coupleId, questions: [] }
    await userA.client.from('couple_questionnaires').insert([
      { ...base, title: 'Sent one', status: 'sent', share_token_enabled: true },
      { ...base, title: 'Draft one', status: 'draft', share_token_enabled: false },
    ])
  })

  afterAll(async () => {
    await userA?.cleanup()
  })

  it('returns only sent/completed questionnaires for a valid portal token', async () => {
    const { data, error } = await anonClient().rpc('get_portal_questionnaires', { token: portalToken })
    expect(error).toBeNull()
    const list = data as Array<{ title: string; status: string; share_token: string }>
    expect(list).toHaveLength(1)
    expect(list[0]!.title).toBe('Sent one')
    expect(list[0]!.share_token).toBeTruthy()
  })

  it('returns an empty array for an unknown token', async () => {
    const { data } = await anonClient().rpc('get_portal_questionnaires', {
      token: '00000000-0000-4000-8000-000000000000',
    })
    expect(data).toEqual([])
  })

  it('returns an empty array once the portal is disabled', async () => {
    const admin = serviceClient()
    const { data: couples } = await admin.from('couples').select('id').eq('portal_token', portalToken)
    await admin.from('couples').update({ portal_token_enabled: false }).eq('id', couples![0]!.id)

    const { data } = await anonClient().rpc('get_portal_questionnaires', { token: portalToken })
    expect(data).toEqual([])
  })
})
