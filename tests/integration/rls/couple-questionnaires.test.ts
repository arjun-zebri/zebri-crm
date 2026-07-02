import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/**
 * RLS tenant isolation for `couple_questionnaires` plus the public token-gated
 * RPCs (`get_public_questionnaire`, `save_questionnaire_progress`,
 * `submit_questionnaire`).
 *
 * The instance rows hold a couple's private answers, reachable publicly only
 * via the share token. We prove an MC can't see another MC's questionnaires,
 * that a disabled/unknown token returns nothing, that autosave + submit write
 * the answers, and that a second submission is refused.
 */
describe('RLS + RPCs: couple_questionnaires', () => {
  let userA: TestUser
  let userB: TestUser
  let coupleAId: string
  let liveId: string
  let liveToken: string
  let disabledToken: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)

    const { data: couple } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sam & Alex', email: 'sam@example.com', status: 'new' })
      .select('id')
      .single()
    coupleAId = couple!.id

    const questions = [
      { id: 'q1', type: 'short_text', label: 'Ceremony time', required: true },
      { id: 'q2', type: 'multiple_choice', label: 'Formalities', required: false, options: ['Speeches', 'Cake'] },
    ]

    const { data: live, error } = await userA.client
      .from('couple_questionnaires')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        title: 'Ceremony details',
        questions,
        status: 'sent',
        share_token_enabled: true,
      })
      .select('id, share_token')
      .single()
    expect(error).toBeNull()
    liveId = live!.id
    liveToken = live!.share_token

    const { data: disabled } = await userA.client
      .from('couple_questionnaires')
      .insert({ user_id: userA.id, couple_id: coupleAId, title: 'Not sent yet', questions, status: 'draft', share_token_enabled: false })
      .select('share_token')
      .single()
    disabledToken = disabled!.share_token
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  it('cross-tenant SELECT returns empty (RLS filters)', async () => {
    const { data } = await userB.client.from('couple_questionnaires').select('id').eq('id', liveId)
    expect(data).toEqual([])
  })

  it('INSERT claiming a different user_id is rejected', async () => {
    const { error } = await userB.client.from('couple_questionnaires').insert({
      user_id: userA.id,
      couple_id: coupleAId,
      title: 'Smuggled',
      questions: [],
    })
    expect(error).not.toBeNull()
  })

  it('anonymous client cannot read the table directly', async () => {
    const { data } = await anonClient().from('couple_questionnaires').select('id')
    expect(data).toEqual([])
  })

  it('get_public_questionnaire returns the questionnaire for an enabled token', async () => {
    const { data, error } = await anonClient().rpc('get_public_questionnaire', { token: liveToken })
    expect(error).toBeNull()
    const payload = data as { title?: string; questions?: unknown[]; brand_color?: string } | null
    expect(payload?.title).toBe('Ceremony details')
    expect(payload?.questions).toHaveLength(2)
    // Branding is merged in at the top level.
    expect(payload?.brand_color).toBeTruthy()
  })

  it('get_public_questionnaire returns null for a disabled or unknown token', async () => {
    const disabled = await anonClient().rpc('get_public_questionnaire', { token: disabledToken })
    expect(disabled.data).toBeNull()
    const unknown = await anonClient().rpc('get_public_questionnaire', {
      token: '00000000-0000-4000-8000-000000000000',
    })
    expect(unknown.data).toBeNull()
  })

  it('save_questionnaire_progress persists partial answers without completing', async () => {
    const { data } = await anonClient().rpc('save_questionnaire_progress', {
      token: liveToken,
      p_responses: { q1: '4:30 PM' },
    })
    expect((data as { success?: boolean }).success).toBe(true)

    const { data: row } = await serviceClient().from('couple_questionnaires').select('responses, status').eq('id', liveId).single()
    expect((row?.responses as Record<string, unknown>).q1).toBe('4:30 PM')
    expect(row?.status).toBe('sent')
  })

  it('submit_questionnaire stores answers, completes, and creates a follow-up task', async () => {
    const { data } = await anonClient().rpc('submit_questionnaire', {
      token: liveToken,
      p_responses: { q1: '4:30 PM', q2: ['Speeches'] },
    })
    expect((data as { success?: boolean }).success).toBe(true)

    const admin = serviceClient()
    const { data: row } = await admin.from('couple_questionnaires').select('status, completed_at, responses').eq('id', liveId).single()
    expect(row?.status).toBe('completed')
    expect(row?.completed_at).not.toBeNull()
    expect((row?.responses as Record<string, unknown>).q2).toEqual(['Speeches'])

    const { data: tasks } = await admin.from('tasks').select('title').eq('related_couple_id', coupleAId)
    expect((tasks ?? []).some((t) => /questionnaire completed/i.test(t.title))).toBe(true)
  })

  it('a second submission is refused', async () => {
    const { data } = await anonClient().rpc('submit_questionnaire', { token: liveToken, p_responses: {} })
    expect((data as { error?: string }).error).toBe('already_completed')
  })
})
