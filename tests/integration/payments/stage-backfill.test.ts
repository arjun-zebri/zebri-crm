/**
 * Default payment-schedule seeding for MC accounts.
 *
 * The one-time legacy-invoice backfill (`backfill_invoice_payment_stages`) is
 * retired: the `deposit_*` / `final_*` columns it read were dropped in
 * migration `20260730000100`, so legacy-shaped invoices can no longer be
 * created and the function is dead. What still matters, and is covered here, is
 * that every signup gets a default schedule via the `auth.users` trigger, so
 * `sign_contract` never spawns a stageless invoice for a new MC.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

describe('default payment schedule seeding', () => {
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser()
  })

  afterAll(async () => {
    await user.cleanup()
  })

  it('seeds a brand-new signup a default schedule via the trigger', async () => {
    // The auth.users trigger covers everyone at signup, which is what stops
    // sign_contract spawning stageless invoices for new MCs.
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
