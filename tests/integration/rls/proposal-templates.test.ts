/**
 * RLS coverage for `proposal_templates` (Proposal Layout v2, Phase 1):
 * owner-only on every verb, one default per user, anon sees nothing.
 *
 * @module tests/integration/rls/proposal-templates
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase'

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const layout = { version: 2, sections: [] }

describe('RLS: proposal_templates', () => {
  let a: TestUser
  let b: TestUser
  let aTemplateId: string

  beforeAll(async () => {
    a = await createTestUser({}, pro)
    b = await createTestUser({}, pro)
    const { data, error } = await a.client.from('proposal_templates').insert({ user_id: a.id, name: 'MC', layout, is_default: true }).select('id').single()
    if (error || !data) throw new Error(`insert failed: ${error?.message}`)
    aTemplateId = data.id
  })
  afterAll(async () => { await a?.cleanup(); await b?.cleanup() })

  it('the owner can read and update their template', async () => {
    const { data } = await a.client.from('proposal_templates').select('id, name').eq('id', aTemplateId)
    expect(data).toHaveLength(1)
    const { error } = await a.client.from('proposal_templates').update({ name: 'MC only' }).eq('id', aTemplateId)
    expect(error).toBeNull()
  })

  it('another user cannot see, update, delete or insert into it', async () => {
    const { data } = await b.client.from('proposal_templates').select('id').eq('id', aTemplateId)
    expect(data).toEqual([])
    const { data: upd } = await b.client.from('proposal_templates').update({ name: 'hacked' }).eq('id', aTemplateId).select('id')
    expect(upd).toEqual([])
    const { data: del } = await b.client.from('proposal_templates').delete().eq('id', aTemplateId).select('id')
    expect(del).toEqual([])
    const { error } = await b.client.from('proposal_templates').insert({ user_id: a.id, name: 'spoof', layout })
    expect(error).not.toBeNull()
  })

  it('anon cannot read the table', async () => {
    const { data } = await anonClient().from('proposal_templates').select('id')
    expect(data ?? []).toEqual([])
  })

  it('a second default for the same user is refused', async () => {
    const { error } = await a.client.from('proposal_templates').insert({ user_id: a.id, name: 'Second', layout, is_default: true })
    expect(error?.code).toBe('23505')
  })

  it('the owner can delete their template', async () => {
    const { error } = await a.client.from('proposal_templates').delete().eq('id', aTemplateId)
    expect(error).toBeNull()
    const { data } = await a.client.from('proposal_templates').select('id').eq('id', aTemplateId)
    expect(data).toEqual([])
  })
})
