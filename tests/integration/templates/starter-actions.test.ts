/**
 * Integration tests for the starter-template add actions against local
 * Supabase (real schema, real RLS).
 *
 * Proves, for packages / quotes / invoices / contracts:
 * - A starter inserts the parent row flagged `is_starter = true`, plus its
 *   line items (for the line-item types), under the caller's `user_id`.
 * - Re-adding a name the MC already owns is a no-op (added: 0).
 * - Unknown names are silently ignored (added: 0), so a stale client can
 *   never inject arbitrary content.
 *
 * The actions read the authenticated session from `@/lib/supabase/server`
 * (cookies); we mock that helper to return a client signed in as the test
 * user, matching the couples action integration tests.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createTestUser, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user — set `activeUser` before calling')
    return activeUser.client
  }),
}))

// eslint-disable-next-line import/order
import {
  addStarterContractsAction,
  addStarterInvoiceTemplatesAction,
  addStarterPackagesAction,
  addStarterQuoteTemplatesAction,
} from '@/app/(dashboard)/templates/starter-actions'

describe('starter-template add actions', () => {
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, { subscription_status: 'active', subscription_plan: 'pro' })
    activeUser = user
  })

  afterAll(async () => {
    activeUser = null
    await user?.cleanup()
  })

  it('adds a starter package flagged is_starter with its line items', async () => {
    const res = await addStarterPackagesAction(['Full Day MC'])
    expect(res.ok).toBe(true)
    expect(res.ok && res.data.added).toBe(1)

    const { data: pkg } = await user.client
      .from('packages')
      .select('id, is_starter')
      .eq('user_id', user.id)
      .eq('name', 'Full Day MC')
      .single()
    expect(pkg?.is_starter).toBe(true)

    const { data: items } = await user.client.from('package_items').select('id').eq('package_id', pkg!.id)
    expect(items).toHaveLength(3)
  })

  it('skips a package the MC already owns (no-op)', async () => {
    const res = await addStarterPackagesAction(['Full Day MC'])
    expect(res.ok && res.data.added).toBe(0)
  })

  it('ignores unknown package names', async () => {
    const res = await addStarterPackagesAction(['Definitely Not A Starter'])
    expect(res.ok && res.data.added).toBe(0)
  })

  it('adds a starter quote template with its items', async () => {
    const res = await addStarterQuoteTemplatesAction(['Full Day Wedding'])
    expect(res.ok && res.data.added).toBe(1)

    const { data: tpl } = await user.client
      .from('quote_templates')
      .select('id, is_starter')
      .eq('user_id', user.id)
      .eq('name', 'Full Day Wedding')
      .single()
    expect(tpl?.is_starter).toBe(true)

    const { data: items } = await user.client.from('quote_template_items').select('id').eq('template_id', tpl!.id)
    expect(items).toHaveLength(2)
  })

  it('adds a starter invoice template with its items', async () => {
    const res = await addStarterInvoiceTemplatesAction(['Booking Deposit'])
    expect(res.ok && res.data.added).toBe(1)

    const { data: tpl } = await user.client
      .from('invoice_templates')
      .select('id, is_starter')
      .eq('user_id', user.id)
      .eq('name', 'Booking Deposit')
      .single()
    expect(tpl?.is_starter).toBe(true)

    const { data: items } = await user.client
      .from('invoice_template_items')
      .select('id')
      .eq('invoice_template_id', tpl!.id)
    expect(items).toHaveLength(1)
  })

  it('adds a starter contract flagged is_starter', async () => {
    const res = await addStarterContractsAction(['Deposit & Cancellation Terms'])
    expect(res.ok && res.data.added).toBe(1)

    const { data: tpl } = await user.client
      .from('contract_templates')
      .select('is_starter, content')
      .eq('user_id', user.id)
      .eq('name', 'Deposit & Cancellation Terms')
      .single()
    expect(tpl?.is_starter).toBe(true)
    expect((tpl?.content as { type?: string })?.type).toBe('doc')
  })
})
