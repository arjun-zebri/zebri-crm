import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase'

/**
 * RLS tenant isolation for payment schedule tables.
 *
 * Ticks the coverage matrix in `.claude/docs/security.md`. Runs against local
 * Supabase with real schema and real policies.
 */
describe('RLS: payment_schedules tenant isolation', () => {
  let alice: TestUser
  let bob: TestUser
  let aliceScheduleId: string
  let aliceStageId: string
  let aliceInvoiceStageId: string

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    alice = await createTestUser({}, pro)
    bob = await createTestUser({}, pro)

    const admin = serviceClient()

    // Create a couple for Alice so we can create an invoice
    const { data: coupleData } = await admin
      .from('couples')
      .insert({ user_id: alice.id, name: 'Alice Couple', status: 'new' })
      .select('id')
      .single()
    const aliceCoupleId = coupleData!.id

    // Get the next invoice number
    const { data: invNumData } = await admin.rpc('generate_invoice_number', { p_user_id: alice.id })
    const invoiceNumber = invNumData || 'INV-001'

    const { data: schedule, error: scheduleError } = await admin
      .from('payment_schedules')
      .insert({ user_id: alice.id, name: '30 / 70 split', is_default: false })
      .select('id')
      .single()
    expect(scheduleError).toBeNull()
    aliceScheduleId = schedule!.id

    const { data: stage, error: stageError } = await admin
      .from('payment_schedule_stages')
      .insert({
        user_id: alice.id,
        schedule_id: aliceScheduleId,
        position: 1,
        label: 'Deposit',
        amount_type: 'percent',
        amount_value: 30,
        due_offset_days: 0,
      })
      .select('id')
      .single()
    expect(stageError).toBeNull()
    aliceStageId = stage!.id

    const { data: invoice } = await admin
      .from('invoices')
      .insert({
        user_id: alice.id,
        couple_id: aliceCoupleId,
        invoice_number: invoiceNumber,
        title: 'Test',
        subtotal: 5000,
        status: 'draft',
      })
      .select('id')
      .single()

    const { data: invStage, error: invStageError } = await admin
      .from('invoice_payment_stages')
      .insert({
        user_id: alice.id,
        invoice_id: invoice!.id,
        position: 1,
        label: 'Deposit',
        amount_type: 'percent',
        amount_value: 30,
        amount_cents: 150_000,
        due_date: '2026-08-01',
      })
      .select('id')
      .single()
    expect(invStageError).toBeNull()
    aliceInvoiceStageId = invStage!.id
  })

  afterAll(async () => {
    await alice.cleanup()
    await bob.cleanup()
  })

  it('denies Bob select on Alice payment_schedules', async () => {
    const { data } = await bob.client
      .from('payment_schedules')
      .select('id')
      .eq('id', aliceScheduleId)
    expect(data).toEqual([])
  })

  it('denies Bob select on Alice payment_schedule_stages', async () => {
    const { data } = await bob.client
      .from('payment_schedule_stages')
      .select('id')
      .eq('id', aliceStageId)
    expect(data).toEqual([])
  })

  it('denies Bob select on Alice invoice_payment_stages', async () => {
    const { data } = await bob.client
      .from('invoice_payment_stages')
      .select('id')
      .eq('id', aliceInvoiceStageId)
    expect(data).toEqual([])
  })

  it('denies Bob update on Alice invoice_payment_stages', async () => {
    const { data } = await bob.client
      .from('invoice_payment_stages')
      .update({ paid_at: new Date().toISOString() })
      .eq('id', aliceInvoiceStageId)
      .select('id')
    expect(data ?? []).toEqual([])
  })

  it('denies Bob delete on Alice payment_schedules', async () => {
    await bob.client.from('payment_schedules').delete().eq('id', aliceScheduleId)
    const admin = serviceClient()
    const { data } = await admin.from('payment_schedules').select('id').eq('id', aliceScheduleId)
    expect(data).toHaveLength(1)
  })

  it('rejects a second default schedule for one user', async () => {
    const admin = serviceClient()
    await admin
      .from('payment_schedules')
      .update({ is_default: true })
      .eq('id', aliceScheduleId)
    // Alice already has a seeded "Default" schedule from the backfill, so the
    // partial unique index must reject this second one.
    const { data } = await admin
      .from('payment_schedules')
      .select('id')
      .eq('user_id', alice.id)
      .eq('is_default', true)
    expect(data).toHaveLength(1)
  })
})
