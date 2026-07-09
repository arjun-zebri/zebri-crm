import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, type TestUser } from '../helpers/supabase'

/**
 * RLS tenant isolation for `email_template_categories` + the
 * `email_templates.category_id` wiring.
 *
 * Categories name an MC's workflow (their private process language), so
 * cross-tenant reads leak it and cross-tenant writes let a stranger
 * rename / delete another MC's grouping. Also proves the FK contract:
 * deleting a category uncategorises its templates (set-null), never
 * deletes them.
 */
describe('RLS: email_template_categories tenant isolation', () => {
  let userA: TestUser
  let userB: TestUser
  let categoryAId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data, error } = await userA.client
      .from('email_template_categories')
      .insert({ user_id: userA.id, name: 'A — Planning', color: 'violet', position: 0 })
      .select('id')
      .single()
    expect(error).toBeNull()
    categoryAId = data!.id
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('owner can read their own category', async () => {
    const { data, error } = await userA.client
      .from('email_template_categories')
      .select('id, name')
      .eq('id', categoryAId)
      .single()
    expect(error).toBeNull()
    expect(data?.name).toBe('A — Planning')
  })

  it("another tenant can't read it", async () => {
    const { data } = await userB.client
      .from('email_template_categories')
      .select('id')
      .eq('id', categoryAId)
    expect(data ?? []).toHaveLength(0)
  })

  it("another tenant can't rename it", async () => {
    const { data } = await userB.client
      .from('email_template_categories')
      .update({ name: 'hijacked' })
      .eq('id', categoryAId)
      .select('id')
    expect(data ?? []).toHaveLength(0)

    const { data: after } = await userA.client
      .from('email_template_categories')
      .select('name')
      .eq('id', categoryAId)
      .single()
    expect(after?.name).toBe('A — Planning')
  })

  it("another tenant can't delete it", async () => {
    const { data } = await userB.client
      .from('email_template_categories')
      .delete()
      .eq('id', categoryAId)
      .select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it("another tenant can't insert a category owned by A", async () => {
    const { error } = await userB.client
      .from('email_template_categories')
      .insert({ user_id: userA.id, name: 'planted', color: 'rose', position: 9 })
    expect(error).not.toBeNull()
  })

  it('deleting a category uncategorises its templates (set-null), keeping them', async () => {
    const { data: cat } = await userA.client
      .from('email_template_categories')
      .insert({ user_id: userA.id, name: 'A — Doomed', color: 'stone', position: 1 })
      .select('id')
      .single()
    const { data: template } = await userA.client
      .from('email_templates')
      .insert({
        user_id: userA.id,
        name: 'A — Filed under doomed',
        subject: 'Hi',
        content: { type: 'doc', content: [] },
        category_id: cat!.id,
      })
      .select('id')
      .single()

    const { error: deleteError } = await userA.client
      .from('email_template_categories')
      .delete()
      .eq('id', cat!.id)
    expect(deleteError).toBeNull()

    const { data: after } = await userA.client
      .from('email_templates')
      .select('id, category_id')
      .eq('id', template!.id)
      .single()
    expect(after?.id).toBe(template!.id)
    expect(after?.category_id).toBeNull()
  })
})
