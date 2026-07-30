/**
 * Migration A's backfill, verified against a seeded legacy invoice.
 *
 * The migration runs at `supabase db reset`, so this spec seeds a legacy-shaped
 * invoice, re-runs the backfill statement, and asserts the resulting stage rows
 * match the old column values.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

describe('legacy invoice backfill', () => {
  let user: TestUser
  let invoiceId: string

  beforeAll(async () => {
    user = await createTestUser()
    const admin = serviceClient()

    // Create a couple for the user so we can create an invoice
    const { data: coupleData } = await admin
      .from('couples')
      .insert({ user_id: user.id, name: 'Test Couple', status: 'new' })
      .select('id')
      .single()
    const coupleId = coupleData!.id

    // Get the next invoice number
    const { data: invNumData } = await admin.rpc('generate_invoice_number', { p_user_id: user.id })
    const invoiceNumber = invNumData || 'INV-001'

    // $5,000 + 10% GST = $5,500 total. 30% deposit = $1,650, final = $3,850.
    const { data } = await admin
      .from('invoices')
      .insert({
        user_id: user.id,
        couple_id: coupleId,
        invoice_number: invoiceNumber,
        title: 'Legacy invoice',
        subtotal: 5000,
        tax_rate: 10,
        status: 'deposit_paid',
        deposit_percent: 30,
        deposit_due_date: '2026-07-01',
        deposit_paid_at: '2026-07-02T00:00:00Z',
        final_due_date: '2026-09-01',
      })
      .select('id')
      .single()
    invoiceId = data!.id

    await admin.rpc('backfill_invoice_payment_stages')
  })

  afterAll(async () => {
    await user.cleanup()
  })

  it('creates two stages carrying the legacy amounts and dates', async () => {
    const admin = serviceClient()
    const { data } = await admin
      .from('invoice_payment_stages')
      .select('position, label, amount_type, amount_value, amount_cents, due_date, paid_at')
      .eq('invoice_id', invoiceId)
      .order('position')

    expect(data).toHaveLength(2)
    expect(data![0]).toMatchObject({
      position: 1,
      label: 'Deposit',
      amount_type: 'percent',
      amount_cents: 165_000,
      due_date: '2026-07-01',
    })
    expect(data![0]!.paid_at).not.toBeNull()
    expect(data![1]).toMatchObject({
      position: 2,
      label: 'Final balance',
      amount_type: 'remainder',
      amount_value: null,
      amount_cents: 385_000,
      due_date: '2026-09-01',
      paid_at: null,
    })
  })

  it('leaves invoices with no legacy schedule alone', async () => {
    const admin = serviceClient()

    // Create a couple for this test
    const { data: coupleData } = await admin
      .from('couples')
      .insert({ user_id: user.id, name: 'No Schedule Couple', status: 'new' })
      .select('id')
      .single()

    // Get the next invoice number
    const { data: invNumData } = await admin.rpc('generate_invoice_number', { p_user_id: user.id })
    const invoiceNumber = invNumData || 'INV-002'

    const { data: plain } = await admin
      .from('invoices')
      .insert({
        user_id: user.id,
        couple_id: coupleData!.id,
        invoice_number: invoiceNumber,
        title: 'No schedule',
        subtotal: 1000,
        status: 'draft',
      })
      .select('id')
      .single()

    await admin.rpc('backfill_invoice_payment_stages')

    const { data } = await admin
      .from('invoice_payment_stages')
      .select('id')
      .eq('invoice_id', plain!.id)
    expect(data).toEqual([])
  })

  it('seeds a brand-new signup a default schedule via the trigger', async () => {
    // The migration's backfill loop only covers users who existed when it ran.
    // This asserts the auth.users trigger covers everyone after that, which is
    // what stops sign_contract spawning stageless invoices for new MCs.
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    const fresh = await createTestUser({}, pro)
    const admin = serviceClient()
    const { data } = await admin
      .from('payment_schedules')
      .select('id, name, is_default')
      .eq('user_id', fresh.id)
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({ name: 'Default', is_default: true })
    await fresh.cleanup()
  })

  it('is idempotent: seeding twice leaves one schedule', async () => {
    const admin = serviceClient()
    await admin.rpc('seed_default_payment_schedule', { p_user_id: user.id })
    const { data } = await admin
      .from('payment_schedules')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_default', true)
    expect(data).toHaveLength(1)
  })

  it('seeds every user a default schedule with a remainder stage', async () => {
    const admin = serviceClient()
    const { data: schedules } = await admin
      .from('payment_schedules')
      .select('id, name, is_default')
      .eq('user_id', user.id)
      .eq('is_default', true)
    expect(schedules).toHaveLength(1)

    const { data: stages } = await admin
      .from('payment_schedule_stages')
      .select('position, amount_type, amount_value, due_offset_days')
      .eq('schedule_id', schedules![0]!.id)
      .order('position')
    expect(stages).toEqual([
      { position: 1, amount_type: 'percent', amount_value: 25, due_offset_days: 7 },
      { position: 2, amount_type: 'remainder', amount_value: null, due_offset_days: 30 },
    ])
  })
})
