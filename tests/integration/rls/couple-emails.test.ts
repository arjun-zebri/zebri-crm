import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * RLS tenant isolation for `couple_emails` (the couple Emails-history log).
 *
 * Rows record who an MC emailed and what was sent — a cross-tenant read
 * would leak a competitor's client communications. Proves owner-only.
 */
describe('RLS: couple_emails tenant isolation', () => {
  let userA: TestUser
  let userB: TestUser
  let coupleAId: string
  let emailAId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data: couple, error: cErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sam & Alex', email: 'sam@example.com', status: 'new' })
      .select('id')
      .single()
    expect(cErr).toBeNull()
    coupleAId = couple!.id

    const { data: email, error } = await userA.client
      .from('couple_emails')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        subject: 'Thanks for reaching out',
        to_email: 'sam@example.com',
        source: 'manual',
        status: 'sent',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    emailAId = email!.id
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('owner can read their own logged email', async () => {
    const { data, error } = await userA.client.from('couple_emails').select('subject').eq('id', emailAId).single()
    expect(error).toBeNull()
    expect(data?.subject).toBe('Thanks for reaching out')
  })

  it('cross-tenant SELECT returns empty', async () => {
    const { data } = await userB.client.from('couple_emails').select('id').eq('id', emailAId)
    expect(data).toEqual([])
  })

  it('cross-tenant UPDATE silently affects zero rows', async () => {
    const { error } = await userB.client.from('couple_emails').update({ subject: 'PWNED' }).eq('id', emailAId)
    expect(error).toBeNull()
    const admin = serviceClient()
    const { data } = await admin.from('couple_emails').select('subject').eq('id', emailAId).single()
    expect(data?.subject).toBe('Thanks for reaching out')
  })

  it('cross-tenant DELETE silently affects zero rows', async () => {
    await userB.client.from('couple_emails').delete().eq('id', emailAId)
    const admin = serviceClient()
    const { data } = await admin.from('couple_emails').select('id').eq('id', emailAId)
    expect(data).toHaveLength(1)
  })

  it('INSERT claiming a different user_id is rejected', async () => {
    const { error } = await userB.client.from('couple_emails').insert({
      user_id: userA.id,
      couple_id: coupleAId,
      subject: 'Smuggled in as A',
      to_email: 'x@example.com',
    })
    expect(error).not.toBeNull()
  })

  it('anonymous client cannot read couple_emails at all', async () => {
    const anon = anonClient()
    const { data } = await anon.from('couple_emails').select('id')
    expect(data).toEqual([])
  })
})
