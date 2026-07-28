import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * RLS tenant isolation for `questionnaire_templates`.
 *
 * Questionnaire templates are the reusable forms MCs build under Templates →
 * Questionnaires. A leak would expose another MC's bespoke question set; an
 * unauthorised write would let a malicious user alter a competitor's template,
 * so every questionnaire that MC then sends would carry tampered questions.
 */
describe('RLS: questionnaire_templates tenant isolation', () => {
  let userA: TestUser
  let userB: TestUser
  let templateAId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data, error } = await userA.client
      .from('questionnaire_templates')
      .insert({
        user_id: userA.id,
        name: 'Ceremony details',
        description: "A's default",
        questions: [{ id: 'q1', type: 'short_text', label: 'Partner 1 name', required: true }],
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    templateAId = data!.id
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('owner can read their own template', async () => {
    const { data, error } = await userA.client
      .from('questionnaire_templates')
      .select('id, name')
      .eq('id', templateAId)
      .single()
    expect(error).toBeNull()
    expect(data?.name).toBe('Ceremony details')
  })

  it('cross-tenant SELECT returns empty (RLS filters)', async () => {
    const { data, error } = await userB.client.from('questionnaire_templates').select('id').eq('id', templateAId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('cross-tenant UPDATE silently affects zero rows', async () => {
    const { error } = await userB.client.from('questionnaire_templates').update({ name: 'PWNED' }).eq('id', templateAId)
    expect(error).toBeNull()

    const { data } = await serviceClient().from('questionnaire_templates').select('name').eq('id', templateAId).single()
    expect(data?.name).toBe('Ceremony details')
  })

  it('cross-tenant DELETE silently affects zero rows', async () => {
    await userB.client.from('questionnaire_templates').delete().eq('id', templateAId)
    const { data } = await serviceClient().from('questionnaire_templates').select('id').eq('id', templateAId)
    expect(data).toHaveLength(1)
  })

  it('INSERT claiming a different user_id is rejected', async () => {
    const { error } = await userB.client.from('questionnaire_templates').insert({
      user_id: userA.id,
      name: 'Smuggled in as A',
      questions: [],
    })
    expect(error).not.toBeNull()
  })

  it('anonymous client cannot read questionnaire_templates at all', async () => {
    const { data } = await anonClient().from('questionnaire_templates').select('id')
    expect(data).toEqual([])
  })
})
