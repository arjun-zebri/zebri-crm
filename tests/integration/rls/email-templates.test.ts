import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ensureStarterTemplates, STARTER_EMAIL_TEMPLATES } from '@/lib/email/starter-templates'

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

/**
 * RLS tenant isolation for `email_templates` + the starter-library
 * seeder.
 *
 * Email templates carry an MC's personal client-facing copy (often
 * customised wording and legal celebrant language). A cross-tenant
 * read would leak it; a cross-tenant write would let a malicious user
 * silently alter the emails a competitor sends to their couples.
 *
 * Also proves {@link ensureStarterTemplates} seeds a fresh user once
 * and is idempotent thereafter.
 */
describe('RLS: email_templates tenant isolation + seeding', () => {
  let userA: TestUser
  let userB: TestUser
  let templateAId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data, error } = await userA.client
      .from('email_templates')
      .insert({
        user_id: userA.id,
        name: 'A — Enquiry acknowledgement',
        subject: 'Thanks {{couple.primary_name}}',
        content: { type: 'doc', content: [] },
        lifecycle_stage: 'enquiry',
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
      .from('email_templates')
      .select('id, name')
      .eq('id', templateAId)
      .single()
    expect(error).toBeNull()
    expect(data?.name).toBe('A — Enquiry acknowledgement')
  })

  it('cross-tenant SELECT returns empty (RLS filters)', async () => {
    const { data, error } = await userB.client
      .from('email_templates')
      .select('id')
      .eq('id', templateAId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('cross-tenant UPDATE silently affects zero rows', async () => {
    const { error } = await userB.client
      .from('email_templates')
      .update({ name: 'PWNED' })
      .eq('id', templateAId)
    expect(error).toBeNull()

    const admin = serviceClient()
    const { data } = await admin
      .from('email_templates')
      .select('name')
      .eq('id', templateAId)
      .single()
    expect(data?.name).toBe('A — Enquiry acknowledgement')
  })

  it('cross-tenant DELETE silently affects zero rows', async () => {
    await userB.client.from('email_templates').delete().eq('id', templateAId)
    const admin = serviceClient()
    const { data } = await admin.from('email_templates').select('id').eq('id', templateAId)
    expect(data).toHaveLength(1)
  })

  it('INSERT claiming a different user_id is rejected', async () => {
    const { error } = await userB.client.from('email_templates').insert({
      user_id: userA.id,
      name: 'Smuggled in as A',
      content: {},
    })
    expect(error).not.toBeNull()
  })

  it('anonymous client cannot read email_templates at all', async () => {
    const anon = anonClient()
    const { data } = await anon.from('email_templates').select('id')
    expect(data).toEqual([])
  })

  it('ensureStarterTemplates seeds a fresh user once, then is idempotent', async () => {
    // userB has no templates yet — seed should populate the full set.
    const inserted = await ensureStarterTemplates(userB.client, userB.id)
    expect(inserted).toBe(STARTER_EMAIL_TEMPLATES.length)

    const { count } = await userB.client
      .from('email_templates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userB.id)
    expect(count).toBe(STARTER_EMAIL_TEMPLATES.length)

    // Second call is a no-op (user already has templates).
    const again = await ensureStarterTemplates(userB.client, userB.id)
    expect(again).toBe(0)

    // Seeded rows are flagged as starters and tenant-scoped.
    const { data: starters } = await userB.client
      .from('email_templates')
      .select('is_starter')
      .eq('user_id', userB.id)
    expect(starters?.every((r) => r.is_starter)).toBe(true)
  })
})
